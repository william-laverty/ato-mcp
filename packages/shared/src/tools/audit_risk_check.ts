// ---------------------------------------------------------------------------
// Derived metrics for audit_risk_check. Pure.
// ---------------------------------------------------------------------------
import type { AuditRiskCheckInput } from "../tools.js";

const WRE_KEYWORDS = [
  "work-related", "work related", "wre", "car", "travel", "clothing", "laundry", "uniform",
  "self-education", "self education", "home office", "working from home", "wfh", "phone",
  "internet", "mobile", "tools", "equipment", "union", "professional",
];

export interface DerivedMetrics {
  total_deductions: number | null;
  deduction_to_income_pct: number | null;
  wre_total: number;
  round_number_claims: number;
  hasCategory(keywords: string[]): boolean;
  categoryAmount(keywords: string[]): number;
}

function matches(category: string, keywords: string[]): boolean {
  const c = category.toLowerCase();
  return keywords.some((k) => c.includes(k));
}

export function deriveMetrics(input: AuditRiskCheckInput): DerivedMetrics {
  const ded = input.deductions ?? [];
  const total = ded.length > 0 ? ded.reduce((a, d) => a + d.amount, 0) : null;
  const wre = ded.filter((d) => matches(d.category, WRE_KEYWORDS)).reduce((a, d) => a + d.amount, 0);
  const round = ded.filter((d) => d.amount >= 300 && d.amount % 100 === 0).length;
  return {
    total_deductions: total,
    deduction_to_income_pct: total !== null && input.income !== undefined && input.income > 0 ? (total / input.income) * 100 : null,
    wre_total: wre,
    round_number_claims: round,
    hasCategory: (keywords) => ded.some((d) => matches(d.category, keywords)),
    categoryAmount: (keywords) => ded.filter((d) => matches(d.category, keywords)).reduce((a, d) => a + d.amount, 0),
  };
}
