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
