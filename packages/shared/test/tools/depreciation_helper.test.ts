import { describe, it, expect } from "vitest";
import {
  fyBounds, fyOfDate, nextFy, daysInclusive, daysHeldInFy,
  primeCostSchedule, diminishingValueSchedule, capitalWorksSchedule, sbePoolSchedule,
} from "../../src/tools/depreciation_helper.js";

describe("date helpers", () => {
  it("fyBounds", () => {
    expect(fyBounds("2025-26")).toEqual({ start: "2025-07-01", end: "2026-06-30" });
  });
  it("fyOfDate", () => {
    expect(fyOfDate("2025-07-01")).toBe("2025-26");
    expect(fyOfDate("2026-06-30")).toBe("2025-26");
    expect(fyOfDate("2026-01-15")).toBe("2025-26");
    expect(fyOfDate("2025-06-30")).toBe("2024-25");
  });
  it("nextFy", () => { expect(nextFy("2025-26")).toBe("2026-27"); });
  it("daysInclusive", () => {
    expect(daysInclusive("2025-07-01", "2026-06-30")).toBe(365);
    expect(daysInclusive("2025-07-01", "2025-07-01")).toBe(1);
  });
  it("daysHeldInFy prorates the first year", () => {
    expect(daysHeldInFy("2025-26", "2025-07-01")).toBe(365);
    expect(daysHeldInFy("2026-27", "2025-07-01")).toBe(365); // full later year
    expect(daysHeldInFy("2025-26", "2026-01-01")).toBe(181); // 1 Jan→30 Jun inclusive
  });
});

describe("primeCostSchedule", () => {
  it("even $200/yr over 5 years for a $1000 asset acquired at FY start", () => {
    const s = primeCostSchedule(1000, 5, "2025-07-01", 100, 5);
    expect(s).toHaveLength(5);
    expect(s[0]!.fy).toBe("2025-26");
    expect(s[0]!.deduction).toBe(200);
    expect(s[4]!.closing_adjustable_value).toBe(0);
    expect(s.reduce((a, r) => a + r.deduction, 0)).toBeCloseTo(1000, 1);
  });
  it("applies business_use_pct to the deduction but not the adjustable value", () => {
    const s = primeCostSchedule(1000, 5, "2025-07-01", 50, 1);
    expect(s[0]!.decline_in_value).toBe(200);
    expect(s[0]!.deduction).toBe(100);
    expect(s[0]!.closing_adjustable_value).toBe(800);
  });
});

describe("diminishingValueSchedule", () => {
  it("front-loads at 200%/life", () => {
    const s = diminishingValueSchedule(1000, 5, "2025-07-01", 100, 3);
    expect(s[0]!.deduction).toBe(400);          // 1000 * 2/5
    expect(s[1]!.opening_adjustable_value).toBe(600);
    expect(s[1]!.deduction).toBe(240);          // 600 * 2/5
  });
});

describe("capitalWorksSchedule", () => {
  it("2.5% of construction cost per year", () => {
    const s = capitalWorksSchedule(200000, "2025-07-01", 100, 0.025, 40);
    expect(s[0]!.deduction).toBe(5000);
    expect(s).toHaveLength(40);
  });
});

describe("sbePoolSchedule", () => {
  it("15% first year then 30% of the opening balance", () => {
    const s = sbePoolSchedule(10000, 100, 3);
    expect(s[0]!.deduction).toBe(1500);          // 15%
    expect(s[1]!.deduction).toBe(2550);          // 30% of 8500
  });
});
