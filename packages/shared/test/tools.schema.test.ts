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

import { DepreciationHelperInputSchema } from "../src/tools.js";

describe("DepreciationHelperInputSchema", () => {
  it("applies defaults", () => {
    const v = DepreciationHelperInputSchema.parse({ asset_cost: 1000, acquisition_date: "2025-07-01" });
    expect(v.business_use_pct).toBe(100);
    expect(v.is_capital_works).toBe(false);
    expect(v.method).toBe("both");
  });
  it("rejects non-positive cost", () => {
    expect(() => DepreciationHelperInputSchema.parse({ asset_cost: 0, acquisition_date: "2025-07-01" })).toThrow();
  });
  it("rejects malformed acquisition_date", () => {
    expect(() => DepreciationHelperInputSchema.parse({ asset_cost: 1, acquisition_date: "2025-7-1" })).toThrow();
  });
  it("rejects business_use_pct over 100", () => {
    expect(() => DepreciationHelperInputSchema.parse({ asset_cost: 1, acquisition_date: "2025-07-01", business_use_pct: 150 })).toThrow();
  });
});
