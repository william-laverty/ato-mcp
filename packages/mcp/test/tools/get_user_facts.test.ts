import { describe, it, expect } from "vitest";
import { buildServerForTesting } from "../../src/server.js";
import type { UserFacts } from "@ato-pro/shared";

const stubEmbedder = { embed: async () => new Float32Array(384), name: "stub" };

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

describe("get_user_facts MCP tool integration", () => {
  it("returns facts from config in local mode", async () => {
    const server = buildServerForTesting({
      store: null,
      embedder: stubEmbedder,
      facts: validFacts,
      mode: "local",
    });
    const out = await server.callTool("get_user_facts", {});
    expect(out.facts.given_name).toBe("Alice");
    expect(out.mode).toBe("local");
    expect(out.fetched_from).toBe("config_file");
    server.close();
  });

  it("returns hosted_api as fetched_from in hosted mode", async () => {
    const server = buildServerForTesting({
      store: null,
      embedder: stubEmbedder,
      facts: validFacts,
      mode: "hosted",
    });
    const out = await server.callTool("get_user_facts", {});
    expect(out.mode).toBe("hosted");
    expect(out.fetched_from).toBe("hosted_api");
    server.close();
  });

  it("throws when no facts configured", async () => {
    const server = buildServerForTesting({
      store: null,
      embedder: stubEmbedder,
      facts: null,
      mode: "local",
    });
    await expect(server.callTool("get_user_facts", {})).rejects.toThrow(/onboard/);
    server.close();
  });

  it("throws when facts not provided at all (defaults to null)", async () => {
    const server = buildServerForTesting({
      store: null,
      embedder: stubEmbedder,
    });
    await expect(server.callTool("get_user_facts", {})).rejects.toThrow(/onboard/);
    server.close();
  });
});
