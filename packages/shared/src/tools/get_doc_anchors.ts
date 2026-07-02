import type { GetDocAnchorsInput } from "../tools.js";
import type { Store } from "../store/types.js";

export interface GetDocAnchorsDeps { store: Store | null }

export async function getDocAnchors(deps: GetDocAnchorsDeps, args: GetDocAnchorsInput) {
  if (!deps.store) throw new Error("Corpus unavailable. This is a server-side issue — please try again shortly.");
  return await deps.store.getDocAnchors(args.doc_id);
}
