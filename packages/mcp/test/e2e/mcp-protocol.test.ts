import { describe, it, expect, vi } from "vitest";
import { buildServerForTesting } from "../../src/server.js";

describe("MCP protocol surface", () => {
  it("registers all 13 tools", () => {
    const server = buildServerForTesting({ forwarder: { call: vi.fn() } });
    expect(server.listToolNames().sort()).toEqual(
      ["audit_risk_check", "bas_prep_checklist", "deduction_discovery", "depreciation_helper",
       "fetch", "get_chunks", "get_definition", "get_doc", "get_doc_anchors",
       "get_threshold", "get_user_facts", "search", "stats"].sort(),
    );
  });

  it("forwards stats through the forwarder", async () => {
    const call = vi.fn().mockResolvedValue({ installed: true, docs: 5 });
    const server = buildServerForTesting({ forwarder: { call } });
    const out = await server.callTool("stats", {}) as { installed: boolean };
    expect(out.installed).toBe(true);
    expect(call).toHaveBeenCalledWith("stats", {});
  });
});
