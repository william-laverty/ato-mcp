import type { SearchInput, SearchHit } from "@ato-pro/shared";
import type { Store } from "../store/types.js";
import { rrfFuse } from "../lib/rrf.js";

interface EmbedderLike {
  embed(text: string): Promise<Float32Array>;
}

export interface SearchDeps {
  store: Store | null;
  embedder: EmbedderLike;
}

export interface SearchOutput {
  query: string;
  mode: SearchInput["mode"];
  hits: SearchHit[];
}

export async function search(deps: SearchDeps, args: SearchInput): Promise<SearchOutput> {
  if (!deps.store) {
    throw new Error(
      "Corpus not installed. Run `ato-pro-mcp update` to download the latest corpus, then retry.",
    );
  }
  const k = args.k ?? 10;
  const mode = args.mode ?? "hybrid";

  if (mode === "keyword") {
    const hits = await deps.store.keywordSearch(args.query, k);
    return { query: args.query, mode, hits };
  }

  if (mode === "vector") {
    const vec = await deps.embedder.embed(args.query);
    const hits = await deps.store.vectorSearch(vec, k);
    return { query: args.query, mode, hits };
  }

  // hybrid
  const overFetch = Math.min(Math.max(k * 3, 20), 50);
  const [kw, vec] = await Promise.all([
    deps.store.keywordSearch(args.query, overFetch),
    deps.embedder.embed(args.query).then((v) => deps.store!.vectorSearch(v, overFetch)),
  ]);
  const fused = rrfFuse<SearchHit>([kw, vec], (h) => h.chunk_id, 60).slice(0, k);
  return { query: args.query, mode, hits: fused };
}
