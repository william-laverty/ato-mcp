import type { GetChunksInput } from "../tools.js";
import type { SearchHit } from "../corpus.js";
import type { Store } from "../store/types.js";

export interface GetChunksDeps {
  store: Store | null;
}

export interface GetChunksOutput {
  chunks: SearchHit[];
}

export async function getChunks(deps: GetChunksDeps, args: GetChunksInput): Promise<GetChunksOutput> {
  if (!deps.store) {
    throw new Error("Corpus unavailable. This is a server-side issue — please try again shortly.");
  }
  const chunks = await deps.store.getChunks(args.chunk_ids, args.neighbours, args.pit);
  return { chunks };
}
