import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeStore } from "./helpers/make-store.js";
import type { SqliteStore } from "../src/store/sqlite.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(__dirname, "fixtures", "seed.sql");

describe("SqliteStore", () => {
  let store: SqliteStore;
  beforeAll(() => {
    store = makeStore(SEED);
  });
  afterAll(() => {
    store.close();
  });

  it("stats() reports docs and chunks", async () => {
    const s = await store.stats();
    expect(s.installed).toBe(true);
    expect(s.docs).toBe(3);
    expect(s.chunks).toBe(4);
    expect(s.schema_version).toBe("0.1.0");
  });

  it("keywordSearch finds chunks by word", async () => {
    const hits = await store.keywordSearch("uniform", 10);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.chunk_id).toBe("ato:test/deductions#0");
  });

  it("vectorSearch returns the requested k", async () => {
    // Use a fake 384-d query vector; all results will be valid since they're normalised
    const q = new Float32Array(384);
    q[0] = 1.0;
    const hits = await store.vectorSearch(q, 3);
    expect(hits.length).toBe(3);
    expect(hits[0]).toHaveProperty("chunk_id");
    expect(hits[0]).toHaveProperty("score");
  });

  it("getChunks returns chunks with metadata joined from docs", async () => {
    const chunks = await store.getChunks(["ato:test/deductions#0"], 0);
    expect(chunks.length).toBe(1);
    expect(chunks[0]!.title).toBe("Deductions you can claim");
    expect(chunks[0]!.url).toBe("https://www.ato.gov.au/test/deductions");
  });

  it("getChunks with neighbours fetches surrounding chunks", async () => {
    const chunks = await store.getChunks(["ato:test/deductions#0"], 1);
    const ids = chunks.map((c) => c.chunk_id);
    expect(ids).toContain("ato:test/deductions#0");
    expect(ids).toContain("ato:test/deductions#1");
  });
});
