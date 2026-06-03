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

/**
 * Shared citation-resolution spine for the v0.4 workflow tools.
 * Runs the same hybrid keyword+vector+RRF flow as `search.ts`, de-dupes by
 * doc_id (keeping the best-ranked chunk per doc), and boosts any pinned
 * doc_ids that surface to the front. Returns at most `k` citations.
 */
export async function resolveCitations(
  deps: { store: Store; embedder: Embedder },
  seedQueries: string[],
  opts: ResolveCitationsOpts,
): Promise<Citation[]> {
  const query = seedQueries.map((q) => q.trim()).filter(Boolean).join("; ");
  if (!query) return [];

  const overFetch = Math.min(Math.max(opts.k * 3, 15), 40);
  const [kw, vec] = await Promise.all([
    deps.store.keywordSearch(query, overFetch, opts.pit),
    deps.embedder.embed(query).then((v) => deps.store.vectorSearch(v, overFetch, opts.pit)),
  ]);

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
