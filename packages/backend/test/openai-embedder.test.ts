import { describe, it, expect, beforeAll } from "vitest";
import { OpenAIEmbedder } from "../src/openai-embedder.js";

beforeAll(() => { process.env["MOCK_SUPABASE"] = "1"; });

describe("OpenAIEmbedder (mock mode)", () => {
  it("returns a zero vector of the configured dimension without network", async () => {
    const e = await OpenAIEmbedder.load();
    const v = await e.embed("working from home");
    expect(v).toBeInstanceOf(Float32Array);
    expect(v.length).toBe(3072);
  });

  it("honours OPENAI_EMBED_DIMS", async () => {
    process.env["OPENAI_EMBED_DIMS"] = "1536";
    const e = await OpenAIEmbedder.load();
    expect((await e.embed("x")).length).toBe(1536);
    delete process.env["OPENAI_EMBED_DIMS"];
  });

  it("exposes a model name", async () => {
    const e = await OpenAIEmbedder.load();
    expect(typeof e.name).toBe("string");
  });
});
