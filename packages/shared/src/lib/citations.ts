import type { Store } from "../store/types.js";
import type { Embedder } from "../embed/types.js";
import type { SearchHit } from "../corpus.js";
import { rrfFuse } from "./rrf.js";

export interface Citation {
  chunk_id: string;
  doc_id: string;
  title: string;
  snippet: string;
  score: number;
}

export interface ResolveCitationsOpts {
  k: number;
  pit?: string;
  pinnedDocIds?: string[];
}

// Keyword search cost grows with tsquery lexeme count; long multi-query strings
// were observed hitting Postgres statement timeouts in production under the
// workflow tools' fan-out. Cap the composed query to the strongest seeds.
const MAX_SEED_QUERIES = 2;
const MAX_QUERY_CHARS = 160;

export function composeSeedQuery(seedQueries: string[]): string {
  const parts = seedQueries.map((q) => q.trim()).filter(Boolean).slice(0, MAX_SEED_QUERIES);
  const joined = parts.join("; ");
  return joined.length > MAX_QUERY_CHARS ? joined.slice(0, MAX_QUERY_CHARS) : joined;
}

/**
 * Shared citation-resolution spine for the workflow tools.
 * Runs the same hybrid keyword+vector+RRF flow as `search.ts`, de-dupes by
 * doc_id (keeping the best-ranked chunk per doc), and boosts any pinned
 * doc_ids that surface to the front. Returns at most `k` citations.
 *
 * Resilience: the keyword and vector legs fail independently — if one leg
 * errors (e.g. a statement timeout under load), results from the surviving
 * leg are still returned. Throws only when BOTH legs fail.
 */
export async function resolveCitations(
  deps: { store: Store; embedder: Embedder },
  seedQueries: string[],
  opts: ResolveCitationsOpts,
): Promise<Citation[]> {
  const query = composeSeedQuery(seedQueries);
  if (!query) return [];

  const overFetch = Math.min(Math.max(opts.k * 3, 15), 40);
  const [kwRes, vecRes] = await Promise.allSettled([
    deps.store.keywordSearch(query, overFetch, opts.pit),
    deps.embedder.embed(query).then((v) => deps.store.vectorSearch(v, overFetch, opts.pit)),
  ]);
  if (kwRes.status === "rejected" && vecRes.status === "rejected") {
    throw new Error(`citation resolution failed: ${String((kwRes.reason as Error)?.message ?? kwRes.reason)}`);
  }
  const kw = kwRes.status === "fulfilled" ? kwRes.value : [];
  const vec = vecRes.status === "fulfilled" ? vecRes.value : [];

  const fused = rrfFuse<SearchHit>([kw, vec], (h) => h.chunk_id, 60);
  const pinned = new Set(opts.pinnedDocIds ?? []);
  const ordered = [
    ...fused.filter((h) => pinned.has(h.doc_id)),
    ...fused.filter((h) => !pinned.has(h.doc_id)),
  ];

  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const h of ordered) {
    if (seen.has(h.doc_id)) continue;
    seen.add(h.doc_id);
    out.push({ chunk_id: h.chunk_id, doc_id: h.doc_id, title: h.title, snippet: h.snippet, score: h.score });
    if (out.length >= opts.k) break;
  }
  return out;
}

export interface SafeCitations {
  citations: Citation[];
  degraded: boolean;
}

/**
 * Non-throwing variant for per-item enrichment inside fan-out tools: a failed
 * resolution yields `{ citations: [], degraded: true }` so one slow/failed
 * search never turns a whole tool response into an error. Callers MUST surface
 * degradation explicitly (e.g. a note in the tool output) — never silently.
 */
export async function resolveCitationsSafe(
  deps: { store: Store; embedder: Embedder },
  seedQueries: string[],
  opts: ResolveCitationsOpts,
): Promise<SafeCitations> {
  try {
    return { citations: await resolveCitations(deps, seedQueries, opts), degraded: false };
  } catch {
    return { citations: [], degraded: true };
  }
}

/**
 * Map items through an async fn with at most `limit` in flight, preserving
 * order. Used by the workflow tools to bound their citation fan-out so a
 * burst of concurrent searches doesn't overwhelm the database.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return results;
}
