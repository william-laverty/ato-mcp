import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { OnnxEmbedder } from "../../src/embed/onnx.js";

describe("OnnxEmbedder", () => {
  let embedder: OnnxEmbedder;
  beforeAll(async () => {
    embedder = await OnnxEmbedder.load("Xenova/all-MiniLM-L6-v2");
  }, 120_000);

  afterAll(async () => {
    await embedder.dispose();
  });

  it("returns 384-dim float32 vector", async () => {
    const v = await embedder.embed("hello world");
    expect(v).toBeInstanceOf(Float32Array);
    expect(v.length).toBe(384);
  });

  it("normalises vector to unit length", async () => {
    const v = await embedder.embed("hello world");
    let norm = 0;
    for (let i = 0; i < v.length; i++) norm += v[i]! * v[i]!;
    expect(Math.sqrt(norm)).toBeCloseTo(1, 4);
  });

  it("scores similar texts higher than unrelated ones", async () => {
    const a = await embedder.embed("I can claim work uniform deductions.");
    const b = await embedder.embed("Uniform expenses are deductible work costs.");
    const c = await embedder.embed("The platypus is a monotreme.");
    let sab = 0;
    let sac = 0;
    for (let i = 0; i < a.length; i++) {
      sab += a[i]! * b[i]!;
      sac += a[i]! * c[i]!;
    }
    expect(sab).toBeGreaterThan(sac + 0.1);
  });
});
