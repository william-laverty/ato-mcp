import { describe, it, expect } from "vitest";
import { resolveCitations } from "../../src/lib/citations.js";
import type { Store } from "../../src/store/types.js";
import type { Embedder } from "../../src/embed/types.js";
import type { SearchHit } from "../../src/corpus.js";

function hit(chunk_id: string, doc_id: string): SearchHit {
  return { chunk_id, doc_id, ord: 0, text: "t", heading_path: [], score: 0, title: `T-${doc_id}`, url: "u", doc_type: "ATO_GUIDE", snippet: `snip-${doc_id}` };
}

function mockStore(kw: SearchHit[], vec: SearchHit[]): Store {
  return {
    stats: async () => ({ installed: true, schema_version: "x", docs: 1, chunks: 1, staleness_days: 0 }),
    keywordSearch: async () => kw,
    vectorSearch: async () => vec,
    getChunks: async () => [],
    getDoc: async () => null,
    getDocAnchors: async () => ({ anchors: [], inbound: [], outbound: [] }),
    getDefinition: async () => [],
    getThreshold: async () => null,
    close: () => {},
  };
}

const mockEmbedder: Embedder = { embed: async () => new Float32Array(384) };

describe("resolveCitations", () => {
  it("returns up to k de-duped citations (one per doc)", async () => {
    const store = mockStore(
      [hit("c1", "d1"), hit("c2", "d2"), hit("c3", "d2")],
      [hit("c4", "d3")],
    );
    const out = await resolveCitations({ store, embedder: mockEmbedder }, ["q"], { k: 3 });
    const docs = out.map((c) => c.doc_id);
    expect(new Set(docs).size).toBe(docs.length); // unique docs
    expect(out.length).toBeLessThanOrEqual(3);
    expect(out[0]).toHaveProperty("chunk_id");
    expect(out[0]).toHaveProperty("snippet");
  });

  it("boosts pinned doc_ids to the front", async () => {
    const store = mockStore([hit("c1", "d1"), hit("c2", "dPIN")], []);
    const out = await resolveCitations({ store, embedder: mockEmbedder }, ["q"], { k: 2, pinnedDocIds: ["dPIN"] });
    expect(out[0]!.doc_id).toBe("dPIN");
  });

  it("returns [] for empty seed queries", async () => {
    const store = mockStore([hit("c1", "d1")], []);
    const out = await resolveCitations({ store, embedder: mockEmbedder }, ["", "  "], { k: 3 });
    expect(out).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Resilience additions (v1.0): per-leg survival, safe wrapper, bounded
// concurrency, and seed-query trimming — added after live statement timeouts.
// ---------------------------------------------------------------------------
import { resolveCitationsSafe, mapWithConcurrency, composeSeedQuery } from "../../src/lib/citations.js";

describe("resolveCitations resilience", () => {
  it("survives a keyword-leg failure and returns vector results", async () => {
    const store = mockStore([], [hit("c9", "d9")]);
    store.keywordSearch = async () => { throw new Error("canceling statement due to statement timeout"); };
    const out = await resolveCitations({ store, embedder: mockEmbedder }, ["q"], { k: 3 });
    expect(out.map((c) => c.doc_id)).toEqual(["d9"]);
  });

  it("survives a vector-leg failure and returns keyword results", async () => {
    const store = mockStore([hit("c8", "d8")], []);
    store.vectorSearch = async () => { throw new Error("timeout"); };
    const out = await resolveCitations({ store, embedder: mockEmbedder }, ["q"], { k: 3 });
    expect(out.map((c) => c.doc_id)).toEqual(["d8"]);
  });

  it("throws only when both legs fail", async () => {
    const store = mockStore([], []);
    store.keywordSearch = async () => { throw new Error("kw down"); };
    store.vectorSearch = async () => { throw new Error("vec down"); };
    await expect(resolveCitations({ store, embedder: mockEmbedder }, ["q"], { k: 3 })).rejects.toThrow(/citation resolution failed/);
  });
});

describe("resolveCitationsSafe", () => {
  it("returns citations with degraded=false on success", async () => {
    const store = mockStore([hit("c1", "d1")], []);
    const out = await resolveCitationsSafe({ store, embedder: mockEmbedder }, ["q"], { k: 2 });
    expect(out.degraded).toBe(false);
    expect(out.citations).toHaveLength(1);
  });

  it("returns empty + degraded=true when both legs fail", async () => {
    const store = mockStore([], []);
    store.keywordSearch = async () => { throw new Error("down"); };
    store.vectorSearch = async () => { throw new Error("down"); };
    const out = await resolveCitationsSafe({ store, embedder: mockEmbedder }, ["q"], { k: 2 });
    expect(out).toEqual({ citations: [], degraded: true });
  });
});

describe("composeSeedQuery", () => {
  it("caps to the first two seeds and 160 chars", () => {
    const long = "x".repeat(120);
    const q = composeSeedQuery([long, long, "third seed should be dropped"]);
    expect(q.length).toBeLessThanOrEqual(160);
    expect(q).not.toContain("third seed");
  });
  it("passes the trimmed query to keywordSearch", async () => {
    let received = "";
    const store = mockStore([], []);
    store.keywordSearch = async (query: string) => { received = query; return []; };
    await resolveCitations({ store, embedder: mockEmbedder }, ["a".repeat(200), "b", "c"], { k: 2 });
    expect(received.length).toBeLessThanOrEqual(160);
  });
});

describe("mapWithConcurrency", () => {
  it("preserves order and bounds in-flight work", async () => {
    let inFlight = 0, peak = 0;
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = await mapWithConcurrency(items, 3, async (n) => {
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5 + (n % 3) * 5));
      inFlight--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });
});
