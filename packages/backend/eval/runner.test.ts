import { describe, it, expect } from "vitest";
import type { Store, Embedder, SearchHit } from "@ato-mcp/shared";
import { extractRankedDocs, runCase } from "./runner.js";

const hit = (chunk_id: string, doc_id: string): SearchHit => ({
  chunk_id, doc_id, ord: 0, text: "", heading_path: [], score: 1,
  title: "", url: "http://x", doc_type: "ATO_GUIDE", snippet: "",
});

const stubEmbedder: Embedder = {
  embed: async () => new Float32Array(384),
  get name() { return "stub"; },
};

// Minimal Store stub: only the methods runCase touches need real behaviour.
function makeStore(over: Partial<Store>): Store {
  const notImpl = () => { throw new Error("not implemented"); };
  return {
    stats: notImpl as Store["stats"],
    keywordSearch: (async () => []) as Store["keywordSearch"],
    vectorSearch: (async () => []) as Store["vectorSearch"],
    getChunks: notImpl as Store["getChunks"],
    getDoc: notImpl as Store["getDoc"],
    getDocAnchors: notImpl as Store["getDocAnchors"],
    getDefinition: (async () => []) as Store["getDefinition"],
    getThreshold: (async () => null) as Store["getThreshold"],
    close: () => {},
    ...over,
  };
}

describe("extractRankedDocs", () => {
  it("dedupes by doc_id preserving order and caps at k", () => {
    const hits = [hit("c1", "d1"), hit("c2", "d1"), hit("c3", "d2"), hit("c4", "d3")];
    expect(extractRankedDocs(hits, 2)).toEqual(["d1", "d2"]);
  });
});

describe("runCase: search", () => {
  it("returns deduped ranked doc_ids from keyword+vector legs", async () => {
    const store = makeStore({
      keywordSearch: async () => [hit("c1", "d1"), hit("c2", "d2")],
      vectorSearch: async () => [hit("c3", "d2"), hit("c4", "d3")],
    });
    const r = await runCase({ store, embedder: stubEmbedder }, {
      id: "s1", kind: "search", query: "q", expected_docs: ["d2"],
    }, 10);
    expect(r.kind).toBe("search");
    expect(r.exactPass).toBeNull();
    expect(r.rankedDocs).toContain("d2");
    expect(r.error).toBeNull();
  });
});

describe("runCase: definition", () => {
  it("passes when resolved doc_id matches expected", async () => {
    const store = makeStore({
      getDefinition: async () => [
        { term: "t", doc_id: "legis:def-1", anchor_id: null, body: "b", effective_from: null, effective_to: null },
      ],
    });
    const r = await runCase({ store, embedder: stubEmbedder }, {
      id: "d1", kind: "definition", term: "t", expected_docs: ["legis:def-1"],
    }, 10);
    expect(r.exactPass).toBe(true);
    expect(r.rankedDocs).toEqual(["legis:def-1"]);
  });

  it("fails when no definition resolves", async () => {
    const store = makeStore({ getDefinition: async () => [] });
    const r = await runCase({ store, embedder: stubEmbedder }, {
      id: "d2", kind: "definition", term: "t", expected_docs: ["legis:def-1"],
    }, 10);
    expect(r.exactPass).toBe(false);
  });
});

describe("runCase: threshold", () => {
  it("passes when row found and value matches", async () => {
    const store = makeStore({
      getThreshold: async () => ({
        name: "gst", value: 75000, unit: "AUD",
        effective_from: null, effective_to: null, source_doc_id: null, source_anchor: null,
      }),
    });
    const r = await runCase({ store, embedder: stubEmbedder }, {
      id: "t1", kind: "threshold", key: "gst", expected_value: 75000,
    }, 10);
    expect(r.exactPass).toBe(true);
  });

  it("fails (not throws) when threshold missing", async () => {
    const store = makeStore({
      getThreshold: async () => { throw new Error("Threshold not found: gst"); },
    });
    const r = await runCase({ store, embedder: stubEmbedder }, {
      id: "t2", kind: "threshold", key: "gst",
    }, 10);
    expect(r.exactPass).toBe(false);
    expect(r.error).toContain("Threshold not found");
  });
});
