import { describe, it, expect } from "vitest";
import { getDefinition } from "@ato-mcp/shared/tools/get_definition";
import { makeStore } from "../helpers/memory-store.js";

describe("get_definition", () => {
  it("returns statutory match for seeded term", async () => {
    const store = makeStore();
    const out = await getDefinition({ store }, { term: "trading stock", jurisdiction: "AU" });
    expect(out.kind).toBe("statutory");
    expect(out.body).toContain("Trading stock");
    store.close();
  });

  it("returns ordinary fallback when wordnetLookup provided and no statutory match", async () => {
    const store = makeStore();
    const out = await getDefinition({ store, wordnetLookup: async () => "a state of mind" }, { term: "hostility", jurisdiction: "AU" });
    expect(out.kind).toBe("ordinary");
    store.close();
  });

  it("returns no-match fallback when no wordnetLookup and no statutory match", async () => {
    const store = makeStore();
    const out = await getDefinition({ store }, { term: "nonexistentterm123", jurisdiction: "AU" });
    expect(out.kind).toBe("ordinary");
    expect(out.body).toContain("No statutory definition found");
    store.close();
  });

  it("throws when store is missing", async () => {
    await expect(
      getDefinition({ store: null }, { term: "trading stock", jurisdiction: "AU" }),
    ).rejects.toThrow(/corpus/i);
  });
});
