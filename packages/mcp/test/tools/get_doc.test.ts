import { describe, it, expect } from "vitest";
import { getDoc } from "@ato-mcp/shared/tools/get_doc";
import { makeStore } from "../helpers/memory-store.js";

describe("get_doc", () => {
  it("returns doc and anchors for existing doc_id", async () => {
    const store = makeStore();
    const out = await getDoc({ store }, { doc_id: "ato:test/deductions" });
    expect(out.doc.title).toBe("Deductions you can claim");
    expect(out.cleaned_html).toBeNull();
    expect(out.anchors.length).toBeGreaterThanOrEqual(1);
    store.close();
  });

  it("throws for missing doc_id", async () => {
    const store = makeStore();
    await expect(
      getDoc({ store }, { doc_id: "ato:does/not/exist" }),
    ).rejects.toThrow(/Document not found/);
    store.close();
  });

  it("throws when store is missing", async () => {
    await expect(
      getDoc({ store: null }, { doc_id: "ato:test/deductions" }),
    ).rejects.toThrow(/corpus/i);
  });
});
