import type { GetDocInput } from "../tools.js";
import type { Store, AnchorRow } from "../store/types.js";

export interface GetDocDeps { store: Store | null }
export interface GetDocOutput {
  doc: any;
  cleaned_html: string | null;
  anchors: Array<{ anchor_id: string; anchor_name: string; chunk_id: string }>;
}

export async function getDoc(deps: GetDocDeps, args: GetDocInput): Promise<GetDocOutput> {
  if (!deps.store) throw new Error("Corpus not installed. Run `ato-pro-mcp update`.");
  const out = await deps.store.getDoc(args.doc_id);
  if (!out) throw new Error(`Document not found: ${args.doc_id}`);
  return out;
}
