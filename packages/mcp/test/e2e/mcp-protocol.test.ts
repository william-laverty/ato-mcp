import { describe, it, expect, vi } from "vitest";
import { buildServerForTesting } from "../../src/server.js";

describe("forwarder seam", () => {
  it("forwards the exact (name, args) and returns the forwarder result", async () => {
    const call = vi.fn().mockResolvedValue({ installed: true, docs: 5 });
    const server = buildServerForTesting({ forwarder: { call } });
    const out = (await server.callTool("stats", { pit: "2025-07-01" })) as { installed: boolean };
    expect(call).toHaveBeenCalledWith("stats", { pit: "2025-07-01" });
    expect(out.installed).toBe(true);
  });

  it("propagates a rejection from the forwarder", async () => {
    const call = vi.fn().mockRejectedValue(new Error("Backend unreachable"));
    const server = buildServerForTesting({ forwarder: { call } });
    await expect(server.callTool("search", { query: "x" })).rejects.toThrow(/Backend unreachable/);
  });
});
