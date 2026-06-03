import { describe, it, expect } from "vitest";
import {
  fyBounds, fyOfDate, nextFy, daysInclusive, daysHeldInFy,
  primeCostSchedule, diminishingValueSchedule, capitalWorksSchedule, sbePoolSchedule,
} from "../../src/tools/depreciation_helper.js";

describe("date helpers", () => {
  it("fyBounds", () => {
    expect(fyBounds("2025-26")).toEqual({ start: "2025-07-01", end: "2026-06-30" });
  });
  it("fyOfDate", () => {
    expect(fyOfDate("2025-07-01")).toBe("2025-26");
    expect(fyOfDate("2026-06-30")).toBe("2025-26");
    expect(fyOfDate("2026-01-15")).toBe("2025-26");
    expect(fyOfDate("2025-06-30")).toBe("2024-25");
  });
  it("nextFy", () => { expect(nextFy("2025-26")).toBe("2026-27"); });
  it("daysInclusive", () => {
    expect(daysInclusive("2025-07-01", "2026-06-30")).toBe(365);
    expect(daysInclusive("2025-07-01", "2025-07-01")).toBe(1);
  });
  it("daysHeldInFy prorates the first year", () => {
    expect(daysHeldInFy("2025-26", "2025-07-01")).toBe(365);
    expect(daysHeldInFy("2026-27", "2025-07-01")).toBe(365); // full later year
    expect(daysHeldInFy("2025-26", "2026-01-01")).toBe(181); // 1 Jan→30 Jun inclusive
  });
});

describe("primeCostSchedule", () => {
  it("even $200/yr over 5 years for a $1000 asset acquired at FY start", () => {
    const s = primeCostSchedule(1000, 5, "2025-07-01", 100, 5);
    expect(s).toHaveLength(5);
    expect(s[0]!.fy).toBe("2025-26");
    expect(s[0]!.deduction).toBe(200);
    expect(s[4]!.closing_adjustable_value).toBe(0);
    expect(s.reduce((a, r) => a + r.deduction, 0)).toBeCloseTo(1000, 1);
  });
  it("applies business_use_pct to the deduction but not the adjustable value", () => {
    const s = primeCostSchedule(1000, 5, "2025-07-01", 50, 1);
    expect(s[0]!.decline_in_value).toBe(200);
    expect(s[0]!.deduction).toBe(100);
    expect(s[0]!.closing_adjustable_value).toBe(800);
  });
});

describe("diminishingValueSchedule", () => {
  it("front-loads at 200%/life", () => {
    const s = diminishingValueSchedule(1000, 5, "2025-07-01", 100, 3);
    expect(s[0]!.deduction).toBe(400);          // 1000 * 2/5
    expect(s[1]!.opening_adjustable_value).toBe(600);
    expect(s[1]!.deduction).toBe(240);          // 600 * 2/5
  });
});

describe("capitalWorksSchedule", () => {
  it("2.5% of construction cost per year", () => {
    const s = capitalWorksSchedule(200000, "2025-07-01", 100, 0.025, 40);
    expect(s[0]!.deduction).toBe(5000);
    expect(s).toHaveLength(40);
  });
});

describe("sbePoolSchedule", () => {
  it("15% first year then 30% of the opening balance", () => {
    const s = sbePoolSchedule(10000, 100, 3);
    expect(s[0]!.deduction).toBe(1500);          // 15%
    expect(s[1]!.deduction).toBe(2550);          // 30% of 8500
  });
});

import { depreciationHelper } from "../../src/tools/depreciation_helper.js";
import type { DepreciationHelperDeps } from "../../src/tools/depreciation_helper.js";
import type { Store } from "../../src/store/types.js";
import type { Embedder } from "../../src/embed/types.js";
import type { UserFacts } from "../../src/facts.js";

const baseFacts: UserFacts = {
  given_name: "Sam", state: "VIC", residency_status: "resident",
  has_abn: false, business_structure: "none", gst_registered: false, gst_period: "n/a",
  payg_instalments: false, fbt_payer: false, has_spouse: false, dependants: 0,
  hecs_help_debt: false, private_health_insurance: false, has_investment_property: false,
  has_shares_or_managed_funds: false, has_crypto: false, super_fund_type: "industry",
  current_fy: "2025-26", prior_fy_lodged: true,
  accepted_disclaimer_at: "2026-01-01T00:00:00Z", facts_updated_at: "2026-01-01T00:00:00Z", schema_version: 1,
};

function deps(facts: UserFacts, iawoValue: number | null = 20000): DepreciationHelperDeps {
  const store: Store = {
    stats: async () => ({ installed: true, schema_version: "x", docs: 1, chunks: 1, staleness_days: 0 }),
    keywordSearch: async () => [{ chunk_id: "c", doc_id: "d", ord: 0, text: "t", heading_path: [], score: 1, title: "T", url: "u", doc_type: "ATO_GUIDE", snippet: "s" }],
    vectorSearch: async () => [],
    getChunks: async () => [], getDoc: async () => null,
    getDocAnchors: async () => ({ anchors: [], inbound: [], outbound: [] }),
    getDefinition: async () => [],
    getThreshold: async (name) => iawoValue === null ? null : { name, value: iawoValue, unit: "AUD", effective_from: null, effective_to: null, source_doc_id: null, source_anchor: null },
    close: () => {},
  };
  return { store, embedder: { embed: async () => new Float32Array(384), name: "mock" } as Embedder, userFacts: facts };
}
const ids = (o: Awaited<ReturnType<typeof depreciationHelper>>) => new Set(o.methods.map((m) => m.method));
const unav = (o: Awaited<ReturnType<typeof depreciationHelper>>) => new Set(o.unavailable.map((u) => u.method));

describe("depreciationHelper", () => {
  it("throws when facts are missing", async () => {
    await expect(depreciationHelper({ store: {} as Store, embedder: {} as Embedder, userFacts: null }, { asset_cost: 1000, acquisition_date: "2025-07-01", business_use_pct: 100, is_capital_works: false, method: "both" }))
      .rejects.toThrow(/onboard/);
  });

  it("individual: PC+DV computed, IAWO/pool unavailable, $300 only if cheap", async () => {
    const out = await depreciationHelper(deps(baseFacts), { asset_cost: 1000, acquisition_date: "2025-07-01", business_use_pct: 100, effective_life_years: 5, is_capital_works: false, method: "both" });
    expect(ids(out).has("prime_cost")).toBe(true);
    expect(ids(out).has("diminishing_value")).toBe(true);
    expect(unav(out).has("instant_asset_write_off")).toBe(true);
    expect(ids(out).has("low_cost_immediate_300")).toBe(false); // $1000 > $300
    expect(out.methods.find((m) => m.method === "prime_cost")!.citations.length).toBeGreaterThan(0);
  });

  it("individual cheap asset: $300 immediate eligible", async () => {
    const out = await depreciationHelper(deps(baseFacts), { asset_cost: 250, acquisition_date: "2025-07-01", business_use_pct: 100, effective_life_years: 3, is_capital_works: false, method: "both" });
    expect(ids(out).has("low_cost_immediate_300")).toBe(true);
    expect(out.recommended!.method).toBe("low_cost_immediate_300");
  });

  it("sole trader SBE: IAWO eligible + recommended when under threshold", async () => {
    const facts = { ...baseFacts, business_structure: "sole_trader" as const, has_abn: true, abn: "51824753556" };
    const out = await depreciationHelper(deps(facts), { asset_cost: 5000, acquisition_date: "2025-07-01", business_use_pct: 100, effective_life_years: 5, is_small_business_entity: true, is_capital_works: false, method: "both" });
    expect(ids(out).has("instant_asset_write_off")).toBe(true);
    expect(out.recommended!.method).toBe("instant_asset_write_off");
    expect(unav(out).has("low_cost_immediate_300")).toBe(true); // business → not the $300 rule
  });

  it("sole trader not SBE: IAWO ineligible", async () => {
    const facts = { ...baseFacts, business_structure: "sole_trader" as const, has_abn: true, abn: "51824753556" };
    const out = await depreciationHelper(deps(facts), { asset_cost: 5000, acquisition_date: "2025-07-01", business_use_pct: 100, effective_life_years: 5, is_small_business_entity: false, is_capital_works: false, method: "both" });
    expect(unav(out).has("instant_asset_write_off")).toBe(true);
  });

  it("no effective life: PC+DV unavailable, immediate methods still computed", async () => {
    const out = await depreciationHelper(deps(baseFacts), { asset_cost: 250, acquisition_date: "2025-07-01", business_use_pct: 100, is_capital_works: false, method: "both" });
    expect(unav(out).has("prime_cost")).toBe(true);
    expect(unav(out).has("diminishing_value")).toBe(true);
    expect(ids(out).has("low_cost_immediate_300")).toBe(true);
  });

  it("capital works: Div 43 computed and recommended when only it applies", async () => {
    const out = await depreciationHelper(deps(baseFacts), { asset_cost: 200000, acquisition_date: "2025-07-01", business_use_pct: 100, is_capital_works: true, method: "both" });
    expect(ids(out).has("capital_works_div43")).toBe(true);
    expect(out.recommended!.method).toBe("capital_works_div43");
  });

  it("PC vs DV stays a neutral taxpayer election in recommended", async () => {
    const out = await depreciationHelper(deps(baseFacts), { asset_cost: 5000, acquisition_date: "2025-07-01", business_use_pct: 100, effective_life_years: 5, is_capital_works: false, method: "both" });
    expect(out.recommended!.rationale).toMatch(/taxpayer election|not a recommendation/i);
  });

  it("IAWO threshold unavailable: surfaced ineligible, never fabricated", async () => {
    const facts = { ...baseFacts, business_structure: "sole_trader" as const, has_abn: true, abn: "51824753556" };
    const out = await depreciationHelper(deps(facts, null), { asset_cost: 5000, acquisition_date: "2025-07-01", business_use_pct: 100, effective_life_years: 5, is_small_business_entity: true, is_capital_works: false, method: "both" });
    expect(unav(out).has("instant_asset_write_off")).toBe(true);
  });

  it("includes disclaimer", async () => {
    const out = await depreciationHelper(deps(baseFacts), { asset_cost: 1000, acquisition_date: "2025-07-01", business_use_pct: 100, effective_life_years: 5, is_capital_works: false, method: "both" });
    expect(out.disclaimer).toMatch(/not tax advice/i);
  });

  it("pre-9-May-2006 acquisition: diminishing value unavailable (150% rate not supported), prime cost still computes", async () => {
    const out = await depreciationHelper(deps(baseFacts), { asset_cost: 1000, acquisition_date: "2005-07-01", business_use_pct: 100, effective_life_years: 5, is_capital_works: false, method: "both" });
    expect(unav(out).has("diminishing_value")).toBe(true);
    expect(ids(out).has("prime_cost")).toBe(true);
    const reason = out.unavailable.find((u) => u.method === "diminishing_value")!.reason;
    expect(reason).toMatch(/2006|150/);
  });
});
