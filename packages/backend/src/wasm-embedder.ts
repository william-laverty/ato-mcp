// WasmEmbedder — loads @xenova/transformers in Vercel's Node/WASM runtime.
// Mirrors OnnxEmbedder in packages/mcp/src/embed/onnx.ts but lives in the
// backend package so it can be imported without pulling in better-sqlite3 etc.
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
  // The default model is the same Xenova/all-MiniLM-L6-v2 used by the MCP.
  // When the corpus is rebuilt with Granite Small R2 (v0.3 Phase B), change
  // DEFAULT_MODEL to "Xenova/granite-embedding-small-english-r2".
  // -------------------------------------------------------------------------
  static async load(
    modelName = "Xenova/all-MiniLM-L6-v2",
  ): Promise<WasmEmbedder> {
    if (cached && cached.modelName === modelName) return cached;

    const mod = await import("@xenova/transformers");
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
