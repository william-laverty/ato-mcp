import { describe, it, expect } from "vitest";
import { getThreshold } from "@ato-mcp/shared/tools/get_threshold";
import { makeStore } from "../helpers/memory-store.js";

describe("get_threshold", () => {
  it("returns the seeded threshold value", async () => {
    const store = makeStore();
    const out = await getThreshold({ store }, { name: "gst_registration_threshold", pit: "2025-06-30" });
    expect(out.value).toBe(75000);
    expect(out.unit).toBe("AUD");
    store.close();
  });

  it("uses today as default pit", async () => {
    const store = makeStore();
    const out = await getThreshold({ store }, { name: "gst_registration_threshold" });
    expect(out.value).toBe(75000);
    store.close();
  });

  it("throws for unknown threshold name", async () => {
    const store = makeStore();
    await expect(
      getThreshold({ store }, { name: "nonexistent_threshold", pit: "2025-01-01" }),
    ).rejects.toThrow(/Threshold not found/);
    store.close();
  });

  it("throws when store is missing", async () => {
    await expect(
      getThreshold({ store: null }, { name: "gst_registration_threshold" }),
    ).rejects.toThrow(/corpus/i);
  });
});
