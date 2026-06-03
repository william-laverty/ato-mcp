import { describe, it, expect } from "vitest";
import { deriveMetrics } from "../../src/tools/audit_risk_check.js";
import { auditRiskCheck } from "../../src/tools/audit_risk_check.js";
import type { AuditRiskCheckDeps } from "../../src/tools/audit_risk_check.js";
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

function deps(facts: UserFacts): AuditRiskCheckDeps {
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
const fired = (o: Awaited<ReturnType<typeof auditRiskCheck>>) => new Set(o.findings.map((f) => f.id));

describe("deriveMetrics", () => {
  it("totals deductions and computes the deduction-to-income %", () => {
    const m = deriveMetrics({ income: 100000, deductions: [{ category: "work-related car", amount: 4000 }, { category: "donations", amount: 500 }] });
    expect(m.total_deductions).toBe(4500);
    expect(m.deduction_to_income_pct).toBeCloseTo(4.5, 5);
  });
  it("sums only WRE-matching categories into wre_total", () => {
    const m = deriveMetrics({ deductions: [{ category: "work-related travel", amount: 2000 }, { category: "rental interest", amount: 9000 }] });
    expect(m.wre_total).toBe(2000);
  });
  it("counts round-number claims (>= $300, multiple of $100)", () => {
    const m = deriveMetrics({ deductions: [{ category: "a", amount: 1000 }, { category: "b", amount: 500 }, { category: "c", amount: 250 }, { category: "d", amount: 320 }] });
    expect(m.round_number_claims).toBe(2); // 1000 and 500 (250 < 300; 320 not multiple of 100)
  });
  it("hasCategory / categoryAmount match on keywords", () => {
    const m = deriveMetrics({ deductions: [{ category: "Working from home", amount: 600 }, { category: "Mobile phone & internet", amount: 300 }] });
    expect(m.hasCategory(["working from home"])).toBe(true);
    expect(m.hasCategory(["phone", "internet"])).toBe(true);
    expect(m.categoryAmount(["phone"])).toBe(300);
  });
  it("nulls when no data", () => {
    const m = deriveMetrics({});
    expect(m.total_deductions).toBeNull();
    expect(m.deduction_to_income_pct).toBeNull();
    expect(m.wre_total).toBe(0);
  });
});

describe("auditRiskCheck", () => {
  it("throws when facts are missing", async () => {
    await expect(auditRiskCheck({ store: {} as Store, embedder: {} as Embedder, userFacts: null }, {}))
      .rejects.toThrow(/onboard/);
  });

  it("flags high WRE relative to income as high", async () => {
    const out = await auditRiskCheck(deps(baseFacts), { income: 60000, deductions: [{ category: "work-related expenses", amount: 12000 }] });
    expect(fired(out).has("wre_high_vs_income")).toBe(true);
    expect(out.findings.find((f) => f.id === "wre_high_vs_income")!.risk_band).toBe("high");
    expect(out.overall_risk).toBe("high");
    expect(out.findings.find((f) => f.id === "wre_high_vs_income")!.citations.length).toBeGreaterThan(0);
  });

  it("flags deductions exceeding income", async () => {
    const out = await auditRiskCheck(deps(baseFacts), { income: 5000, deductions: [{ category: "business", amount: 9000 }] });
    expect(fired(out).has("deductions_exceed_income")).toBe(true);
  });

  it("flags >= 3 round numbers as medium", async () => {
    const out = await auditRiskCheck(deps(baseFacts), { income: 200000, deductions: [{ category: "a", amount: 1000 }, { category: "b", amount: 500 }, { category: "c", amount: 300 }] });
    const f = out.findings.find((x) => x.id === "large_round_numbers")!;
    expect(f.risk_band).toBe("medium");
  });

  it("flags WFH + phone double-dip", async () => {
    const out = await auditRiskCheck(deps(baseFacts), { income: 90000, deductions: [{ category: "working from home", amount: 600 }, { category: "mobile phone and internet", amount: 400 }] });
    expect(fired(out).has("wfh_phone_double")).toBe(true);
  });

  it("flags rental deductions with no rental income as high", async () => {
    const facts = { ...baseFacts, has_investment_property: true };
    const out = await auditRiskCheck(deps(facts), { income: 90000, rental: { interest: 8000, repairs: 1000 } });
    const f = out.findings.find((x) => x.id === "rental_deductions_no_income")!;
    expect(f.risk_band).toBe("high");
  });

  it("flags unreported crypto", async () => {
    const facts = { ...baseFacts, has_crypto: true };
    const out = await auditRiskCheck(deps(facts), { income: 90000, deductions: [{ category: "work-related car", amount: 1000 }] });
    expect(fired(out).has("crypto_unreported")).toBe(true);
  });

  it("clean modest return: no findings, overall low", async () => {
    const out = await auditRiskCheck(deps(baseFacts), { income: 90000, deductions: [{ category: "tax agent fee", amount: 175 }] });
    expect(out.findings.length).toBe(0);
    expect(out.overall_risk).toBe("low");
  });

  it("skips ratio checks and reports them when income is absent", async () => {
    const out = await auditRiskCheck(deps(baseFacts), { deductions: [{ category: "work-related", amount: 5000 }] });
    expect(out.skipped.some((s) => s.id === "wre_high_vs_income")).toBe(true);
  });

  it("includes disclaimer + heuristic note", async () => {
    const out = await auditRiskCheck(deps(baseFacts), { income: 90000 });
    expect(out.disclaimer).toMatch(/not tax advice/i);
    expect(out.notes.join(" ")).toMatch(/heuristic|not an audit/i);
  });

  it("deductions_exceed_income: a non-business individual gets a Div 35 caveat, not a misattribution", async () => {
    const out = await auditRiskCheck(deps(baseFacts), { income: 5000, deductions: [{ category: "work-related", amount: 9000 }] });
    const f = out.findings.find((x) => x.id === "deductions_exceed_income")!;
    expect(f.why_flagged).toMatch(/apply to business activity losses/i);
  });

  it("deductions_exceed_income: a business taxpayer gets the deferral framing", async () => {
    const facts = { ...baseFacts, business_structure: "sole_trader" as const, has_abn: true, abn: "51824753556" };
    const out = await auditRiskCheck(deps(facts), { income: 5000, deductions: [{ category: "business operating", amount: 9000 }] });
    const f = out.findings.find((x) => x.id === "deductions_exceed_income")!;
    expect(f.why_flagged).toMatch(/may defer it/i);
  });

  it("near_300_substantiation fires on total WRE near $300, framed as a total not a per-claim limit", async () => {
    const out = await auditRiskCheck(deps(baseFacts), { income: 90000, deductions: [{ category: "work-related tools", amount: 280 }] });
    const f = out.findings.find((x) => x.id === "near_300_substantiation")!;
    expect(f).toBeDefined();
    expect(f.why_flagged).toMatch(/total/i);
  });
});
