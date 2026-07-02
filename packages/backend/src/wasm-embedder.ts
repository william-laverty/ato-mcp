// WasmEmbedder — loads @xenova/transformers in Vercel's Node/WASM runtime.
//
// The model is cached in-module after the first WasmEmbedder.load() call so
// that subsequent requests in the same Vercel function instance are fast.

import type { Embedder } from "@ato-mcp/shared";

type PipelineCtor = (task: string, model: string) => Promise<PipelineFn>;
type PipelineFn = (
  input: string,
  opts: { pooling?: "mean" | "cls"; normalize?: boolean },
) => Promise<TensorLike>;
interface TensorLike {
  data: Float32Array;
  dims: number[];
}

let cached: WasmEmbedder | null = null;

export class WasmEmbedder implements Embedder {
  private pipeline: PipelineFn;
  private modelName: string;

  private constructor(pipeline: PipelineFn, modelName: string) {
    this.pipeline = pipeline;
    this.modelName = modelName;
  }

  // -------------------------------------------------------------------------
  // load — resolves immediately if already cached, otherwise downloads model.
  // MiniLM-L6-v2 (384-dim) — must match the model the Supabase corpus was
  // embedded with; mismatch makes vector search return garbage.
  // -------------------------------------------------------------------------
  static async load(
    modelName = "Xenova/all-MiniLM-L6-v2",
  ): Promise<WasmEmbedder> {
    if (cached && cached.modelName === modelName) return cached;

    // Tests set MOCK_SUPABASE=1 to skip the ~25MB model download.
    // Returns a zero-vector stub — vector search returns nothing useful, but
    // keyword + RRF still produces a sensible response shape for unit tests.
    if (process.env["MOCK_SUPABASE"] === "1") {
      const stubPipeline: PipelineFn = async () => ({
        data: new Float32Array(384),
        dims: [1, 384],
      });
      cached = new WasmEmbedder(stubPipeline, `${modelName}#mock`);
      return cached;
    }

    const mod = await import("@xenova/transformers");

    // Vercel functions have a read-only filesystem except for /tmp.
    // Point the transformers cache there so model downloads don't fail
    // silently with "An error occurred while writing to ..." warnings.
    const env = (mod as unknown as { env: Record<string, unknown> }).env;
    if (env) {
      env.cacheDir = "/tmp/transformers-cache";
      env.useFSCache = true;
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
    }

    const pipelineFn = (
      mod as unknown as { pipeline: PipelineCtor }
    ).pipeline;
    const pipeline = await pipelineFn("feature-extraction", modelName);
    cached = new WasmEmbedder(pipeline, modelName);
    return cached;
  }

  async embed(text: string): Promise<Float32Array> {
    const out = await this.pipeline(text, { pooling: "mean", normalize: true });
    return new Float32Array(out.data);
  }

  get name(): string {
    return this.modelName;
  }
}
