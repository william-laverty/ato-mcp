import type { SearchHit } from "@ato-pro/shared";

export interface Store {
  stats(): Promise<{
    installed: boolean;
    schema_version: string | null;
    docs: number;
    chunks: number;
    staleness_days: number | null;
  }>;
  keywordSearch(query: string, k: number): Promise<SearchHit[]>;
  vectorSearch(vector: Float32Array, k: number): Promise<SearchHit[]>;
  getChunks(chunkIds: string[], neighbours: number): Promise<SearchHit[]>;
  close(): void;
}
