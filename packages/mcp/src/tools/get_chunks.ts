import type { GetChunksInput, SearchHit } from "@ato-pro/shared";
import type { Store } from "../store/types.js";

export interface GetChunksDeps {
  store: Store | null;
}

export interface GetChunksOutput {
  chunks: SearchHit[];
}

export async function getChunks(deps: GetChunksDeps, args: GetChunksInput): Promise<GetChunksOutput> {
  if (!deps.store) {
    throw new Error("Corpus not installed. Run `ato-pro-mcp update`.");
  }
  const chunks = await deps.store.getChunks(args.chunk_ids, args.neighbours);
  return { chunks };
}
