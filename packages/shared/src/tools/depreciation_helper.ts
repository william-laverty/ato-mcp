// ---------------------------------------------------------------------------
// Date + schedule maths for depreciation_helper. Pure, deterministic.
// AU financial year runs 1 July (Y) → 30 June (Y+1); "2025-26" = FY starting 2025.
// ---------------------------------------------------------------------------

export interface ScheduleRow {
  fy: string;
  opening_adjustable_value: number;
  decline_in_value: number;
  business_use_pct: number;
  deduction: number;
  closing_adjustable_value: number;
}

const MS_PER_DAY = 86_400_000;
function round2(n: number): number { return Math.round(n * 100) / 100; }

export function fyBounds(fy: string): { start: string; end: string } {
  const startYear = parseInt(fy.slice(0, 4), 10);
  return { start: `${startYear}-07-01`, end: `${startYear + 1}-06-30` };
}

export function fyOfDate(date: string): string {
  const y = parseInt(date.slice(0, 4), 10);
  const m = parseInt(date.slice(5, 7), 10);
  const startYear = m >= 7 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function nextFy(fy: string): string {
  const s = parseInt(fy.slice(0, 4), 10) + 1;
  return `${s}-${String((s + 1) % 100).padStart(2, "0")}`;
}

export function daysInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / MS_PER_DAY) + 1;
}

export function daysHeldInFy(fy: string, acquisition: string): number {
  const { start, end } = fyBounds(fy);
  if (acquisition > end) return 0;
  const heldStart = acquisition > start ? acquisition : start;
  return daysInclusive(heldStart, end);
}

export function primeCostSchedule(cost: number, life: number, acq: string, usePct: number, yearsCap: number): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  let opening = cost;
  let fy = fyOfDate(acq);
  for (let i = 0; i < yearsCap && opening > 0.005; i++) {
    const days = daysHeldInFy(fy, acq);
    let decline = cost * (days / 365) * (1 / life);
    if (decline > opening) decline = opening;
    const deduction = decline * (usePct / 100);
    const closing = opening - decline;
    rows.push({ fy, opening_adjustable_value: round2(opening), decline_in_value: round2(decline), business_use_pct: usePct, deduction: round2(deduction), closing_adjustable_value: round2(closing) });
    opening = closing;
    fy = nextFy(fy);
  }
  return rows;
}

export function diminishingValueSchedule(cost: number, life: number, acq: string, usePct: number, yearsCap: number): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  let opening = cost;
  let fy = fyOfDate(acq);
  for (let i = 0; i < yearsCap && opening > 0.005; i++) {
    const days = daysHeldInFy(fy, acq);
    let decline = opening * (days / 365) * (2 / life);
    if (decline > opening) decline = opening;
    const deduction = decline * (usePct / 100);
    const closing = opening - decline;
    rows.push({ fy, opening_adjustable_value: round2(opening), decline_in_value: round2(decline), business_use_pct: usePct, deduction: round2(deduction), closing_adjustable_value: round2(closing) });
    opening = closing;
    fy = nextFy(fy);
  }
  return rows;
}

export function capitalWorksSchedule(cost: number, acq: string, usePct: number, rate = 0.025, yearsCap = 40): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  let opening = cost;
  let fy = fyOfDate(acq);
  for (let i = 0; i < yearsCap && opening > 0.005; i++) {
    const days = daysHeldInFy(fy, acq);
    let decline = cost * rate * (days / 365);
    if (decline > opening) decline = opening;
    const deduction = decline * (usePct / 100);
    const closing = opening - decline;
    rows.push({ fy, opening_adjustable_value: round2(opening), decline_in_value: round2(decline), business_use_pct: usePct, deduction: round2(deduction), closing_adjustable_value: round2(closing) });
    opening = closing;
    fy = nextFy(fy);
  }
  return rows;
}

export function sbePoolSchedule(cost: number, usePct: number, yearsCap: number, acq?: string): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  const base = cost * (usePct / 100); // taxable-purpose proportion enters the pool
  let opening = base;
  let fy = acq ? fyOfDate(acq) : "year_1";
  for (let i = 0; i < yearsCap && opening > 0.005; i++) {
    const rate = i === 0 ? 0.15 : 0.30;
    const deduction = opening * rate;
    const closing = opening - deduction;
    rows.push({ fy, opening_adjustable_value: round2(opening), decline_in_value: round2(deduction), business_use_pct: usePct, deduction: round2(deduction), closing_adjustable_value: round2(closing) });
    opening = closing;
    fy = acq ? nextFy(fy) : `year_${i + 2}`;
  }
  return rows;
}
