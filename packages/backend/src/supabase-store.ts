import type {
  Store,
  StatsResult,
  SearchHit,
  DocResult,
  AnchorGraph,
  DefinitionRow,
  ThresholdRow,
  AnchorRow,
  CitationRow,
} from "@ato-mcp/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { makeServiceClient } from "./supabase.js";

// ---------------------------------------------------------------------------
// SupabaseStore — implements the shared Store interface against Supabase Postgres.
// Each read method delegates to a Postgres RPC function (defined in migrations/).
// In mock mode (MOCK_SUPABASE=1 or no credentials) the underlying client returns
// canned empty responses — sufficient for unit tests.
// ---------------------------------------------------------------------------

export class SupabaseStore implements Store {
  private sb: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.sb = client ?? makeServiceClient();
  }

  // -------------------------------------------------------------------------
  // stats
  // -------------------------------------------------------------------------
  async stats(): Promise<StatsResult> {
    // In mock mode the counts come back as 0 from the mock client.
    // In real mode we hit the DB twice in parallel.
    const [docsRes, chunksRes] = await Promise.all([
      (this.sb.from("docs") as ReturnType<SupabaseClient["from"]>)
        .select("*", { count: "exact", head: true }),
      (this.sb.from("chunks") as ReturnType<SupabaseClient["from"]>)
        .select("*", { count: "exact", head: true }),
    ]);
    const docsCount = (docsRes as { count: number | null }).count ?? 0;
    const chunksCount = (chunksRes as { count: number | null }).count ?? 0;
    return {
      installed: true,
      schema_version: "0.3.0",
      docs: docsCount,
      chunks: chunksCount,
      staleness_days: null,
    };
  }

  // -------------------------------------------------------------------------
  // keywordSearch
  // -------------------------------------------------------------------------
  async keywordSearch(query: string, k: number, pit?: string): Promise<SearchHit[]> {
    const { data, error } = await this.sb.rpc("ato_keyword_search", {
      q: query,
      k,
      pit_date: pit ?? null,
    });
    if (error) throw new Error(`keywordSearch: ${(error as { message: string }).message}`);
    return ((data as SearchHit[] | null) ?? []) as SearchHit[];
  }

  // -------------------------------------------------------------------------
  // vectorSearch
  // -------------------------------------------------------------------------
  async vectorSearch(vector: Float32Array, k: number, pit?: string): Promise<SearchHit[]> {
    const { data, error } = await this.sb.rpc("ato_vector_search", {
      q_embedding: Array.from(vector),
      k,
      pit_date: pit ?? null,
    });
    if (error) throw new Error(`vectorSearch: ${(error as { message: string }).message}`);
    return ((data as SearchHit[] | null) ?? []) as SearchHit[];
  }

  // -------------------------------------------------------------------------
  // getChunks
  // -------------------------------------------------------------------------
  async getChunks(chunkIds: string[], neighbours: number, pit?: string): Promise<SearchHit[]> {
    const { data, error } = await this.sb.rpc("ato_get_chunks", {
      chunk_ids: chunkIds,
      neighbours,
      pit_date: pit ?? null,
    });
    if (error) throw new Error(`getChunks: ${(error as { message: string }).message}`);
    return ((data as SearchHit[] | null) ?? []) as SearchHit[];
  }

  // -------------------------------------------------------------------------
  // getDoc
  // -------------------------------------------------------------------------
  async getDoc(docId: string): Promise<DocResult | null> {
    const { data, error } = await this.sb.rpc("ato_get_doc", { doc_id: docId });
    if (error) throw new Error(`getDoc: ${(error as { message: string }).message}`);
    if (!data) return null;
    // RPC returns { doc, cleaned_html, anchors }
    return data as DocResult;
  }

  // -------------------------------------------------------------------------
  // getDocAnchors
  // -------------------------------------------------------------------------
  async getDocAnchors(docId: string): Promise<AnchorGraph> {
    const { data, error } = await this.sb.rpc("ato_get_doc_anchors", { doc_id: docId });
    if (error) throw new Error(`getDocAnchors: ${(error as { message: string }).message}`);
    if (!data) return { anchors: [], inbound: [], outbound: [] };
    const d = data as { anchors?: AnchorRow[]; inbound?: CitationRow[]; outbound?: CitationRow[] };
    return {
      anchors: d.anchors ?? [],
      inbound: d.inbound ?? [],
      outbound: d.outbound ?? [],
    };
  }

  // -------------------------------------------------------------------------
  // getDefinition
  // -------------------------------------------------------------------------
  async getDefinition(term: string, pit: string | null): Promise<DefinitionRow[]> {
    const { data, error } = await this.sb.rpc("ato_get_definition", {
      p_term: term,
      pit_date: pit,
    });
    if (error) throw new Error(`getDefinition: ${(error as { message: string }).message}`);
    return ((data as DefinitionRow[] | null) ?? []) as DefinitionRow[];
  }

  // -------------------------------------------------------------------------
  // getThreshold
  // -------------------------------------------------------------------------
  async getThreshold(name: string, pit: string | null): Promise<ThresholdRow | null> {
    const { data, error } = await this.sb.rpc("ato_get_threshold", {
      p_name: name,
      pit_date: pit,
    });
    if (error) throw new Error(`getThreshold: ${(error as { message: string }).message}`);
    if (!data) return null;
    return data as ThresholdRow;
  }

  // -------------------------------------------------------------------------
  // close — no-op for Supabase (HTTP client, no persistent connection)
  // -------------------------------------------------------------------------
  close(): void {}
}
