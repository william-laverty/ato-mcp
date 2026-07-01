// OpenAIEmbedder — query-time embedding via the OpenAI embeddings API.
// Model + dims come from env so the serving source doesn't hardcode the choice.
// MOCK_SUPABASE=1 returns a zero vector (no network) for tests.

import type { Embedder } from "@ato-mcp/shared";

const DEFAULT_MODEL = "text-embedding-3-large";
const DEFAULT_DIMS = 3072;

let cached: OpenAIEmbedder | null = null;

export class OpenAIEmbedder implements Embedder {
  private readonly apiKey: string | null;
  private readonly model: string;
  private readonly dims: number;
  private readonly mock: boolean;

  private constructor(apiKey: string | null, model: string, dims: number, mock: boolean) {
    this.apiKey = apiKey;
    this.model = model;
    this.dims = dims;
    this.mock = mock;
  }

  static async load(): Promise<OpenAIEmbedder> {
    const model = process.env["OPENAI_EMBED_MODEL"] ?? DEFAULT_MODEL;
    const dims = Number(process.env["OPENAI_EMBED_DIMS"] ?? DEFAULT_DIMS);
    if (cached && cached.model === model && cached.dims === dims) return cached;

    if (process.env["MOCK_SUPABASE"] === "1") {
      cached = new OpenAIEmbedder(null, model, dims, true);
      return cached;
    }
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    cached = new OpenAIEmbedder(apiKey, model, dims, false);
    return cached;
  }

  async embed(text: string): Promise<Float32Array> {
    if (this.mock) return new Float32Array(this.dims);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: this.model, input: text, dimensions: this.dims }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return new Float32Array(json.data[0]!.embedding);
  }

  get name(): string {
    return this.model;
  }
}
