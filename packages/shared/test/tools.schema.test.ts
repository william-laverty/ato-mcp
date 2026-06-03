import { describe, it, expect } from "vitest";
import { DeductionDiscoveryInputSchema } from "../src/tools.js";

describe("DeductionDiscoveryInputSchema", () => {
  it("applies defaults", () => {
    const v = DeductionDiscoveryInputSchema.parse({});
    expect(v.k_citations).toBe(3);
    expect(v.include_low_confidence).toBe(true);
    expect(v.activity).toBeUndefined();
  });

  it("accepts an activity + fy override", () => {
    const v = DeductionDiscoveryInputSchema.parse({ activity: "bought a laptop", fy: "2025-26" });
    expect(v.activity).toBe("bought a laptop");
    expect(v.fy).toBe("2025-26");
  });

  it("rejects a malformed fy", () => {
    expect(() => DeductionDiscoveryInputSchema.parse({ fy: "2025" })).toThrow();
  });

  it("clamps k_citations to <= 5", () => {
    expect(() => DeductionDiscoveryInputSchema.parse({ k_citations: 9 })).toThrow();
  });
});
