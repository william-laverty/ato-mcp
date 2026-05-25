import { describe, it, expect } from "vitest";
import { getUserFacts } from "../../src/tools/get_user_facts.js";
import type { UserFacts } from "../../src/facts.js";

const validFacts: UserFacts = {
  given_name: "Alice",
  state: "NSW",
  residency_status: "resident",
  has_abn: false,
  business_structure: "none",
  gst_registered: false,
  gst_period: "n/a",
  payg_instalments: false,
  fbt_payer: false,
  has_spouse: false,
  dependants: 0,
  hecs_help_debt: false,
  private_health_insurance: false,
  has_investment_property: false,
  has_shares_or_managed_funds: false,
  has_crypto: false,
  super_fund_type: "industry",
  current_fy: "2025-26",
  prior_fy_lodged: true,
  accepted_disclaimer_at: "2026-01-01T00:00:00Z",
  facts_updated_at: "2026-01-01T00:00:00Z",
  schema_version: 1,
};

describe("getUserFacts", () => {
  it("returns facts when present (local mode, config_file)", async () => {
    const out = await getUserFacts(
      { facts: validFacts, fetchedFrom: "config_file", mode: "local" },
      {},
    );
    expect(out.facts.given_name).toBe("Alice");
    expect(out.mode).toBe("local");
    expect(out.fetched_from).toBe("config_file");
  });

  it("returns facts when present (hosted mode, hosted_api)", async () => {
    const out = await getUserFacts(
      { facts: validFacts, fetchedFrom: "hosted_api", mode: "hosted" },
      {},
    );
    expect(out.facts.given_name).toBe("Alice");
    expect(out.mode).toBe("hosted");
    expect(out.fetched_from).toBe("hosted_api");
  });

  it("throws a clear error mentioning onboard when facts is null (local)", async () => {
    await expect(
      getUserFacts({ facts: null, fetchedFrom: "config_file", mode: "local" }, {}),
    ).rejects.toThrow(/onboard/);
  });

  it("throws a clear error mentioning onboard when facts is null (hosted)", async () => {
    await expect(
      getUserFacts({ facts: null, fetchedFrom: "hosted_api", mode: "hosted" }, {}),
    ).rejects.toThrow(/onboard/);
  });

  it("returns the full facts object unchanged", async () => {
    const out = await getUserFacts(
      { facts: validFacts, fetchedFrom: "config_file", mode: "local" },
      {},
    );
    expect(out.facts).toEqual(validFacts);
  });

  it("ignores _args parameter", async () => {
    // passing unexpected args should be silently ignored
    const out = await getUserFacts(
      { facts: validFacts, fetchedFrom: "config_file", mode: "local" },
      { unexpected: "data" },
    );
    expect(out.facts.given_name).toBe("Alice");
  });
});
