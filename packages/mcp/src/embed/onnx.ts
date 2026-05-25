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

  static async load(modelName = "Xenova/all-MiniLM-L6-v2"): Promise<OnnxEmbedder> {
    // @xenova/transformers is ESM-only; dynamic import to keep the rest sync-friendly.
    const mod = await import("@xenova/transformers");
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
