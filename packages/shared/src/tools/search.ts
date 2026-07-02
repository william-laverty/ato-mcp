import type { SearchInput } from "../tools.js";
import type { SearchHit } from "../corpus.js";
import type { Store } from "../store/types.js";
import type { Embedder } from "../embed/types.js";
import { rrfFuse } from "../lib/rrf.js";

export interface SearchDeps { store: Store | null; embedder: Embedder }
export interface SearchOutput { query: string; mode: SearchInput["mode"]; hits: SearchHit[] }

export async function search(deps: SearchDeps, args: SearchInput): Promise<SearchOutput> {
  if (!deps.store) {
    throw new Error(
      "Corpus unavailable. This is a server-side issue — please try again shortly.",
    );
  }
  const k = args.k ?? 10;
  const mode = args.mode ?? "hybrid";
  const pit = args.pit;

  if (mode === "keyword") {
    const hits = await deps.store.keywordSearch(args.query, k, pit);
    return { query: args.query, mode, hits };
  }

  if (mode === "vector") {
    const vec = await deps.embedder.embed(args.query);
    const hits = await deps.store.vectorSearch(vec, k, pit);
    return { query: args.query, mode, hits };
  }

  // hybrid
  const overFetch = Math.min(Math.max(k * 3, 20), 50);
  const [kw, vec] = await Promise.all([
    deps.store.keywordSearch(args.query, overFetch, pit),
    deps.embedder.embed(args.query).then((v) => deps.store!.vectorSearch(v, overFetch, pit)),
  ]);
  const fused = rrfFuse<SearchHit>([kw, vec], (h) => h.chunk_id, 60).slice(0, k);
  return { query: args.query, mode, hits: fused };
}
