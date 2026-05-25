import type { GetDefinitionInput } from "@ato-pro/shared";
import type { Store } from "../store/types.js";

export interface GetDefinitionDeps {
  store: Store | null;
  wordnetLookup?: (term: string) => Promise<string | null>;
}

export interface GetDefinitionOutput {
  term: string;
  kind: "statutory" | "ordinary";
  source?: { doc_id: string; anchor: string | null; citation: string };
  body: string;
  effective_from?: string | null;
  effective_to?: string | null;
  alternatives?: Array<{ doc_id: string; citation: string; body: string }>;
}

export async function getDefinition(
  deps: GetDefinitionDeps,
  args: GetDefinitionInput,
): Promise<GetDefinitionOutput> {
  if (!deps.store) {
    throw new Error("Corpus not installed. Run `ato-pro-mcp update`.");
  }
  const pit = args.pit ?? new Date().toISOString().slice(0, 10);
  const matches = await deps.store.getDefinition(args.term, pit);
  if (matches.length > 0) {
    const primary = matches[0]!;
    return {
      term: args.term,
      kind: "statutory",
      source: { doc_id: primary.doc_id, anchor: primary.anchor_id, citation: primary.doc_id },
      body: primary.body,
      effective_from: primary.effective_from,
      effective_to: primary.effective_to,
      alternatives: matches.slice(1).map(m => ({ doc_id: m.doc_id, citation: m.doc_id, body: m.body })),
    };
  }
  // Ordinary-meaning fallback
  if (deps.wordnetLookup) {
    const body = await deps.wordnetLookup(args.term);
    if (body) {
      return { term: args.term, kind: "ordinary", body: `${body}\n\n(Source: Open English WordNet 2024, CC-BY 4.0. Not a statutory definition.)` };
    }
  }
  return { term: args.term, kind: "ordinary", body: `No statutory definition found for "${args.term}".` };
}
