export interface Embedder {
  embed(text: string): Promise<Float32Array>;
  readonly name: string;
}
