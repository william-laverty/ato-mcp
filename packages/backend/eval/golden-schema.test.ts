import { describe, it, expect } from "vitest";
import { GoldenSetSchema, GoldenCaseSchema } from "./golden-schema.js";

describe("golden-schema", () => {
  it("accepts a valid search case", () => {
    const c = { id: "wfh", kind: "search", query: "working from home deductions", expected_docs: ["ato:home-office"] };
    expect(() => GoldenCaseSchema.parse(c)).not.toThrow();
  });

  it("accepts a valid definition case", () => {
    const c = { id: "trading-stock", kind: "definition", term: "trading stock", expected_docs: ["legis:itaa1997-70-10"] };
    expect(() => GoldenCaseSchema.parse(c)).not.toThrow();
  });

  it("accepts a valid threshold case", () => {
    const c = { id: "gst-reg", kind: "threshold", key: "gst_registration_threshold", expected_value: 75000 };
    expect(() => GoldenCaseSchema.parse(c)).not.toThrow();
  });

  it("rejects a search case with empty expected_docs", () => {
    const c = { id: "bad", kind: "search", query: "x", expected_docs: [] };
    expect(() => GoldenCaseSchema.parse(c)).toThrow();
  });

  it("rejects an unknown kind", () => {
    const c = { id: "bad", kind: "fuzzy", query: "x", expected_docs: ["a"] };
    expect(() => GoldenCaseSchema.parse(c)).toThrow();
  });

  it("GoldenSetSchema requires at least one case", () => {
    expect(() => GoldenSetSchema.parse([])).toThrow();
  });
});
