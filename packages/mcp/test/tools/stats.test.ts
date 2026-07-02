import { describe, it, expect } from "vitest";
import { stats } from "@ato-mcp/shared/tools/stats";
import { makeStore } from "../helpers/memory-store.js";

describe("stats tool", () => {
  it("returns installed=true and counts when store is present", async () => {
    const store = makeStore();
    const out = await stats({ store });
    expect(out.installed).toBe(true);
    expect(out.docs).toBe(5);
    expect(out.chunks).toBe(4);
    store.close();
  });

  it("returns installed=false when store is missing", async () => {
    const out = await stats({ store: null });
    expect(out.installed).toBe(false);
    expect(out.docs).toBe(0);
    expect(out.chunks).toBe(0);
  });
});
