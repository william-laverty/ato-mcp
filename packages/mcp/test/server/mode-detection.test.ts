import { describe, it, expect } from "vitest";
import { buildServerForTesting } from "../../src/server.js";

const stubEmbedder = { embed: async () => new Float32Array(384), name: "stub" };

describe("buildServerForTesting", () => {
  it("uses null store when no corpus installed (local mode)", () => {
    const server = buildServerForTesting({ store: null, embedder: stubEmbedder });
    expect(server.listToolNames()).toContain("stats");
    expect(server.listToolNames()).toContain("search");
    server.close();
  });

  it("stats returns installed=false when store is null", async () => {
    const server = buildServerForTesting({ store: null, embedder: stubEmbedder });
    const out = await server.callTool("stats", {}) as { installed: boolean };
    expect(out.installed).toBe(false);
    server.close();
  });
});
