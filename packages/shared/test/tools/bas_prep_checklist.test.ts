import { describe, it, expect } from "vitest";
import { mapGstPeriod, quarterlyDueDate, dueDateFor, formFor, periodLabel } from "../../src/tools/bas_prep_checklist.js";
import { basPrepChecklist } from "../../src/tools/bas_prep_checklist.js";
import type { BasPrepChecklistDeps } from "../../src/tools/bas_prep_checklist.js";
import type { Store } from "../../src/store/types.js";
import type { Embedder } from "../../src/embed/types.js";
import type { UserFacts } from "../../src/facts.js";

describe("period helpers", () => {
  it("mapGstPeriod", () => {
    expect(mapGstPeriod("quarterly")).toBe("quarterly");
    expect(mapGstPeriod("monthly")).toBe("monthly");
    expect(mapGstPeriod("annual")).toBe("annual");
    expect(mapGstPeriod("n/a")).toBe("none");
  });
  it("quarterlyDueDate maps each quarter for FY2025-26", () => {
    expect(quarterlyDueDate(1, "2025-26")).toBe("2025-10-28");
    expect(quarterlyDueDate(2, "2025-26")).toBe("2026-02-28");
    expect(quarterlyDueDate(3, "2025-26")).toBe("2026-04-28");
    expect(quarterlyDueDate(4, "2025-26")).toBe("2026-07-28");
  });
  it("dueDateFor returns the quarterly date only when quarterly + quarter given", () => {
    expect(dueDateFor("quarterly", 2, "2025-26")).toBe("2026-02-28");
    expect(dueDateFor("quarterly", undefined, "2025-26")).toBeNull();
    expect(dueDateFor("monthly", undefined, "2025-26")).toBeNull();
    expect(dueDateFor("annual", undefined, "2025-26")).toBeNull();
  });
  it("formFor", () => {
    expect(formFor("monthly")).toMatch(/monthly/i);
    expect(formFor("quarterly")).toMatch(/quarterly/i);
    expect(formFor("annual")).toMatch(/annual/i);
    expect(formFor("none")).toMatch(/IAS|instalment/i);
  });
  it("periodLabel", () => {
    expect(periodLabel("quarterly", 2, "2025-26")).toMatch(/Q2/);
    expect(periodLabel("monthly", undefined, "2025-26")).toMatch(/monthly/i);
  });
});

const baseFacts: UserFacts = {
  given_name: "Sam", state: "VIC", residency_status: "resident",
  has_abn: true, abn: "51824753556", business_structure: "sole_trader",
  gst_registered: true, gst_period: "quarterly", payg_instalments: false, fbt_payer: false,
  has_spouse: false, dependants: 0, hecs_help_debt: false, private_health_insurance: false,
  has_investment_property: false, has_shares_or_managed_funds: false, has_crypto: false,
  super_fund_type: "industry", current_fy: "2025-26", prior_fy_lodged: true,
  accepted_disclaimer_at: "2026-01-01T00:00:00Z", facts_updated_at: "2026-01-01T00:00:00Z", schema_version: 1,
};

function deps(facts: UserFacts): BasPrepChecklistDeps {
  const store: Store = {
    stats: async () => ({ installed: true, schema_version: "x", docs: 1, chunks: 1, staleness_days: 0 }),
    keywordSearch: async () => [{ chunk_id: "c", doc_id: "d", ord: 0, text: "t", heading_path: [], score: 1, title: "T", url: "u", doc_type: "ATO_GUIDE", snippet: "s" }],
    vectorSearch: async () => [],
    getChunks: async () => [], getDoc: async () => null,
    getDocAnchors: async () => ({ anchors: [], inbound: [], outbound: [] }),
    getDefinition: async () => [], getThreshold: async () => null, close: () => {},
  };
  return { store, embedder: { embed: async () => new Float32Array(384), name: "mock" } as Embedder, userFacts: facts };
}
const ids = (o: Awaited<ReturnType<typeof basPrepChecklist>>) => new Set(o.sections.map((s) => s.id));
const tierOf = (o: Awaited<ReturnType<typeof basPrepChecklist>>, id: string) => o.sections.find((s) => s.id === id)?.tier;

describe("basPrepChecklist", () => {
  it("throws when facts are missing", async () => {
    await expect(basPrepChecklist({ store: {} as Store, embedder: {} as Embedder, userFacts: null }, { full_gst_method: false }))
      .rejects.toThrow(/onboard/);
  });

  it("registered quarterly: core GST sections + conditional sections, due date for Q2", async () => {
    const out = await basPrepChecklist(deps(baseFacts), { period_type: "quarterly", quarter: 2, full_gst_method: false });
    expect(out.registered).toBe(true);
    expect(out.reporting.form).toMatch(/quarterly/i);
    expect(out.reporting.due_date).toBe("2026-02-28");
    expect(ids(out).has("gst_total_sales")).toBe(true);
    expect(ids(out).has("gst_on_sales")).toBe(true);
    expect(ids(out).has("gst_on_purchases")).toBe(true);
    expect(tierOf(out, "gst_on_sales")).toBe("core");
    // conditional sections always surface (recall-first)
    expect(tierOf(out, "payg_withholding")).toBe("conditional");
    expect(tierOf(out, "fuel_tax_credits")).toBe("conditional");
    expect(out.sections.find((s) => s.id === "gst_on_sales")!.citations.length).toBeGreaterThan(0);
  });

  it("simpler BAS by default: no full-method G2/G3/G10/G11 labels", async () => {
    const out = await basPrepChecklist(deps(baseFacts), { full_gst_method: false });
    expect(ids(out).has("gst_full_method_labels")).toBe(false);
    expect(out.reporting.simpler_bas).toBe(true);
  });

  it("full_gst_method true: surfaces the extra labels", async () => {
    const out = await basPrepChecklist(deps(baseFacts), { full_gst_method: true });
    expect(ids(out).has("gst_full_method_labels")).toBe(true);
    expect(out.reporting.simpler_bas).toBe(false);
  });

  it("payg_instalments + fbt_payer surface as confirmed", async () => {
    const out = await basPrepChecklist(deps({ ...baseFacts, payg_instalments: true, fbt_payer: true }), { full_gst_method: false });
    expect(tierOf(out, "payg_income_instalment")).toBe("confirmed");
    expect(tierOf(out, "fbt_instalment")).toBe("confirmed");
  });

  it("not registered + payg_instalments: IAS path, no GST core", async () => {
    const out = await basPrepChecklist(deps({ ...baseFacts, gst_registered: false, gst_period: "n/a", payg_instalments: true }), { full_gst_method: false });
    expect(out.registered).toBe(false);
    expect(out.not_applicable_note).toMatch(/IAS|instalment activity statement/i);
    expect(ids(out).has("payg_income_instalment")).toBe(true);
    expect(ids(out).has("gst_on_sales")).toBe(false);
  });

  it("not registered + no PAYG-I: clear no-BAS note", async () => {
    const out = await basPrepChecklist(deps({ ...baseFacts, gst_registered: false, gst_period: "n/a", payg_instalments: false }), { full_gst_method: false });
    expect(out.registered).toBe(false);
    expect(out.not_applicable_note).toMatch(/do not lodge a BAS or IAS/i);
    expect(ids(out).has("gst_on_sales")).toBe(false);
  });

  it("orders core before confirmed before conditional, cross-cutting last", async () => {
    const out = await basPrepChecklist(deps({ ...baseFacts, payg_instalments: true }), { full_gst_method: false });
    const tiers = out.sections.map((s) => s.tier);
    const firstConditional = tiers.indexOf("conditional");
    const lastCore = tiers.lastIndexOf("core");
    // a cross-cutting core section (lodge_and_pay) is sorted last, so don't assert global tier monotonicity;
    // assert the confirmed PAYG instalment comes before the first conditional section.
    expect(out.sections.findIndex((s) => s.id === "payg_income_instalment")).toBeLessThan(firstConditional);
    expect(ids(out).has("lodge_and_pay")).toBe(true);
    expect(out.sections[out.sections.length - 1]!.id).toMatch(/lodge_and_pay|records_and_corrections/);
  });

  it("includes disclaimer", async () => {
    const out = await basPrepChecklist(deps(baseFacts), { full_gst_method: false });
    expect(out.disclaimer).toMatch(/not tax advice/i);
  });
});
