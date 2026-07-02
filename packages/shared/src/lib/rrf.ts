export function rrfFuse<T>(
  rankings: T[][],
  idOf: (item: T) => string,
  k = 60,
  weights?: number[],
): Array<T & { score: number }> {
  const scores = new Map<string, number>();
  const items = new Map<string, T>();
  rankings.forEach((ranking, i) => {
    const w = weights?.[i] ?? 1;
    ranking.forEach((item, rank) => {
      const id = idOf(item);
      const contribution = w / (k + rank + 1);
      scores.set(id, (scores.get(id) ?? 0) + contribution);
      if (!items.has(id)) items.set(id, item);
    });
  });
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ ...(items.get(id) as T), score }));
}
