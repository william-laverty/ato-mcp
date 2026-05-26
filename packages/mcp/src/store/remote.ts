import type {
  Store, StatsResult, SearchHit, DocResult, AnchorGraph,
  DefinitionRow, ThresholdRow,
} from "@ato-pro/shared";

export class RemoteStore implements Store {
  constructor(private endpoint: string, private token: string) {}

  async stats(): Promise<StatsResult> { return this.post("/stats", {}); }
  async keywordSearch(query: string, k: number, pit?: string) {
    return this.post<SearchHit[]>("/keyword_search", { query, k, pit });
  }
  async vectorSearch(): Promise<SearchHit[]> {
    throw new Error("vectorSearch is server-side in hosted mode; use search() instead");
  }
  async getChunks(chunkIds: string[], neighbours: number, pit?: string) {
    return this.post<SearchHit[]>("/get_chunks_raw", { chunk_ids: chunkIds, neighbours, pit });
  }
  async getDoc(docId: string) { return this.post<DocResult | null>("/get_doc_raw", { doc_id: docId }); }
  async getDocAnchors(docId: string) { return this.post<AnchorGraph>("/get_doc_anchors_raw", { doc_id: docId }); }
  async getDefinition(term: string, pit: string | null) {
    return this.post<DefinitionRow[]>("/get_definition_raw", { term, pit });
  }
  async getThreshold(name: string, pit: string | null) {
    return this.post<ThresholdRow | null>("/get_threshold_raw", { name, pit });
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
