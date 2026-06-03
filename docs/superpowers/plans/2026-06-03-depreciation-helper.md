# depreciation_helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `depreciation_helper` hero workflow tool — given a depreciating asset + the taxpayer's facts, compute the applicable depreciation methods (prime cost, diminishing value, instant asset write-off, $300 immediate, SBE pool, Div 43 capital works) as structured data with year-by-year schedules and corpus citations.

**Architecture:** Pure, deterministic math helpers (date/days, prime-cost & diminishing-value & capital-works & SBE-pool schedules) are unit-tested in isolation. A tiny method catalogue carries legal bases + citation seeds. The tool composes: branch by `business_structure` + SBE eligibility → compute each applicable method → attach citations via the shared `resolveCitations()` spine (built in tool 1) → resolve the IAWO threshold → derive an eligibility-driven `recommended`. Same shared code runs in local MCP and the hosted backend.

**Tech Stack:** TypeScript 5.6.3, Zod 3.23.8, vitest 2.1.5, pnpm workspaces. (Note: `new Date(...)`/`Date.parse` are fine here — this is application code, not a workflow script.)

**Spec:** `docs/superpowers/specs/2026-06-03-depreciation-helper-design.md`
**Branch:** already on `feat/v0.4-deduction-discovery` (do NOT create a new branch). Reuses `packages/shared/src/lib/citations.ts` from tool 1.

---

## File structure

| File | Responsibility |
|------|----------------|
| `packages/shared/src/tools.ts` (modify) | Add `DepreciationHelperInputSchema` + extend `ToolName` |
| `packages/shared/src/tools/depreciation_helper.ts` (create) | Date/math helpers + method catalogue + `depreciationHelper()` tool |
| `packages/shared/package.json` (modify) | Add `./tools/depreciation_helper` subpath export |
| `packages/shared/test/tools/depreciation_helper.test.ts` (create) | Math + eligibility + scenario unit tests |
| `packages/mcp/src/server.ts` (modify) | Register tool (TOOLS entry, dispatch, pass userFacts) |
| `packages/mcp/test/server.test.ts` (modify) | Dispatch test |
| `packages/mcp/test/e2e/mcp-protocol.test.ts` (modify) | Tool-list assertion → 11 tools |
| `packages/backend/api/depreciation_helper.ts` (create) | Vercel handler |
| `packages/backend/test/handlers.test.ts` (modify) | Handler integration tests |
| `CLAUDE.md`, `HANDOFF.md` (modify) | Mark tool 2 shipped |

---

### Task 1: Input schema

**Files:**
- Modify: `packages/shared/src/tools.ts`
- Test: `packages/shared/test/tools.schema.test.ts` (append)

- [ ] **Step 1: Write the failing test** (append to the existing `packages/shared/test/tools.schema.test.ts`)

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ato-mcp/shared exec vitest run test/tools.schema.test.ts`
Expected: FAIL — `DepreciationHelperInputSchema` not exported.

- [ ] **Step 3: Add the schema** (in `packages/shared/src/tools.ts`, after `DeductionDiscoveryInputSchema`/type, before `ToolName`)

```ts
export const DepreciationHelperInputSchema = z.object({
  asset_cost: z.number().positive(),
  acquisition_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "acquisition_date must be YYYY-MM-DD"),
  business_use_pct: z.number().min(0).max(100).default(100),
  asset_type: z.string().optional(),
  effective_life_years: z.number().positive().optional(),
  is_small_business_entity: z.boolean().optional(),
  is_capital_works: z.boolean().default(false),
  method: z.enum(["prime_cost", "diminishing_value", "both"]).default("both"),
  fy: z.string().regex(/^\d{4}-\d{2}$/, "FY must be YYYY-YY").optional(),
  years: z.number().int().min(1).max(40).optional(),
});
export type DepreciationHelperInput = z.infer<typeof DepreciationHelperInputSchema>;
```

Extend the `ToolName` union (last line) to add `"depreciation_helper"`:

```ts
export type ToolName = "search" | "get_chunks" | "fetch" | "stats" | "get_definition" | "get_doc" | "get_doc_anchors" | "get_threshold" | "deduction_discovery" | "depreciation_helper";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ato-mcp/shared exec vitest run test/tools.schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/tools.ts packages/shared/test/tools.schema.test.ts
git commit -m "feat(shared): add DepreciationHelperInputSchema

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Date + schedule math helpers

**Files:**
- Create: `packages/shared/src/tools/depreciation_helper.ts` (math helpers only this task)
- Test: `packages/shared/test/tools/depreciation_helper.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/test/tools/depreciation_helper.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ato-mcp/shared exec vitest run test/tools/depreciation_helper.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helpers**

Create `packages/shared/src/tools/depreciation_helper.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ato-mcp/shared exec vitest run test/tools/depreciation_helper.test.ts`
Expected: PASS (all math tests). If `daysHeldInFy("2025-26","2026-01-01")` is off by one, recheck `daysInclusive` (1 Jan→30 Jun 2026 inclusive = 181).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/tools/depreciation_helper.ts packages/shared/test/tools/depreciation_helper.test.ts
git commit -m "feat(shared): depreciation schedule maths (prime cost, diminishing value, Div 43, SBE pool)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Method catalogue, types, eligibility + the `depreciationHelper()` tool

**Files:**
- Modify: `packages/shared/src/tools/depreciation_helper.ts`
- Modify: `packages/shared/package.json` (subpath export)
- Modify: `packages/shared/test/tools/depreciation_helper.test.ts`

- [ ] **Step 1: Write the failing scenario tests** (append to the test file)

```ts
import { depreciationHelper } from "../../src/tools/depreciation_helper.js";
import type { DepreciationHelperDeps } from "../../src/tools/depreciation_helper.js";
import type { Store } from "../../src/store/types.js";
import type { Embedder } from "../../src/embed/types.js";
import type { UserFacts } from "../../src/facts.js";

const baseFacts: UserFacts = {
  given_name: "Sam", state: "VIC", residency_status: "resident",
  has_abn: false, business_structure: "none", gst_registered: false, gst_period: "n/a",
  payg_instalments: false, fbt_payer: false, has_spouse: false, dependants: 0,
  hecs_help_debt: false, private_health_insurance: false, has_investment_property: false,
  has_shares_or_managed_funds: false, has_crypto: false, super_fund_type: "industry",
  current_fy: "2025-26", prior_fy_lodged: true,
  accepted_disclaimer_at: "2026-01-01T00:00:00Z", facts_updated_at: "2026-01-01T00:00:00Z", schema_version: 1,
};

function deps(facts: UserFacts, iawoValue: number | null = 20000): DepreciationHelperDeps {
  const store: Store = {
    stats: async () => ({ installed: true, schema_version: "x", docs: 1, chunks: 1, staleness_days: 0 }),
    keywordSearch: async () => [{ chunk_id: "c", doc_id: "d", ord: 0, text: "t", heading_path: [], score: 1, title: "T", url: "u", doc_type: "ATO_GUIDE", snippet: "s" }],
    vectorSearch: async () => [],
    getChunks: async () => [], getDoc: async () => null,
    getDocAnchors: async () => ({ anchors: [], inbound: [], outbound: [] }),
    getDefinition: async () => [],
    getThreshold: async (name) => iawoValue === null ? null : { name, value: iawoValue, unit: "AUD", effective_from: null, effective_to: null, source_doc_id: null, source_anchor: null },
    close: () => {},
  };
  return { store, embedder: { embed: async () => new Float32Array(384) } as Embedder, userFacts: facts };
}
const ids = (o: Awaited<ReturnType<typeof depreciationHelper>>) => new Set(o.methods.map((m) => m.method));
const unav = (o: Awaited<ReturnType<typeof depreciationHelper>>) => new Set(o.unavailable.map((u) => u.method));

describe("depreciationHelper", () => {
  it("throws when facts are missing", async () => {
    await expect(depreciationHelper({ store: {} as Store, embedder: {} as Embedder, userFacts: null }, { asset_cost: 1000, acquisition_date: "2025-07-01", business_use_pct: 100, is_capital_works: false, method: "both" }))
      .rejects.toThrow(/onboard/);
  });

  it("individual: PC+DV computed, IAWO/pool unavailable, $300 only if cheap", async () => {
    const out = await depreciationHelper(deps(baseFacts), { asset_cost: 1000, acquisition_date: "2025-07-01", business_use_pct: 100, effective_life_years: 5, is_capital_works: false, method: "both" });
    expect(ids(out).has("prime_cost")).toBe(true);
    expect(ids(out).has("diminishing_value")).toBe(true);
    expect(unav(out).has("instant_asset_write_off")).toBe(true);
    expect(ids(out).has("low_cost_immediate_300")).toBe(false); // $1000 > $300
    expect(out.methods.find((m) => m.method === "prime_cost")!.citations.length).toBeGreaterThan(0);
  });

  it("individual cheap asset: $300 immediate eligible", async () => {
    const out = await depreciationHelper(deps(baseFacts), { asset_cost: 250, acquisition_date: "2025-07-01", business_use_pct: 100, effective_life_years: 3, is_capital_works: false, method: "both" });
    expect(ids(out).has("low_cost_immediate_300")).toBe(true);
    expect(out.recommended!.method).toBe("low_cost_immediate_300");
  });

  it("sole trader SBE: IAWO eligible + recommended when under threshold", async () => {
    const facts = { ...baseFacts, business_structure: "sole_trader" as const, has_abn: true, abn: "51824753556" };
    const out = await depreciationHelper(deps(facts), { asset_cost: 5000, acquisition_date: "2025-07-01", business_use_pct: 100, effective_life_years: 5, is_small_business_entity: true, is_capital_works: false, method: "both" });
    expect(ids(out).has("instant_asset_write_off")).toBe(true);
    expect(out.recommended!.method).toBe("instant_asset_write_off");
    expect(unav(out).has("low_cost_immediate_300")).toBe(true); // business → not the $300 rule
  });

  it("sole trader not SBE: IAWO ineligible", async () => {
    const facts = { ...baseFacts, business_structure: "sole_trader" as const, has_abn: true, abn: "51824753556" };
    const out = await depreciationHelper(deps(facts), { asset_cost: 5000, acquisition_date: "2025-07-01", business_use_pct: 100, effective_life_years: 5, is_small_business_entity: false, is_capital_works: false, method: "both" });
    expect(unav(out).has("instant_asset_write_off")).toBe(true);
  });

  it("no effective life: PC+DV unavailable, immediate methods still computed", async () => {
    const out = await depreciationHelper(deps(baseFacts), { asset_cost: 250, acquisition_date: "2025-07-01", business_use_pct: 100, is_capital_works: false, method: "both" });
    expect(unav(out).has("prime_cost")).toBe(true);
    expect(unav(out).has("diminishing_value")).toBe(true);
    expect(ids(out).has("low_cost_immediate_300")).toBe(true);
  });

  it("capital works: Div 43 computed and recommended when only it applies", async () => {
    const out = await depreciationHelper(deps(baseFacts), { asset_cost: 200000, acquisition_date: "2025-07-01", business_use_pct: 100, is_capital_works: true, method: "both" });
    expect(ids(out).has("capital_works_div43")).toBe(true);
    expect(out.recommended!.method).toBe("capital_works_div43");
  });

  it("PC vs DV stays a neutral taxpayer election in recommended", async () => {
    const out = await depreciationHelper(deps(baseFacts), { asset_cost: 5000, acquisition_date: "2025-07-01", business_use_pct: 100, effective_life_years: 5, is_capital_works: false, method: "both" });
    expect(out.recommended!.rationale).toMatch(/taxpayer election|not a recommendation/i);
  });

  it("IAWO threshold unavailable: surfaced ineligible, never fabricated", async () => {
    const facts = { ...baseFacts, business_structure: "sole_trader" as const, has_abn: true, abn: "51824753556" };
    const out = await depreciationHelper(deps(facts, null), { asset_cost: 5000, acquisition_date: "2025-07-01", business_use_pct: 100, effective_life_years: 5, is_small_business_entity: true, is_capital_works: false, method: "both" });
    expect(unav(out).has("instant_asset_write_off")).toBe(true);
  });

  it("includes disclaimer", async () => {
    const out = await depreciationHelper(deps(baseFacts), { asset_cost: 1000, acquisition_date: "2025-07-01", business_use_pct: 100, effective_life_years: 5, is_capital_works: false, method: "both" });
    expect(out.disclaimer).toMatch(/not tax advice/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ato-mcp/shared exec vitest run test/tools/depreciation_helper.test.ts`
Expected: FAIL — `depreciationHelper` not exported.

- [ ] **Step 3: Implement the catalogue, types, and tool** (append to `packages/shared/src/tools/depreciation_helper.ts`)

```ts
import type { Store, ThresholdRow } from "../store/types.js";
import type { Embedder } from "../embed/types.js";
import type { UserFacts } from "../facts.js";
import type { DepreciationHelperInput } from "../tools.js";
import { resolveCitations, type Citation } from "../lib/citations.js";

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

  const resolve = (id: string) => resolveCitations({ store, embedder: deps.embedder }, METHODS[id]!.seed_queries, { k: 3, pit, pinnedDocIds: METHODS[id]!.seed_doc_ids });

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

  const recommended = pickRecommended(methods);

  return {
    inputs_echo: { asset_cost: args.asset_cost, acquisition_date: args.acquisition_date, business_use_pct: use, effective_life_years: life, fy, asset_type: args.asset_type ?? null },
    taxpayer_context: { business_structure: facts.business_structure, is_business: isBusiness, is_small_business_entity: args.is_small_business_entity ?? null },
    methods,
    unavailable,
    recommended,
    disclaimer: DISCLAIMER,
    notes,
  };
}

function round2pub(n: number): number { return Math.round(n * 100) / 100; }

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
```

> Note: `round2pub` duplicates the file-local `round2` from Task 2 only because that one is not exported; if the reviewer prefers, export `round2` from Task 2's block and reuse it. Either is acceptable — keep one rounding helper if trivial.

- [ ] **Step 4: Add the subpath export**

In `packages/shared/package.json` `exports`, add after `./tools/deduction_discovery`:

```json
    "./tools/depreciation_helper": {
      "types": "./dist/tools/depreciation_helper.d.ts",
      "import": "./dist/tools/depreciation_helper.js"
    },
```

- [ ] **Step 5: Run the tests + typecheck + build**

Run: `pnpm --filter @ato-mcp/shared test && pnpm --filter @ato-mcp/shared typecheck && pnpm --filter @ato-mcp/shared build`
Expected: all green; `dist/tools/depreciation_helper.js` emitted.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/tools/depreciation_helper.ts packages/shared/package.json packages/shared/test/tools/depreciation_helper.test.ts
git commit -m "feat(shared): implement depreciation_helper tool

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Register in the MCP server

**Files:**
- Modify: `packages/mcp/src/server.ts`
- Modify: `packages/mcp/test/server.test.ts`
- Modify: `packages/mcp/test/e2e/mcp-protocol.test.ts`

- [ ] **Step 1: Write the failing test** (append to `packages/mcp/test/server.test.ts`)

```ts
describe("server: depreciation_helper", () => {
  it("lists the tool", () => {
    const srv = buildServerForTesting({ store, embedder, facts, mode: "local" });
    expect(srv.listToolNames()).toContain("depreciation_helper");
  });
  it("dispatches and returns method results", async () => {
    const srv = buildServerForTesting({ store, embedder, facts, mode: "local" });
    const res = await srv.callTool("depreciation_helper", { asset_cost: 1000, acquisition_date: "2025-07-01", effective_life_years: 5 });
    expect(res).toHaveProperty("methods");
    expect(res).toHaveProperty("disclaimer");
    expect(Array.isArray(res.methods)).toBe(true);
  });
});
```

(`store`, `embedder`, `facts` are already defined at the top of `server.test.ts` from tool 1's Task 7. The mock `store.getThreshold` returns null, which is fine — IAWO simply reports ineligible.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ato-mcp/mcp exec vitest run test/server.test.ts`
Expected: FAIL — tool not listed / unknown tool.

- [ ] **Step 3: Register the tool** in `packages/mcp/src/server.ts`:

(a) Import (after the `deductionDiscovery` import):

```ts
import { depreciationHelper } from "@ato-mcp/shared/tools/depreciation_helper";
```

(b) Add `DepreciationHelperInputSchema` to the `@ato-mcp/shared` schema import block:

```ts
  DeductionDiscoveryInputSchema,
  DepreciationHelperInputSchema,
  UserFactsSchema,
```

(c) Add a `TOOLS` entry (after the `deduction_discovery` entry):

```ts
  depreciation_helper: {
    description:
      "Compute depreciation for an asset across all applicable methods (prime cost, diminishing value, instant asset write-off, $300 immediate, small business pool, Division 43 capital works), branched by the user's taxpayer structure. Returns year-by-year schedules, the live instant-asset-write-off threshold, and corpus citations. Inputs: asset_cost, acquisition_date (YYYY-MM-DD), and optionally business_use_pct, effective_life_years, is_small_business_entity, is_capital_works, asset_type, fy.",
    inputSchema: {
      type: "object",
      properties: {
        asset_cost: { type: "number", exclusiveMinimum: 0 },
        acquisition_date: { type: "string" },
        business_use_pct: { type: "number", minimum: 0, maximum: 100, default: 100 },
        asset_type: { type: "string" },
        effective_life_years: { type: "number", exclusiveMinimum: 0 },
        is_small_business_entity: { type: "boolean" },
        is_capital_works: { type: "boolean", default: false },
        method: { type: "string", enum: ["prime_cost", "diminishing_value", "both"], default: "both" },
        fy: { type: "string" },
        years: { type: "integer", minimum: 1, maximum: 40 },
      },
      required: ["asset_cost", "acquisition_date"],
      additionalProperties: false,
    },
  },
```

(d) Add a `dispatch` case (after the `deduction_discovery` case):

```ts
    case "depreciation_helper":
      return depreciationHelper(
        { store: deps.store, embedder: deps.embedder, userFacts: deps.facts ?? null },
        DepreciationHelperInputSchema.parse(args),
      );
```

- [ ] **Step 4: Update the e2e tool-list assertion**

In `packages/mcp/test/e2e/mcp-protocol.test.ts`, find the sorted expected tool-name array (it currently lists 10 names including `deduction_discovery`) and add `"depreciation_helper"` so the array has 11 names in sorted order. Run the test to confirm the exact expected ordering the assertion uses.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @ato-mcp/mcp test && pnpm --filter @ato-mcp/mcp typecheck`
Expected: all green (server.test.ts 4 tests; e2e tool-list updated to 11).

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/src/server.ts packages/mcp/test/server.test.ts packages/mcp/test/e2e/mcp-protocol.test.ts
git commit -m "feat(mcp): register depreciation_helper tool

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Backend handler

**Files:**
- Create: `packages/backend/api/depreciation_helper.ts`
- Modify: `packages/backend/test/handlers.test.ts`

- [ ] **Step 1: Write the failing test** (append to `packages/backend/test/handlers.test.ts`, before the final closing lines)

```ts
// ---------------------------------------------------------------------------
// depreciation_helper handler
// ---------------------------------------------------------------------------
describe("POST /depreciation_helper", () => {
  it("returns a structured onboard error when the user has no facts (mock store)", async () => {
    const { handler } = await import("../api/depreciation_helper.js");
    const resp = await handler(makePostRequest({ asset_cost: 1000, acquisition_date: "2025-07-01" }));
    expect(resp.status).toBe(400);
    const body = await resp.json() as { kind: string; message: string };
    expect(body.kind).toBe("error");
    expect(body.message).toMatch(/onboard/i);
  });
  it("returns 400 on invalid input", async () => {
    const { handler } = await import("../api/depreciation_helper.js");
    const resp = await handler(makePostRequest({ asset_cost: -5, acquisition_date: "2025-07-01" }));
    expect(resp.status).toBe(400);
  });
  it("returns 401 without auth", async () => {
    const { handler } = await import("../api/depreciation_helper.js");
    const req = new Request("https://api.ato-mcp.com.au/depreciation_helper", { method: "POST", body: "{}" });
    const resp = await handler(req);
    expect(resp.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ato-mcp/shared build && pnpm --filter @ato-mcp/backend exec vitest run test/handlers.test.ts`
Expected: FAIL — cannot find `../api/depreciation_helper.js`.

- [ ] **Step 3: Create the handler**

Create `packages/backend/api/depreciation_helper.ts`:

```ts
import { adapt } from "./_adapter.js";
import { authMiddleware } from "./_middleware.js";
import { depreciationHelper } from "@ato-mcp/shared/tools/depreciation_helper";
import { DepreciationHelperInputSchema, UserFactsSchema } from "@ato-mcp/shared";
import type { UserFacts } from "@ato-mcp/shared";
import { SupabaseStore } from "../src/supabase-store.js";
import { WasmEmbedder } from "../src/wasm-embedder.js";
import { makeServiceClient } from "../src/supabase.js";

const store = new SupabaseStore();
let embedder: WasmEmbedder | null = null;

export async function handler(req: Request): Promise<Response> {
  const auth = await authMiddleware(req);
  if (auth instanceof Response) return auth;
  try {
    const args = DepreciationHelperInputSchema.parse((await req.json()) as unknown);

    const svc = makeServiceClient();
    const { data } = await svc.from("user_facts").select("facts").eq("user_id", auth.user_id).single();
    let userFacts: UserFacts | null = null;
    if (data) {
      const parsed = UserFactsSchema.safeParse((data as { facts: unknown }).facts);
      if (parsed.success) userFacts = parsed.data as UserFacts;
    }

    embedder ??= await WasmEmbedder.load();
    const result = await depreciationHelper({ store, embedder, userFacts }, args);
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ kind: "error", message: msg }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}

export default adapt(handler);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ato-mcp/backend exec vitest run test/handlers.test.ts`
Expected: PASS (3 new cases + all existing).

- [ ] **Step 5: Typecheck + build backend**

Run: `pnpm --filter @ato-mcp/backend typecheck && pnpm --filter @ato-mcp/backend build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/api/depreciation_helper.ts packages/backend/test/handlers.test.ts
git commit -m "feat(backend): depreciation_helper Vercel handler

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Docs + full-suite verification

**Files:**
- Modify: `CLAUDE.md`, `HANDOFF.md`

- [ ] **Step 1: Run the full suite**

Run: `pnpm -r build && pnpm -r typecheck && pnpm -r test`
Expected: all workspaces green (shared now includes the depreciation_helper suite; mcp e2e lists 11 tools; backend includes the new handler tests).

- [ ] **Step 2: Update CLAUDE.md**

In `CLAUDE.md` → "Not yet implemented (v0.4 and beyond)", change the hero-tools bullet to:

```
- Hero workflow tools: `bas_prep_checklist`, `audit_risk_check` (the product differentiator from `gunba/ato-mcp`). `deduction_discovery` and `depreciation_helper` are DONE (v0.4 tools 1–2 of 4).
```

In the "Done since v0.3 ship" section, add:

```
- **`depreciation_helper` (v0.4 tool 2 of 4) shipped.** Deterministic prime-cost / diminishing-value / IAWO / $300-immediate / SBE-pool / Div 43 schedules (`packages/shared/src/tools/depreciation_helper.ts`), branched by `business_structure` + SBE eligibility, reusing the `resolveCitations()` spine and the live `instant_asset_write_off` threshold. effective_life_years is optional (PC/DV degrade gracefully). Registered in `mcp/src/server.ts`; backend handler `backend/api/depreciation_helper.ts`. Spec: `docs/superpowers/specs/2026-06-03-depreciation-helper-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md HANDOFF.md
git commit -m "docs: mark depreciation_helper shipped (v0.4 tool 2 of 4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Final verification**

Run: `pnpm -r test`
Expected: green across all workspaces.

---

## Self-review notes

- **Spec coverage:** §2 input → Task 1; §3 catalogue + §5 math → Tasks 2–3; §4 eligibility branching + §6 output + §7 recommended + §8 worked expectations → Task 3 (tool + scenarios); §9 reuse/no-advice/failures → Task 3 (resolveCitations, getThreshold, null-guards, IAWO-null path); §11 testing → Tasks 2–5; registration/forwarding → Task 4 (forwarder automatic by name).
- **Type consistency:** `ScheduleRow` defined once (Task 2) and reused; `DepreciationHelperDeps`/`DepreciationMethodResult`/`DepreciationHelperOutput` defined once (Task 3); `Citation` imported from the tool-1 spine; `DepreciationHelperInput` from `tools.ts`.
- **Reuse:** `resolveCitations` (tool 1) and `store.getThreshold` — no new shared infrastructure.
- **No placeholders:** complete code in every step. The one judgment call (`round2` vs `round2pub` duplication) is flagged for the reviewer to collapse if trivial.
