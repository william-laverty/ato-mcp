import { describe, it, expect, beforeEach } from "vitest";
import { RemoteStore } from "../../src/store/remote.js";

describe("RemoteStore", () => {
  beforeEach(() => {
    globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/v1/stats")) {
        return new Response(JSON.stringify({ installed: true, docs: 100, chunks: 1000, schema_version: "0.3.0", staleness_days: null }), { status: 200 });
      }
      if (url.endsWith("/v1/keyword_search")) {
        return new Response(JSON.stringify([{ chunk_id: "x#0", title: "Test", ord: 0, doc_id: "x", text: "y", heading_path: [], score: 0.5, url: "u", doc_type: "ATO_GUIDE", snippet: "y" }]), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    };
  });

  it("forwards stats() to /v1/stats", async () => {
    const r = new RemoteStore("https://api.example", "tok");
    const s = await r.stats();
    expect(s.installed).toBe(true);
    expect(s.docs).toBe(100);
  });

  it("forwards keywordSearch() to /v1/keyword_search", async () => {
    const r = new RemoteStore("https://api.example", "tok");
    const hits = await r.keywordSearch("test", 5);
    expect(hits[0].chunk_id).toBe("x#0");
  });

  it("throws for 404 responses", async () => {
    const r = new RemoteStore("https://api.example", "tok");
    await expect(r.getDoc("missing-doc")).rejects.toThrow(/404/);
  });

  it("vectorSearch throws with hosted-mode message", async () => {
    const r = new RemoteStore("https://api.example", "tok");
    await expect(r.vectorSearch(new Float32Array(384), 5)).rejects.toThrow(/server-side/);
  });
});
