import { describe, it, expect } from "vitest";
import { scoreResults, diffBaseline } from "./report.js";
import type { CaseResult } from "./runner.js";

const search = (id: string, ranked: string[], expected: string[]): CaseResult => ({
  id, kind: "search", expectedDocs: expected, rankedDocs: ranked, exactPass: null, error: null,
});
const exact = (id: string, pass: boolean): CaseResult => ({
  id, kind: "definition", expectedDocs: ["x"], rankedDocs: pass ? ["x"] : [], exactPass: pass, error: null,
});

describe("scoreResults", () => {
  it("computes recall/ndcg per k and a single MRR, plus exact pass rate", () => {
    const results = [
      search("s1", ["a", "b"], ["a"]),   // recall@5=1, rr=1
      search("s2", ["c", "d"], ["z"]),   // recall@5=0, rr=0
      exact("e1", true),
      exact("e2", false),
    ];
    const agg = scoreResults(results, [5, 10]);
    expect(agg.searchCount).toBe(2);
    expect(agg.perK["5"].recall).toBe(0.5);
    expect(agg.mrr).toBe(0.5);
    expect(agg.exactCount).toBe(2);
    expect(agg.exactPassRate).toBe(0.5);
    expect(agg.errorCount).toBe(0);
  });

  it("counts errored cases", () => {
    const r: CaseResult = { id: "e", kind: "search", expectedDocs: ["a"], rankedDocs: [], exactPass: null, error: "boom" };
    expect(scoreResults([r], [5]).errorCount).toBe(1);
  });
});

describe("diffBaseline", () => {
  const agg = { searchCount: 1, mrr: 0.5, perK: { "5": { recall: 0.5, ndcg: 0.5 } }, exactCount: 0, exactPassRate: 1, errorCount: 0 };

  it("flags a regression beyond tolerance", () => {
    const base = { mrr: 0.6, perK: { "5": { recall: 0.5, ndcg: 0.5 } }, exactPassRate: 1 };
    const { regressed } = diffBaseline(agg, base, 0.02);
    expect(regressed).toBe(true);
  });

  it("does not flag within tolerance", () => {
    const base = { mrr: 0.51, perK: { "5": { recall: 0.5, ndcg: 0.5 } }, exactPassRate: 1 };
    const { regressed } = diffBaseline(agg, base, 0.02);
    expect(regressed).toBe(false);
  });

  it("does not flag improvements", () => {
    const base = { mrr: 0.3, perK: { "5": { recall: 0.3, ndcg: 0.3 } }, exactPassRate: 1 };
    const { regressed } = diffBaseline(agg, base, 0.02);
    expect(regressed).toBe(false);
  });
});
