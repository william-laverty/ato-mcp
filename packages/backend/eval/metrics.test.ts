import { describe, it, expect } from "vitest";
import { recallAtK, reciprocalRank, ndcgAtK, mean } from "./metrics.js";

describe("recallAtK", () => {
  it("is 1 when an expected doc is within top-k", () => {
    expect(recallAtK(["a", "b", "c"], ["c"], 5)).toBe(1);
  });
  it("is 0 when the expected doc is beyond top-k", () => {
    expect(recallAtK(["a", "b", "c"], ["c"], 2)).toBe(0);
  });
  it("is 0 when no expected doc is present", () => {
    expect(recallAtK(["a", "b"], ["z"], 5)).toBe(0);
  });
});

describe("reciprocalRank", () => {
  it("is 1 when expected is first", () => {
    expect(reciprocalRank(["a", "b"], ["a"])).toBe(1);
  });
  it("is 1/2 when expected is second", () => {
    expect(reciprocalRank(["a", "b"], ["b"])).toBe(0.5);
  });
  it("is 0 when absent", () => {
    expect(reciprocalRank(["a", "b"], ["z"])).toBe(0);
  });
});

describe("ndcgAtK", () => {
  it("is 1 when the only expected doc is ranked first", () => {
    expect(ndcgAtK(["a", "b", "c"], ["a"], 3)).toBeCloseTo(1, 10);
  });
  it("is < 1 when the expected doc is ranked lower", () => {
    expect(ndcgAtK(["x", "a"], ["a"], 2)).toBeCloseTo(1 / Math.log2(3), 10);
  });
  it("is 0 when no expected docs appear", () => {
    expect(ndcgAtK(["x", "y"], ["a"], 2)).toBe(0);
  });
  it("normalizes IDCG for multiple expected docs", () => {
    // two expected docs, both in top-2: DCG = 1/log2(2) + 1/log2(3); IDCG same => nDCG = 1
    expect(ndcgAtK(["a", "b", "c"], ["a", "b"], 3)).toBeCloseTo(1, 10);
    // two expected, only "a" present at position 1 (0-indexed 1):
    // DCG = 1/log2(3); IDCG (2 ideal hits) = 1/log2(2)+1/log2(3); nDCG = DCG/IDCG
    const dcg = 1 / Math.log2(3);
    const idcg = 1 / Math.log2(2) + 1 / Math.log2(3);
    expect(ndcgAtK(["x", "a", "y"], ["a", "b"], 3)).toBeCloseTo(dcg / idcg, 10);
  });
});

describe("mean", () => {
  it("averages", () => {
    expect(mean([0, 1, 1, 0])).toBe(0.5);
  });
  it("is 0 for empty", () => {
    expect(mean([])).toBe(0);
  });
});
