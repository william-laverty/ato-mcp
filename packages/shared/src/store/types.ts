import type { SearchHit, Doc } from "../corpus.js";

export interface StatsResult {
  installed: boolean;
  schema_version: string | null;
  docs: number;
  chunks: number;
  staleness_days: number | null;
}

export interface DefinitionRow {
  term: string;
  doc_id: string;
  anchor_id: string | null;
  body: string;
  effective_from: string | null;
  effective_to: string | null;
}

export interface ThresholdRow {
  name: string;
  value: number;
  unit: string;
  effective_from: string | null;
  effective_to: string | null;
  source_doc_id: string | null;
  source_anchor: string | null;
}

export interface AnchorRow {
  anchor_id: string;
  doc_id: string;
  anchor_name: string;
  chunk_id: string;
}

export interface CitationRow {
  from_chunk_id: string;
  to_doc_id: string;
  to_anchor: string | null;
  citation_kind: string;
}

export interface DocResult {
  doc: Doc;
  cleaned_html: string | null;
  anchors: AnchorRow[];
}

export interface AnchorGraph {
  anchors: AnchorRow[];
  inbound: CitationRow[];
  outbound: CitationRow[];
}

export interface Store {
  stats(): Promise<StatsResult>;
  keywordSearch(query: string, k: number, pit?: string): Promise<SearchHit[]>;
  vectorSearch(vector: Float32Array, k: number, pit?: string): Promise<SearchHit[]>;
  getChunks(chunkIds: string[], neighbours: number, pit?: string): Promise<SearchHit[]>;
  getDoc(docId: string): Promise<DocResult | null>;
  getDocAnchors(docId: string): Promise<AnchorGraph>;
  getDefinition(term: string, pit: string | null): Promise<DefinitionRow[]>;
  getThreshold(name: string, pit: string | null): Promise<ThresholdRow | null>;
  close(): void;
}
