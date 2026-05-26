type PipelineCtor = (task: string, model: string) => Promise<PipelineFn>;
type PipelineFn = (input: string, opts: { pooling?: "mean" | "cls"; normalize?: boolean }) => Promise<TensorLike>;
interface TensorLike { data: Float32Array; dims: number[] }

export class OnnxEmbedder {
  private pipeline: PipelineFn;
  private modelName: string;

  private constructor(pipeline: PipelineFn, modelName: string) {
    this.pipeline = pipeline;
    this.modelName = modelName;
  }

  // Granite r2 small (ModernBERT, 384-dim). ONNX port by the onnx-community
  // org since Xenova/* doesn't ship Granite. Same dim as MiniLM so the
  // downloaded corpus's vec_chunks need no schema migration.
  static async load(
    modelName = "onnx-community/granite-embedding-small-english-r2-ONNX",
  ): Promise<OnnxEmbedder> {
    // @huggingface/transformers is ESM-only; dynamic import to keep the rest sync-friendly.
    const mod = await import("@huggingface/transformers");
    const pipelineFn = (mod as unknown as { pipeline: PipelineCtor }).pipeline;
    const pipeline = await pipelineFn("feature-extraction", modelName);
    return new OnnxEmbedder(pipeline, modelName);
  }

  async embed(text: string): Promise<Float32Array> {
    const out = await this.pipeline(text, { pooling: "mean", normalize: true });
    // out.data is shape [batch=1, dim]
    return new Float32Array(out.data);
  }

  async dispose(): Promise<void> {
    // @xenova/transformers caches models internally; nothing to free explicitly.
  }

  get name(): string {
    return this.modelName;
  }
}
