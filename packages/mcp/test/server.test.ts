import { describe, it, expect, vi } from "vitest";
import { buildServerForTesting } from "../src/server.js";

const ALL_TOOLS = [
  "audit_risk_check", "bas_prep_checklist", "deduction_discovery", "depreciation_helper",
  "fetch", "get_chunks", "get_definition", "get_doc", "get_doc_anchors",
  "get_threshold", "get_user_facts", "search", "stats",
].sort();

describe("hosted MCP server", () => {
  it("lists all 13 tools", () => {
    const srv = buildServerForTesting({ forwarder: { call: vi.fn() } });
    expect(srv.listToolNames().sort()).toEqual(ALL_TOOLS);
  });

  it("forwards a tool call to the forwarder and returns its result", async () => {
    const call = vi.fn().mockResolvedValue({ hits: [], query: "x" });
    const srv = buildServerForTesting({ forwarder: { call } });
    const res = await srv.callTool("search", { query: "x" });
    expect(call).toHaveBeenCalledWith("search", { query: "x" });
    expect(res).toEqual({ hits: [], query: "x" });
  });
});
