import { describe, it, expect } from "vitest";
import { getUserFacts } from "../../src/tools/get_user_facts.js";
import type { UserFacts } from "../../src/facts.js";

const validFacts: UserFacts = {
  given_name: "Alice", state: "NSW", residency_status: "resident",
  has_abn: false, business_structure: "none", gst_registered: false, gst_period: "n/a",
  payg_instalments: false, fbt_payer: false, has_spouse: false, dependants: 0,
  hecs_help_debt: false, private_health_insurance: false, has_investment_property: false,
  has_shares_or_managed_funds: false, has_crypto: false, super_fund_type: "industry",
  current_fy: "2025-26", prior_fy_lodged: true,
  accepted_disclaimer_at: "2026-01-01T00:00:00Z", facts_updated_at: "2026-01-01T00:00:00Z", schema_version: 1,
};

describe("getUserFacts", () => {
  it("returns the facts object when present", async () => {
    const out = await getUserFacts({ facts: validFacts }, {});
    expect(out.facts).toEqual(validFacts);
  });

  it("throws a clear error mentioning onboard when facts is null", async () => {
    await expect(getUserFacts({ facts: null }, {})).rejects.toThrow(/onboard/);
  });

  it("ignores the _args parameter", async () => {
    const out = await getUserFacts({ facts: validFacts }, { unexpected: "data" });
    expect(out.facts.given_name).toBe("Alice");
  });
});
