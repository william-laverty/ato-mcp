// Single source of truth for the embedding provider flag. Default 'minilm'
// keeps current behaviour; 'openai' switches query embedding + the vector RPC.
export type EmbedProvider = "minilm" | "openai";

export function embedProvider(): EmbedProvider {
  return process.env["EMBED_PROVIDER"] === "openai" ? "openai" : "minilm";
}

export function vectorSearchRpc(): string {
  return embedProvider() === "openai" ? "ato_vector_search_openai" : "ato_vector_search";
}
