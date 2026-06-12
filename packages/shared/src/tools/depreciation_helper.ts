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

// ---------------------------------------------------------------------------
// Method catalogue, types, eligibility + depreciationHelper() tool
// ---------------------------------------------------------------------------

import type { Store, ThresholdRow } from "../store/types.js";
import type { Embedder } from "../embed/types.js";
import type { UserFacts } from "../facts.js";
import type { DepreciationHelperInput } from "../tools.js";
import { resolveCitationsSafe, type Citation } from "../lib/citations.js";

export type BusinessStructure = UserFacts["business_structure"];

const DISCLAIMER =
  "This tool retrieves and structures ATO material and performs deterministic calculations; it is not tax advice. Verify material decisions with a registered tax agent.";

interface MethodDef {
  id: string;
  label: string;
  legal_basis: string;
  seed_queries: string[];
  seed_doc_ids: string[];
}

const METHODS: Record<string, MethodDef> = {
  prime_cost: {
    id: "prime_cost", label: "Prime cost (straight-line) method", legal_basis: "ITAA 1997 s 40-75; s 40-25",
    seed_queries: ["prime cost straight line method decline in value", "how to calculate prime cost depreciation effective life"],
    seed_doc_ids: ["legis:c2004a05138/40-75", "ato:businesses-and-organisations/income-deductions-and-concessions/depreciation-and-capital-expenses-and-allowances/general-depreciation-rules-capital-allowances/prime-cost-straight-line-and-diminishing-value-methods"],
  },
  diminishing_value: {
    id: "diminishing_value", label: "Diminishing value method", legal_basis: "ITAA 1997 s 40-72 (post 9 May 2006); s 40-70",
    seed_queries: ["diminishing value method 200% decline in value", "diminishing value depreciation base value effective life"],
    seed_doc_ids: ["legis:c2004a05138/40-72", "legis:c2004a05138/40-70", "ato:businesses-and-organisations/income-deductions-and-concessions/depreciation-and-capital-expenses-and-allowances/general-depreciation-rules-capital-allowances/prime-cost-straight-line-and-diminishing-value-methods"],
  },
  instant_asset_write_off: {
    id: "instant_asset_write_off", label: "Instant asset write-off", legal_basis: "ITAA 1997 Subdiv 328-D; s 328-180",
    seed_queries: ["instant asset write-off eligible small business threshold", "immediate deduction asset costing less than threshold"],
    seed_doc_ids: ["ato:businesses-and-organisations/income-deductions-and-concessions/depreciation-and-capital-expenses-and-allowances/simpler-depreciation-for-small-business/instant-asset-write-off", "legis:c2004a05138/328-180"],
  },
  low_cost_immediate_300: {
    id: "low_cost_immediate_300", label: "Immediate deduction for assets costing $300 or less", legal_basis: "ITAA 1997 s 40-80(2)",
    seed_queries: ["immediate deduction depreciating asset costing $300 or less", "assets costing 300 dollars or less work"],
    seed_doc_ids: ["ato:individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions/tools-computers-and-items-you-use-for-work/depreciating-assets-you-use-for-work/assets-costing-300-dollars-or-less"],
  },
  sbe_pool: {
    id: "sbe_pool", label: "Small business simplified depreciation pool", legal_basis: "ITAA 1997 Subdiv 328-D; s 328-185",
    seed_queries: ["small business pool simplified depreciation 15% 30%", "general small business pool calculation"],
    seed_doc_ids: ["ato:businesses-and-organisations/income-deductions-and-concessions/depreciation-and-capital-expenses-and-allowances/simpler-depreciation-for-small-business/small-business-pool-calculations", "legis:c2004a05138/328-185"],
  },
  capital_works_div43: {
    id: "capital_works_div43", label: "Capital works deduction (Division 43)", legal_basis: "ITAA 1997 Div 43; s 43-25",
    seed_queries: ["capital works deduction division 43 2.5% construction cost", "work out capital works deductions building"],
    seed_doc_ids: ["legis:c2004a05138/43-25", "ato:individuals-and-families/investments-and-assets/property-and-land/residential-rental-properties/rental-expenses/capital-expenses/work-out-your-capital-works-deductions"],
  },
};

export interface DepreciationHelperDeps {
  store: Store | null;
  embedder: Embedder;
  userFacts: UserFacts | null;
}

export interface DepreciationMethodResult {
  method: string;
  label: string;
  eligible: boolean;
  eligibility_reason: string;
  first_year_deduction: number | null;
  total_base: number;
  schedule: ScheduleRow[];
  threshold: ThresholdRow | null;
  legal_basis: string;
  citations: Citation[];
  notes: string[];
}

export interface DepreciationHelperOutput {
  inputs_echo: { asset_cost: number; acquisition_date: string; business_use_pct: number; effective_life_years: number | null; fy: string; asset_type: string | null };
  taxpayer_context: { business_structure: BusinessStructure; is_business: boolean; is_small_business_entity: boolean | null };
  methods: DepreciationMethodResult[];
  unavailable: Array<{ method: string; reason: string }>;
  recommended: { method: string; rationale: string } | null;
  disclaimer: string;
  notes: string[];
}

function fyToPit(fy: string): string {
  const start = parseInt(fy.slice(0, 4), 10);
  return `${start + 1}-06-30`;
}

function round2pub(n: number): number { return Math.round(n * 100) / 100; }

export async function depreciationHelper(
  deps: DepreciationHelperDeps,
  args: DepreciationHelperInput,
): Promise<DepreciationHelperOutput> {
  if (!deps.userFacts) {
    throw new Error("Personal facts not set. Run `ato-mcp onboard` to complete the web onboarding flow.");
  }
  if (!deps.store) {
    throw new Error("Corpus not installed. Run `ato-mcp update` to download the latest corpus, then retry.");
  }
  const facts = deps.userFacts;
  const store = deps.store;
  const fy = args.fy ?? facts.current_fy;
  const pit = fyToPit(fy);
  const use = args.business_use_pct;
  const isBusiness = facts.business_structure !== "none";
  const life = args.effective_life_years ?? null;
  const yearsCap = args.years ?? (life ? Math.min(40, Math.max(1, Math.ceil(life))) : 10);
  const totalBase = args.asset_cost * (use / 100);
  const notes: string[] = [];
  const methods: DepreciationMethodResult[] = [];
  const unavailable: Array<{ method: string; reason: string }> = [];

  if (facts.gst_registered) notes.push("Use the GST-exclusive cost: GST-registered taxpayers exclude any claimable GST credit from the asset's cost.");
  if ((args.asset_type ?? "").toLowerCase().match(/\bcar\b|vehicle/)) notes.push("If this is a car, the car limit caps the depreciable cost (ITAA 1997 Div 28 / s 40-230) — not applied here; check the current car limit.");
  if (facts.has_investment_property && !isBusiness) notes.push("For residential rental plant, the second-hand depreciating-asset restriction (assets acquired after 9 May 2017) may deny Div 40 — confirm the asset is new.");

  // Per-method citation failures degrade explicitly instead of erroring the
  // whole computation (the schedules themselves never depend on search).
  let citationsDegraded = false;
  const resolve = async (id: string) => {
    const resolved = await resolveCitationsSafe({ store, embedder: deps.embedder }, METHODS[id]!.seed_queries, { k: 3, pit, pinnedDocIds: METHODS[id]!.seed_doc_ids });
    if (resolved.degraded) citationsDegraded = true;
    return resolved.citations;
  };

  // --- Prime cost / diminishing value (need effective life) ---
  const wantPC = args.method === "both" || args.method === "prime_cost";
  const wantDV = args.method === "both" || args.method === "diminishing_value";
  if (life) {
    if (wantPC) {
      const def = METHODS.prime_cost!;
      const schedule = primeCostSchedule(args.asset_cost, life, args.acquisition_date, use, yearsCap);
      methods.push({ method: def.id, label: def.label, eligible: true, eligibility_reason: "The universal straight-line method under Div 40.", first_year_deduction: schedule[0]?.deduction ?? null, total_base: round2pub(totalBase), schedule, threshold: null, legal_basis: def.legal_basis, citations: await resolve("prime_cost"), notes: [] });
    }
    if (wantDV) {
      const def = METHODS.diminishing_value!;
      if (args.acquisition_date < "2006-05-10") {
        unavailable.push({ method: def.id, reason: "Pre-9-May-2006 assets use the 150% diminishing-value rate, which this tool does not compute." });
      } else {
        const schedule = diminishingValueSchedule(args.asset_cost, life, args.acquisition_date, use, yearsCap);
        methods.push({ method: def.id, label: def.label, eligible: true, eligibility_reason: "The accelerated (200%) method under Div 40 for post-9-May-2006 assets.", first_year_deduction: schedule[0]?.deduction ?? null, total_base: round2pub(totalBase), schedule, threshold: null, legal_basis: def.legal_basis, citations: await resolve("diminishing_value"), notes: ["Diminishing value never fully writes the asset off; the schedule is capped at the chosen horizon."] });
      }
    }
  } else {
    if (wantPC) unavailable.push({ method: "prime_cost", reason: "Provide effective_life_years to compute the prime-cost schedule." });
    if (wantDV) unavailable.push({ method: "diminishing_value", reason: "Provide effective_life_years to compute the diminishing-value schedule." });
  }

  // --- Instant asset write-off (business + SBE + under threshold) ---
  const iawoDef = METHODS.instant_asset_write_off!;
  if (!isBusiness) {
    unavailable.push({ method: iawoDef.id, reason: "Instant asset write-off is a small-business concession; your profile is an individual." });
  } else if (args.is_small_business_entity === false) {
    unavailable.push({ method: iawoDef.id, reason: "Instant asset write-off requires small-business-entity status, which you indicated does not apply." });
  } else {
    const threshold = await store.getThreshold("instant_asset_write_off", pit);
    if (!threshold) {
      unavailable.push({ method: iawoDef.id, reason: `Instant asset write-off threshold unavailable for ${fy}.` });
    } else if (args.asset_cost >= threshold.value) {
      unavailable.push({ method: iawoDef.id, reason: `Asset cost (${args.asset_cost}) is at or above the instant asset write-off threshold (${threshold.value}); use the small business pool or Div 40 instead.` });
    } else {
      const mNotes = args.is_small_business_entity === undefined ? ["Assumes you are a small business entity (aggregated turnover under the relevant threshold) — confirm eligibility."] : [];
      methods.push({ method: iawoDef.id, label: iawoDef.label, eligible: true, eligibility_reason: `Eligible: asset cost is under the ${fy} instant asset write-off threshold.`, first_year_deduction: round2pub(totalBase), total_base: round2pub(totalBase), schedule: [], threshold, legal_basis: iawoDef.legal_basis, citations: await resolve("instant_asset_write_off"), notes: mNotes });
    }
  }

  // --- $300 immediate (individual, non-business) ---
  const lowDef = METHODS.low_cost_immediate_300!;
  if (isBusiness) {
    unavailable.push({ method: lowDef.id, reason: "The $300 immediate deduction is for non-business depreciating assets; business low-cost assets use the instant asset write-off, the pool, or Div 40." });
  } else if (args.asset_cost > 300) {
    unavailable.push({ method: lowDef.id, reason: "Asset costs more than $300, so the immediate low-cost deduction does not apply." });
  } else {
    methods.push({ method: lowDef.id, label: lowDef.label, eligible: true, eligibility_reason: "Eligible: a non-business depreciating asset costing $300 or less.", first_year_deduction: round2pub(totalBase), total_base: round2pub(totalBase), schedule: [], threshold: null, legal_basis: lowDef.legal_basis, citations: await resolve("low_cost_immediate_300"), notes: [] });
  }

  // --- SBE pool (business + SBE + at/above IAWO threshold) ---
  const poolDef = METHODS.sbe_pool!;
  if (!isBusiness) {
    unavailable.push({ method: poolDef.id, reason: "The small business pool is a small-business concession; your profile is an individual." });
  } else if (args.is_small_business_entity === false) {
    unavailable.push({ method: poolDef.id, reason: "The small business pool requires small-business-entity status, which you indicated does not apply." });
  } else {
    const threshold = await store.getThreshold("instant_asset_write_off", pit);
    if (threshold && args.asset_cost < threshold.value) {
      unavailable.push({ method: poolDef.id, reason: "Asset is under the instant asset write-off threshold, so it is written off immediately rather than pooled." });
    } else {
      const mNotes = ["The small business pool is an aggregate across all your pooled assets; this shows the per-asset contribution pattern only."];
      if (args.is_small_business_entity === undefined) mNotes.push("Assumes you are a small business entity — confirm eligibility.");
      const schedule = sbePoolSchedule(args.asset_cost, use, Math.min(yearsCap, 10), args.acquisition_date);
      methods.push({ method: poolDef.id, label: poolDef.label, eligible: true, eligibility_reason: "Eligible: a small-business depreciating asset at or above the instant write-off threshold.", first_year_deduction: schedule[0]?.deduction ?? null, total_base: round2pub(totalBase), schedule, threshold, legal_basis: poolDef.legal_basis, citations: await resolve("sbe_pool"), notes: mNotes });
    }
  }

  // --- Div 43 capital works ---
  const capDef = METHODS.capital_works_div43!;
  if (args.is_capital_works) {
    const schedule = capitalWorksSchedule(args.asset_cost, args.acquisition_date, use, 0.025, 40);
    methods.push({ method: capDef.id, label: capDef.label, eligible: true, eligibility_reason: "Capital works (structural construction cost) — deductible at 2.5% per year over 40 years.", first_year_deduction: schedule[0]?.deduction ?? null, total_base: round2pub(totalBase), schedule, threshold: null, legal_basis: capDef.legal_basis, citations: await resolve("capital_works_div43"), notes: ["Based on construction cost, not market value. A 4% / 25-year rate applies to limited building types — not auto-detected here."] });
  } else {
    unavailable.push({ method: capDef.id, reason: "Not flagged as capital works (is_capital_works=false). Capital works covers structural building costs, not plant/equipment." });
  }

  // Div 43 capital works and Div 40 decline in value cannot both be claimed on the
  // same expenditure (ITAA 1997 s 40-45(2)). If both fired, warn on each affected card
  // so a downstream agent never presents them as concurrently claimable.
  const hasDiv43 = methods.some((m) => m.method === "capital_works_div43");
  const hasDiv40 = methods.some((m) => m.method === "prime_cost" || m.method === "diminishing_value");
  if (hasDiv43 && hasDiv40) {
    const exclusionNote =
      "Division 43 capital works and Division 40 decline in value cannot both be claimed on the same expenditure (ITAA 1997 s 40-45(2)): capital works covers the building/structure, Division 40 covers separately identifiable plant and equipment. Split the cost between them — do not claim both methods on the same dollars.";
    for (const m of methods) {
      if (m.method === "capital_works_div43" || m.method === "prime_cost" || m.method === "diminishing_value") {
        m.notes.push(exclusionNote);
      }
    }
  }

  const recommended = pickRecommended(methods);

  return {
    inputs_echo: { asset_cost: args.asset_cost, acquisition_date: args.acquisition_date, business_use_pct: use, effective_life_years: life, fy, asset_type: args.asset_type ?? null },
    taxpayer_context: { business_structure: facts.business_structure, is_business: isBusiness, is_small_business_entity: args.is_small_business_entity ?? null },
    methods,
    unavailable,
    recommended,
    disclaimer: DISCLAIMER,
    notes: [
      ...notes,
      ...(citationsDegraded
        ? ["Live citation resolution was partially degraded under load — some methods show fewer (or no) citations than usual. The schedules and eligibility are unaffected; retry for full citations."]
        : []),
    ],
  };
}

function pickRecommended(methods: DepreciationMethodResult[]): { method: string; rationale: string } | null {
  const has = (id: string) => methods.some((m) => m.method === id && m.eligible);
  if (has("instant_asset_write_off")) return { method: "instant_asset_write_off", rationale: "Eligible for an immediate full write-off this year (asset cost is under the instant asset write-off threshold)." };
  if (has("low_cost_immediate_300")) return { method: "low_cost_immediate_300", rationale: "Cost is $300 or less — claim the full amount immediately." };
  const pc = has("prime_cost"), dv = has("diminishing_value");
  if (has("capital_works_div43") && !pc && !dv) return { method: "capital_works_div43", rationale: "This is capital works (structural) — deductible at the capital works rate over 40 years; the depreciating-asset methods do not apply." };
  if (pc && dv) return { method: "diminishing_value_or_prime_cost", rationale: "Diminishing value front-loads deductions; prime cost spreads them evenly. This is a taxpayer election (ITAA 1997 s 40-65, s 40-130), not a recommendation — compare the schedules and see the citations." };
  if (pc) return { method: "prime_cost", rationale: "Prime cost is the available Div 40 method given your inputs." };
  if (dv) return { method: "diminishing_value", rationale: "Diminishing value is the available Div 40 method given your inputs." };
  return null;
}
