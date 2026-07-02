import { describe, it, expect } from "vitest";
import { getChunks } from "@ato-mcp/shared/tools/get_chunks";
import { makeStore } from "../helpers/memory-store.js";

describe("get_chunks tool", () => {
  it("returns requested chunks", async () => {
    const store = makeStore();
    const out = await getChunks({ store }, { chunk_ids: ["ato:test/deductions#0"], neighbours: 0 });
    expect(out.chunks.length).toBe(1);
    expect(out.chunks[0].chunk_id).toBe("ato:test/deductions#0");
    store.close();
  });

  it("includes neighbours when requested", async () => {
    const store = makeStore();
    const out = await getChunks({ store }, { chunk_ids: ["ato:test/deductions#0"], neighbours: 1 });
    const ids = out.chunks.map((c) => c.chunk_id);
    expect(ids).toContain("ato:test/deductions#0");
    expect(ids).toContain("ato:test/deductions#1");
    store.close();
  });

  it("errors when store is missing", async () => {
    await expect(getChunks({ store: null }, { chunk_ids: ["x"], neighbours: 0 })).rejects.toThrow(/corpus/i);
  });
});
