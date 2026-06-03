import { describe, it, expect } from "vitest";
import { buildServerForTesting } from "../src/server.js";
import type { Store, Embedder, UserFacts } from "@ato-mcp/shared";

const facts: UserFacts = {
  given_name: "Alice", state: "NSW", residency_status: "resident",
  has_abn: false, business_structure: "none", gst_registered: false, gst_period: "n/a",
  payg_instalments: false, fbt_payer: false, has_spouse: false, dependants: 0,
  hecs_help_debt: false, private_health_insurance: false, has_investment_property: false,
  has_shares_or_managed_funds: false, has_crypto: false, super_fund_type: "industry",
  current_fy: "2025-26", prior_fy_lodged: true,
  accepted_disclaimer_at: "2026-01-01T00:00:00Z", facts_updated_at: "2026-01-01T00:00:00Z", schema_version: 1,
};

const store: Store = {
  stats: async () => ({ installed: true, schema_version: "x", docs: 1, chunks: 1, staleness_days: 0 }),
  keywordSearch: async () => [],
  vectorSearch: async () => [],
  getChunks: async () => [],
  getDoc: async () => null,
  getDocAnchors: async () => ({ anchors: [], inbound: [], outbound: [] }),
  getDefinition: async () => [],
  getThreshold: async () => null,
  close: () => {},
};
const embedder: Embedder = { embed: async () => new Float32Array(384) };

describe("server: deduction_discovery", () => {
  it("lists the tool", () => {
    const srv = buildServerForTesting({ store, embedder, facts, mode: "local" });
    expect(srv.listToolNames()).toContain("deduction_discovery");
  });
  it("dispatches and returns a structured result", async () => {
    const srv = buildServerForTesting({ store, embedder, facts, mode: "local" });
    const res = await srv.callTool("deduction_discovery", {});
    expect(res).toHaveProperty("categories");
    expect(res).toHaveProperty("disclaimer");
    expect(res.fy).toBe("2025-26");
  });
});

describe("server: depreciation_helper", () => {
  it("lists the tool", () => {
    const srv = buildServerForTesting({ store, embedder, facts, mode: "local" });
    expect(srv.listToolNames()).toContain("depreciation_helper");
  });
  it("dispatches and returns method results", async () => {
    const srv = buildServerForTesting({ store, embedder, facts, mode: "local" });
    const res = await srv.callTool("depreciation_helper", { asset_cost: 1000, acquisition_date: "2025-07-01", effective_life_years: 5 });
    expect(res).toHaveProperty("methods");
    expect(res).toHaveProperty("disclaimer");
    expect(Array.isArray(res.methods)).toBe(true);
  });
});

describe("server: bas_prep_checklist", () => {
  it("lists the tool", () => {
    const srv = buildServerForTesting({ store, embedder, facts, mode: "local" });
    expect(srv.listToolNames()).toContain("bas_prep_checklist");
  });
  it("dispatches and returns a checklist", async () => {
    const gstFacts = { ...facts, has_abn: true, abn: "51824753556", business_structure: "sole_trader" as const, gst_registered: true, gst_period: "quarterly" as const };
    const srv = buildServerForTesting({ store, embedder, facts: gstFacts, mode: "local" });
    const res = await srv.callTool("bas_prep_checklist", { period_type: "quarterly", quarter: 1 });
    expect(res).toHaveProperty("sections");
    expect(res).toHaveProperty("disclaimer");
    expect(res.registered).toBe(true);
  });
});
