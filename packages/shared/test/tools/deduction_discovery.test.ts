import { describe, it, expect } from "vitest";
import { evalPredicate, categoryApplies, dedupe } from "../../src/tools/deduction_discovery.js";
import type { DeductionCategory } from "../../src/tools/deduction_discovery.js";
import type { UserFacts } from "../../src/facts.js";

const baseFacts: UserFacts = {
  given_name: "Alice", state: "NSW", residency_status: "resident",
  has_abn: false, business_structure: "none",
  gst_registered: false, gst_period: "n/a", payg_instalments: false, fbt_payer: false,
  has_spouse: false, dependants: 0, hecs_help_debt: false, private_health_insurance: false,
  has_investment_property: false, has_shares_or_managed_funds: false, has_crypto: false,
  super_fund_type: "industry", current_fy: "2025-26", prior_fy_lodged: true,
  accepted_disclaimer_at: "2026-01-01T00:00:00Z", facts_updated_at: "2026-01-01T00:00:00Z", schema_version: 1,
};

function cat(over: Partial<DeductionCategory>): DeductionCategory {
  return {
    id: "x", label: "X", kind: "deduction", structures: ["none"], return_context: "personal",
    triggers: [], seed_queries: ["q"], seed_doc_ids: [], thresholds: [],
    examples: [], substantiation: "", consider_prompt: "", ato_focus_area: false, legal_basis: "s 8-1",
    ...over,
  };
}

describe("evalPredicate", () => {
  it("truthy / falsy", () => {
    expect(evalPredicate({ ...baseFacts, has_crypto: true }, { field: "has_crypto", op: "truthy" })).toBe(true);
    expect(evalPredicate(baseFacts, { field: "has_crypto", op: "truthy" })).toBe(false);
    expect(evalPredicate(baseFacts, { field: "has_abn", op: "falsy" })).toBe(true);
  });
  it("eq", () => {
    expect(evalPredicate({ ...baseFacts, super_fund_type: "smsf" }, { field: "super_fund_type", op: "eq", value: "smsf" })).toBe(true);
    expect(evalPredicate(baseFacts, { field: "super_fund_type", op: "eq", value: "smsf" })).toBe(false);
  });
});

describe("categoryApplies", () => {
  it("requires structure membership", () => {
    expect(categoryApplies({ ...baseFacts, business_structure: "company" }, cat({ structures: ["none"] }))).toBe(false);
    expect(categoryApplies(baseFacts, cat({ structures: ["none"] }))).toBe(true);
  });
  it("requires all triggers to pass", () => {
    const c = cat({ structures: ["none"], triggers: [{ field: "has_investment_property", op: "truthy" }] });
    expect(categoryApplies(baseFacts, c)).toBe(false);
    expect(categoryApplies({ ...baseFacts, has_investment_property: true }, c)).toBe(true);
  });
});

describe("dedupe", () => {
  it("collapses rows sharing a dedupe_key, keeping the most structure-specific", () => {
    const broad = cat({ id: "broad", dedupe_key: "k", structures: ["sole_trader", "none", "company", "trust", "partnership"], triggers: [] });
    const specific = cat({ id: "specific", dedupe_key: "k", structures: ["sole_trader"], triggers: [{ field: "has_abn", op: "truthy" }] });
    const out = dedupe([broad, specific]);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe("specific");
  });
  it("keeps rows without a dedupe_key", () => {
    const out = dedupe([cat({ id: "a" }), cat({ id: "b" })]);
    expect(out.map((c) => c.id)).toEqual(["a", "b"]);
  });
});
