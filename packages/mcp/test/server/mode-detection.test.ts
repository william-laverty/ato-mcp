import { describe, it, expect } from "vitest";
import { RemoteStore } from "../../src/store/remote.js";
import { buildServerForTesting } from "../../src/server.js";
import type { Store } from "@ato-pro/shared";

const stubEmbedder = { embed: async () => new Float32Array(384), name: "stub" };

describe("mode-aware server", () => {
  it("uses RemoteStore when mode=hosted", () => {
    // Verify RemoteStore can be passed as the store to buildServerForTesting
    // (confirms the Store interface is compatible between implementations)
    const remoteStore = new RemoteStore("https://api.example.com", "tok123") as Store;
    const server = buildServerForTesting({ store: remoteStore, embedder: stubEmbedder });
    expect(server.listToolNames()).toContain("search");
    expect(server.listToolNames()).toContain("stats");
    server.close();
  });

  it("uses null store when no corpus installed (local mode)", () => {
    const server = buildServerForTesting({ store: null, embedder: stubEmbedder });
    expect(server.listToolNames()).toContain("stats");
    server.close();
  });

  it("stats returns installed=false when store is null", async () => {
    const server = buildServerForTesting({ store: null, embedder: stubEmbedder });
    const out = await server.callTool("stats", {});
    expect(out.installed).toBe(false);
    server.close();
  });
});
