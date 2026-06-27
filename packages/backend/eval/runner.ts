import type { Store, Embedder, SearchHit } from "@ato-mcp/shared";
import { search } from "@ato-mcp/shared/tools/search";
import { getDefinition } from "@ato-mcp/shared/tools/get_definition";
import { getThreshold } from "@ato-mcp/shared/tools/get_threshold";
import type { GoldenCase, CaseKind } from "./golden-schema.js";

export interface EvalDeps {
  store: Store;
  embedder: Embedder;
}

export interface CaseResult {
  id: string;
  kind: CaseKind;
  expectedDocs: string[]; // search/definition expected doc_ids; [] for threshold
  rankedDocs: string[];   // search: deduped top-k doc_ids; definition: [resolvedDocId] or []
  exactPass: boolean | null; // definition/threshold pass; null for search
  error: string | null;
}

export function extractRankedDocs(hits: SearchHit[], k: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of hits) {
    if (!seen.has(h.doc_id)) {
      seen.add(h.doc_id);
      out.push(h.doc_id);
    }
    if (out.length >= k) break;
  }
  return out;
}

export async function runCase(deps: EvalDeps, c: GoldenCase, maxK: number): Promise<CaseResult> {
  try {
    if (c.kind === "search") {
      const out = await search(
        { store: deps.store, embedder: deps.embedder },
        { query: c.query, k: maxK, mode: "hybrid" },
      );
      return {
        id: c.id, kind: "search", expectedDocs: c.expected_docs,
        rankedDocs: extractRankedDocs(out.hits, maxK), exactPass: null, error: null,
      };
    }
    if (c.kind === "definition") {
      const out = await getDefinition({ store: deps.store }, { term: c.term });
      const resolved = out.source?.doc_id ? [out.source.doc_id] : [];
      const pass = resolved.length > 0 && c.expected_docs.includes(resolved[0]!);
      return {
        id: c.id, kind: "definition", expectedDocs: c.expected_docs,
        rankedDocs: resolved, exactPass: pass, error: null,
      };
    }
    // threshold
    const row = await getThreshold({ store: deps.store }, { name: c.key });
    const valueOk = c.expected_value === undefined ? true : row.value === c.expected_value;
    return {
      id: c.id, kind: "threshold", expectedDocs: [], rankedDocs: [],
      exactPass: valueOk, error: null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      id: c.id,
      kind: c.kind,
      expectedDocs: c.kind === "threshold" ? [] : c.expected_docs,
      rankedDocs: [],
      exactPass: c.kind === "search" ? null : false,
      error: message,
    };
  }
}
