import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { search } from "../../src/tools/search.js";
import { makeStore } from "../helpers/make-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(__dirname, "..", "fixtures", "seed.sql");

const fakeEmbedder = {
  embed: async (_text: string) => {
    const v = new Float32Array(384);
    v[0] = 1;
    return v;
  },
};

describe("search tool", () => {
  it("keyword mode returns the FTS-matching chunk", async () => {
    const store = makeStore(SEED);
    const out = await search({ store, embedder: fakeEmbedder }, { query: "uniform", k: 5, mode: "keyword", include_old: false });
    expect(out.hits.length).toBeGreaterThan(0);
    expect(out.hits[0].chunk_id).toBe("ato:test/deductions#0");
    expect(out.hits[0].url).toBe("https://www.ato.gov.au/test/deductions");
    store.close();
  });

  it("vector mode returns k hits", async () => {
    const store = makeStore(SEED);
    const out = await search({ store, embedder: fakeEmbedder }, { query: "anything", k: 3, mode: "vector", include_old: false });
    expect(out.hits.length).toBe(3);
    store.close();
  });

  it("hybrid mode merges keyword and vector hits via RRF", async () => {
    const store = makeStore(SEED);
    const out = await search({ store, embedder: fakeEmbedder }, { query: "vehicle", k: 4, mode: "hybrid", include_old: false });
    expect(out.hits.length).toBeGreaterThan(0);
    // vehicle chunk should appear (it's the FTS match)
    expect(out.hits.map((h) => h.chunk_id)).toContain("ato:test/vehicle#0");
    store.close();
  });

  it("errors when store is missing", async () => {
    await expect(
      search({ store: null, embedder: fakeEmbedder }, { query: "x", k: 5, mode: "hybrid", include_old: false }),
    ).rejects.toThrow(/corpus/i);
  });
});
