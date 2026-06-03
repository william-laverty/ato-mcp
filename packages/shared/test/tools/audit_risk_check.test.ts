import { describe, it, expect } from "vitest";
import { deriveMetrics } from "../../src/tools/audit_risk_check.js";

describe("deriveMetrics", () => {
  it("totals deductions and computes the deduction-to-income %", () => {
    const m = deriveMetrics({ income: 100000, deductions: [{ category: "work-related car", amount: 4000 }, { category: "donations", amount: 500 }] });
    expect(m.total_deductions).toBe(4500);
    expect(m.deduction_to_income_pct).toBeCloseTo(4.5, 5);
  });
  it("sums only WRE-matching categories into wre_total", () => {
    const m = deriveMetrics({ deductions: [{ category: "work-related travel", amount: 2000 }, { category: "rental interest", amount: 9000 }] });
    expect(m.wre_total).toBe(2000);
  });
  it("counts round-number claims (>= $300, multiple of $100)", () => {
    const m = deriveMetrics({ deductions: [{ category: "a", amount: 1000 }, { category: "b", amount: 500 }, { category: "c", amount: 250 }, { category: "d", amount: 320 }] });
    expect(m.round_number_claims).toBe(2); // 1000 and 500 (250 < 300; 320 not multiple of 100)
  });
  it("hasCategory / categoryAmount match on keywords", () => {
    const m = deriveMetrics({ deductions: [{ category: "Working from home", amount: 600 }, { category: "Mobile phone & internet", amount: 300 }] });
    expect(m.hasCategory(["working from home"])).toBe(true);
    expect(m.hasCategory(["phone", "internet"])).toBe(true);
    expect(m.categoryAmount(["phone"])).toBe(300);
  });
  it("nulls when no data", () => {
    const m = deriveMetrics({});
    expect(m.total_deductions).toBeNull();
    expect(m.deduction_to_income_pct).toBeNull();
    expect(m.wre_total).toBe(0);
  });
});
