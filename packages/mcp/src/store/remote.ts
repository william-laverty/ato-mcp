import type {
  Store, StatsResult, SearchHit, DocResult, AnchorGraph,
  DefinitionRow, ThresholdRow,
} from "@ato-pro/shared";

export class RemoteStore implements Store {
  constructor(private endpoint: string, private token: string) {}

  async stats(): Promise<StatsResult> { return this.post("/v1/stats", {}); }
  async keywordSearch(query: string, k: number, pit?: string) {
    return this.post<SearchHit[]>("/v1/keyword_search", { query, k, pit });
  }
  async vectorSearch(): Promise<SearchHit[]> {
    throw new Error("vectorSearch is server-side in hosted mode; use search() instead");
  }
  async getChunks(chunkIds: string[], neighbours: number, pit?: string) {
    return this.post<SearchHit[]>("/v1/get_chunks_raw", { chunk_ids: chunkIds, neighbours, pit });
  }
  async getDoc(docId: string) { return this.post<DocResult | null>("/v1/get_doc_raw", { doc_id: docId }); }
  async getDocAnchors(docId: string) { return this.post<AnchorGraph>("/v1/get_doc_anchors_raw", { doc_id: docId }); }
  async getDefinition(term: string, pit: string | null) {
    return this.post<DefinitionRow[]>("/v1/get_definition_raw", { term, pit });
  }
  async getThreshold(name: string, pit: string | null) {
    return this.post<ThresholdRow | null>("/v1/get_threshold_raw", { name, pit });
  }
  close(): void {}

  private async post<T>(path: string, body: object): Promise<T> {
    const resp = await fetch(`${this.endpoint}${path}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error(`Backend ${path}: ${resp.status} ${await resp.text()}`);
    return resp.json() as Promise<T>;
  }
}
