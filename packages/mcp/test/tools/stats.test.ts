import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stats } from "../../src/tools/stats.js";
import { makeStore } from "../helpers/make-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(__dirname, "..", "fixtures", "seed.sql");

describe("stats tool", () => {
  it("returns installed=true and counts when store is present", async () => {
    const store = makeStore(SEED);
    const out = await stats({ store });
    expect(out.installed).toBe(true);
    expect(out.docs).toBe(3);
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
