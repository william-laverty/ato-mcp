// Pure retrieval-quality metrics. Binary relevance: a doc is relevant iff it
// appears in `expected`. All functions are network-free and deterministic.

export function recallAtK(ranked: string[], expected: string[], k: number): number {
  const top = ranked.slice(0, k);
  return expected.some((e) => top.includes(e)) ? 1 : 0;
}

export function reciprocalRank(ranked: string[], expected: string[]): number {
  for (let i = 0; i < ranked.length; i++) {
    if (expected.includes(ranked[i]!)) return 1 / (i + 1);
  }
  return 0;
}

export function ndcgAtK(ranked: string[], expected: string[], k: number): number {
  const top = ranked.slice(0, k);
  let dcg = 0;
  for (let i = 0; i < top.length; i++) {
    if (expected.includes(top[i]!)) dcg += 1 / Math.log2(i + 2);
  }
  const idealHits = Math.min(expected.length, k);
  let idcg = 0;
  for (let i = 0; i < idealHits; i++) idcg += 1 / Math.log2(i + 2);
  return idcg === 0 ? 0 : dcg / idcg;
}

export function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}
