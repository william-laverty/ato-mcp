// ---------------------------------------------------------------------------
// Reporting-period + due-date helpers for bas_prep_checklist. Pure.
// AU BAS due dates (statutory): quarterly Q1 28 Oct, Q2 28 Feb, Q3 28 Apr, Q4 28 Jul.
// ---------------------------------------------------------------------------
import type { UserFacts } from "../facts.js";

export type PeriodType = "monthly" | "quarterly" | "annual" | "none";

export function mapGstPeriod(p: UserFacts["gst_period"]): PeriodType {
  if (p === "monthly" || p === "quarterly" || p === "annual") return p;
  return "none";
}

export function quarterlyDueDate(quarter: number, fy: string): string {
  const startYear = parseInt(fy.slice(0, 4), 10);
  switch (quarter) {
    case 1: return `${startYear}-10-28`;
    case 2: return `${startYear + 1}-02-28`;
    case 3: return `${startYear + 1}-04-28`;
    case 4: return `${startYear + 1}-07-28`;
    default: return "";
  }
}

export function dueDateFor(periodType: PeriodType, quarter: number | undefined, fy: string): string | null {
  if (periodType === "quarterly" && quarter) return quarterlyDueDate(quarter, fy);
  return null;
}

export function formFor(periodType: PeriodType): string {
  switch (periodType) {
    case "monthly": return "Monthly BAS";
    case "quarterly": return "Quarterly BAS";
    case "annual": return "Annual GST return (BAS Z)";
    default: return "Instalment activity statement (IAS)";
  }
}

export function periodLabel(periodType: PeriodType, quarter: number | undefined, fy: string): string {
  if (periodType === "quarterly" && quarter) return `FY${fy} Q${quarter}`;
  return `FY${fy} ${periodType}`;
}
