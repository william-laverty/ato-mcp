import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDoc } from "@ato-pro/shared/tools/get_doc";
import { makeStore } from "../helpers/make-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(__dirname, "..", "fixtures", "seed.sql");

describe("get_doc", () => {
  it("returns doc and anchors for existing doc_id", async () => {
    const store = makeStore(SEED);
    const out = await getDoc({ store }, { doc_id: "ato:test/deductions" });
    expect(out.doc.title).toBe("Deductions you can claim");
    expect(out.cleaned_html).toBeNull();
    expect(out.anchors.length).toBeGreaterThanOrEqual(1);
    store.close();
  });

  it("throws for missing doc_id", async () => {
    const store = makeStore(SEED);
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
