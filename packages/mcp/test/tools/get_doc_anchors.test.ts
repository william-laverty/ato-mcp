import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDocAnchors } from "@ato-pro/shared/tools/get_doc_anchors";
import { makeStore } from "../helpers/make-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(__dirname, "..", "fixtures", "seed.sql");

describe("get_doc_anchors", () => {
  it("returns anchors and citation graph for a doc", async () => {
    const store = makeStore(SEED);
    const out = await getDocAnchors({ store }, { doc_id: "ato:test/deductions" });
    expect(out.anchors.length).toBeGreaterThanOrEqual(1);
    expect(out.anchors[0]!.anchor_name).toBe("Uniforms section");
    expect(out.outbound.length).toBe(1);
    expect(out.outbound[0]!.to_doc_id).toBe("legis:itaa1997/8-1");
    store.close();
  });

  it("returns inbound citations for a cited doc", async () => {
    const store = makeStore(SEED);
    const out = await getDocAnchors({ store }, { doc_id: "legis:itaa1997/8-1" });
    expect(out.inbound.length).toBe(1);
    expect(out.inbound[0]!.from_chunk_id).toBe("ato:test/deductions#0");
    store.close();
  });

  it("throws when store is missing", async () => {
    await expect(
      getDocAnchors({ store: null }, { doc_id: "ato:test/deductions" }),
    ).rejects.toThrow(/corpus/i);
  });
});
