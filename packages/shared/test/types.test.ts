import { describe, it, expect } from "vitest";
import { DocSchema, ChunkSchema, SearchInputSchema } from "../src/index.js";

describe("DocSchema", () => {
  it("parses a valid doc", () => {
    const doc = {
      doc_id: "ato:individuals/deductions",
      source: "ato",
      url: "https://www.ato.gov.au/individuals/deductions",
      title: "Deductions you can claim",
      jurisdiction: "AU",
      doc_type: "ATO_GUIDE",
      published_at: "2024-07-01T00:00:00Z",
      retrieved_at: "2026-05-25T00:00:00Z",
      metadata: {},
    };
    const parsed = DocSchema.parse(doc);
    expect(parsed.doc_id).toBe("ato:individuals/deductions");
  });

  it("rejects a doc missing doc_id", () => {
    expect(() => DocSchema.parse({ source: "ato", url: "x", title: "y" })).toThrow();
  });
});

describe("ChunkSchema", () => {
  it("parses a chunk with an embedding", () => {
    const chunk = {
      chunk_id: "ato:individuals/deductions#0",
      doc_id: "ato:individuals/deductions",
      ord: 0,
      text: "Hello world",
      heading_path: ["Deductions"],
      char_start: 0,
      char_end: 11,
    };
    const parsed = ChunkSchema.parse(chunk);
    expect(parsed.ord).toBe(0);
  });
});

describe("SearchInputSchema", () => {
  it("applies defaults", () => {
    const parsed = SearchInputSchema.parse({ query: "fuel tax" });
    expect(parsed.k).toBe(10);
    expect(parsed.mode).toBe("hybrid");
    expect(parsed.include_old).toBe(false);
  });

  it("rejects empty query", () => {
    expect(() => SearchInputSchema.parse({ query: "" })).toThrow();
  });
});
