# depreciation_helper — design spec

**Date:** 2026-06-03
**Status:** Draft for review (brainstorming → spec gate)
**Owner:** William Laverty
**Phase:** v0.4 hero workflow tools (tool 2 of 4)
**Relates to:** `docs/superpowers/specs/2026-05-25-ato-mcp-design.md` §4; `docs/superpowers/specs/2026-06-03-deduction-discovery-design.md` (reuses the `resolveCitations()` spine)

---

## 1. Purpose and contract

`depreciation_helper` takes a depreciating asset (cost, business-use %, acquisition date, optional effective life) plus the taxpayer's facts, and returns — as **structured data with corpus citations** — every depreciation method that applies to that taxpayer, with the year-by-year schedules computed where possible:

- **Div 40 prime cost** (straight line) schedule
- **Div 40 diminishing value** (post-9-May-2006, 200%) schedule
- **Instant asset write-off** (immediate, if SBE + cost under the live threshold)
- **Low-cost immediate deduction** ($300, individuals, non-business)
- **SBE simplified-depreciation pool** (15% first year, 30% thereafter)
- **Div 43 capital works** (2.5%/4% of construction cost) where the spend is structural

It is tool 2 of 4 and **reuses the `resolveCitations()` spine** built for `deduction_discovery` to attach fresh rule citations per method, and `get_threshold` for the IAWO limit.

### Non-goals (this tool, this version)

- **No advice in the tool's own voice.** Same legal frame as tool 1: structured data + citations only; the agent does prose. The `recommended` field is *eligibility-driven*, never a preference recommendation.
- **No effective-life table.** The corpus has no structured asset→years lookup; `effective_life_years` is an optional input. Absent it, prime-cost/diminishing-value go to `unavailable` (with guidance citations) while the methods that don't need it still compute. (A curated effective-life lookup is a flagged v0.5 enhancement.)
- **No low-value pool** (Div 40 Subdiv 40-E, 18.75%/37.5%), **no pre-9-May-2006 DV rate** (150%), **no balancing-adjustment-on-disposal** maths — deferred (see §10 Gaps). Pre-2006 acquisitions get a note, not a wrong number.
- **No SBE turnover auto-determination.** No aggregated-turnover threshold exists in the corpus; SBE eligibility is an optional `is_small_business_entity` input, surfaced recall-first with an eligibility caveat.

---

## 2. Dependencies and input

```ts
export interface DepreciationHelperDeps {
  store: Store | null;
  embedder: Embedder;
  userFacts: UserFacts | null;   // structure drives business-vs-individual + Div 43 relevance
}

export interface DepreciationHelperInput {
  asset_cost: number;                    // > 0; GST-exclusive if the taxpayer is GST-registered (noted in output)
  acquisition_date: string;              // "YYYY-MM-DD" — the asset's start time (first used / installed ready for use)
  business_use_pct?: number;             // 0–100, default 100 — the taxable-purpose proportion
  asset_type?: string;                   // free text (e.g. "laptop", "rental oven") — used to resolve citations + hint Div 43
  effective_life_years?: number;         // > 0; enables the PC & DV schedules
  is_small_business_entity?: boolean;    // gates IAWO / SBE pool eligibility (recall-first caveat when undefined)
  is_capital_works?: boolean;            // true → the spend is building/structural → Div 43 (default inferred false)
  method?: "prime_cost" | "diminishing_value" | "both";  // default "both" — which Div 40 schedules to compute
  fy?: string;                           // "YYYY-YY"; defaults userFacts.current_fy — sets the IAWO threshold point-in-time
  years?: number;                        // schedule horizon cap (1–40), default = ceil(effective_life_years) clamped to [1,40], else 10
}
```

Validation (`DepreciationHelperInputSchema`, Zod): `asset_cost` positive; `acquisition_date` matches `^\d{4}-\d{2}-\d{2}$`; `business_use_pct` 0–100 default 100; `effective_life_years` positive optional; `years` int 1–40 optional. If `userFacts` is null the tool throws the standard onboard error (consistent with `deduction_discovery`).

---

## 3. Method catalogue (small internal config)

A tiny inline `DEPRECIATION_METHODS` array (≈6 entries) in the tool module — *not* a generated data file (it's small and stable). Each entry carries: `id`, `label`, `legal_basis`, `seed_queries` + `seed_doc_ids` (for `resolveCitations`), `threshold?` (for IAWO), and an `applies(facts, input)` predicate. Verified corpus anchors:

| Method id | Legal basis | Key seed doc_ids (corpus-verified) |
|---|---|---|
| `prime_cost` | ITAA 1997 s 40-75; s 40-25 | `legis:c2004a05138/40-75`, `ato:…/prime-cost-straight-line-and-diminishing-value-methods` |
| `diminishing_value` | ITAA 1997 s 40-72 (post 9 May 2006); s 40-70 | `legis:c2004a05138/40-72`, `legis:c2004a05138/40-70`, `ato:…/prime-cost-straight-line-and-diminishing-value-methods` |
| `instant_asset_write_off` | Subdiv 328-D; s 328-180 | `ato:…/simpler-depreciation-for-small-business/instant-asset-write-off`, `legis:c2004a05138/328-180` |
| `low_cost_immediate_300` | ITAA 1997 s 40-80(2) | `ato:…/depreciating-assets-you-use-for-work/assets-costing-300-dollars-or-less` |
| `sbe_pool` | Subdiv 328-D; s 328-185 | `ato:…/simpler-depreciation-for-small-business/small-business-pool-calculations`, `legis:c2004a05138/328-185` |
| `capital_works_div43` | ITAA 1997 Div 43; s 43-25 | `legis:c2004a05138/43-25`, `ato:…/residential-rental-properties/rental-expenses/capital-expenses/work-out-your-capital-works-deductions` |

(The implementation plan pins the exact verified doc_ids; each is confirmed against the corpus the same way tool 1's were.)

---

## 4. Eligibility branching

`is_business = business_structure !== "none"` (sole_trader / partnership / company / trust run a business; `none` = individual/employee/investor).

| Method | Eligible when |
|---|---|
| `prime_cost`, `diminishing_value` | always applicable (the universal Div 40 methods) — **requires** `effective_life_years`; otherwise → `unavailable` |
| `instant_asset_write_off` | `is_business` **and** `is_small_business_entity !== false` **and** `asset_cost < IAWO_threshold` (resolved live). Surfaced with a caveat when `is_small_business_entity` is undefined. |
| `low_cost_immediate_300` | `!is_business` (individual/employee/investor) **and** `asset_cost <= 300` |
| `sbe_pool` | `is_business` **and** `is_small_business_entity !== false` **and** `asset_cost >= IAWO_threshold` (assets below go to IAWO). Caveat when SBE undefined. |
| `capital_works_div43` | `is_capital_works === true` (or `asset_type` matches a structural hint) — applies to rental investors (`has_investment_property`) and business premises alike |

Methods that don't fire for the taxpayer go to `unavailable` with a plain reason (e.g. "instant asset write-off is a small-business concession; your profile is an individual"). Recall-first: when SBE status is unknown, IAWO/pool are still surfaced *with* an eligibility caveat rather than hidden.

---

## 5. Computation (deterministic)

All amounts rounded to cents in the output; intermediate maths kept full-precision. `use = business_use_pct / 100`.

**Days held in a FY** — `daysHeld(fyStart, fyEnd, acquisition_date)` = inclusive day count from `max(acquisition_date, fyStart)` to `fyEnd`. First FY is prorated; later FYs are full (365, or 366 in a leap FY — but the ATO formula divides by 365, which we follow, noting the minor leap-year nuance).

**Prime cost** (per FY): `decline = asset_cost × (daysHeld/365) × (1/effective_life)`. `deduction = decline × use`. `closing = opening − decline`. Constant `asset_cost/effective_life` for full years; run until `closing <= 0` or `years` cap.

**Diminishing value** (post-9-May-2006): `decline = opening_adjustable_value × (daysHeld/365) × (2/effective_life)`. `deduction = decline × use`. `closing = opening − decline`. `opening` for FY1 = `asset_cost`; subsequent FYs = prior `closing`. Runs to the `years` cap (DV asymptotes, never reaching 0). If `acquisition_date < 2006-05-10`, DV → `unavailable` with a "pre-2006 150% rate not supported" note.

**Instant asset write-off**: `deduction = asset_cost × use` in FY1; `first_year_deduction = deduction`; carries the resolved `threshold` row. Eligible only if `asset_cost < threshold.value`.

**Low-cost $300**: `deduction = asset_cost × use` in FY1.

**SBE pool**: FY1 `deduction = asset_cost × use × 0.15`; FY_n (n>1) `deduction = opening_pool × 0.30` where `opening_pool` is the prior closing; note that the pool is an aggregate across all assets — this shows the per-asset contribution pattern only.

**Div 43 capital works**: `rate = 0.025` (2.5%, default) — `deduction = asset_cost × rate × use` per FY for 40 years (note 4% / 25-year applies to limited building types; flagged, not auto-applied). Based on *construction cost*, not market value (noted).

Each method result includes a year-by-year `schedule` where it spans years (PC, DV, SBE pool, Div 43) or a single `first_year_deduction` (IAWO, $300).

---

## 6. Output

```ts
export interface DepreciationScheduleRow {
  fy: string;                       // "2025-26"
  opening_adjustable_value: number;
  decline_in_value: number;         // full decline (reduces adjustable value)
  business_use_pct: number;
  deduction: number;                // decline × use — the claimable amount
  closing_adjustable_value: number;
}
export interface DepreciationMethodResult {
  method: string;                   // one of the catalogue ids
  label: string;
  eligible: boolean;
  eligibility_reason: string;
  first_year_deduction: number | null;
  total_base: number;               // asset_cost × use (the deductible base)
  schedule: DepreciationScheduleRow[];   // [] for immediate methods
  threshold: ThresholdRow | null;   // populated for IAWO
  legal_basis: string;
  citations: Citation[];            // resolve via get_chunks / get_doc
  notes: string[];
}
export interface DepreciationHelperOutput {
  inputs_echo: { asset_cost: number; acquisition_date: string; business_use_pct: number; effective_life_years: number | null; fy: string; asset_type: string | null };
  taxpayer_context: { business_structure: BusinessStructure; is_business: boolean; is_small_business_entity: boolean | null };
  methods: DepreciationMethodResult[];      // eligible methods, computed
  unavailable: Array<{ method: string; reason: string }>;  // e.g. PC/DV when no effective life; IAWO when not a business
  recommended: { method: string; rationale: string } | null;   // eligibility-driven only (see §7)
  disclaimer: string;
  notes: string[];                  // GST-exclusivity, car-limit, second-hand-rental, pre-2006, SBE-turnover caveats
}
```

---

## 7. The `recommended` field (eligibility-driven, not advice)

- If `instant_asset_write_off` is eligible → recommend it (immediate full deduction this year), rationale citing the threshold.
- Else if `low_cost_immediate_300` eligible → recommend it.
- Else if only `capital_works_div43` applies (structural spend) → recommend Div 43 (the others don't apply to capital works).
- Else (PC and DV both available) → **`recommended` stays the lower-commitment framing**: `{ method: "diminishing_value | prime_cost — taxpayer choice", rationale: "Diminishing value front-loads deductions; prime cost spreads them evenly. This is a taxpayer election (ITAA 1997 s 40-65/40-130), not a recommendation — see citations." }`. We do **not** pick one — choosing is a cash-flow preference, which would be advice.
- If nothing is computable (no effective life, not a business, not capital works) → `recommended = null` with a note to supply `effective_life_years`.

---

## 8. Branching by taxpayer type — worked expectations

- **`none` (individual/employee/investor):** PC + DV (if effective life given); `$300` immediate if `cost <= 300`; Div 43 if `is_capital_works` (rental). IAWO + SBE pool → `unavailable` ("small-business concessions"). If `has_investment_property` and the asset is rental plant, a note about the **second-hand depreciating-asset restriction** (post-9-May-2017) is added.
- **`sole_trader` / `company` / `trust` / `partnership` (business):** IAWO (if SBE & under threshold) → recommended; SBE pool (if SBE & at/above threshold); PC + DV always available; Div 43 if capital works. `$300` immediate → `unavailable` (it's the non-business rule; business low-cost assets use IAWO/pool/Div 40). When `is_small_business_entity` is undefined, IAWO/pool are surfaced with the caveat "assumes you are a small business entity (aggregated turnover under the relevant threshold) — confirm eligibility."
- **car asset hint** (`asset_type` contains "car"/"vehicle"): a note that the **car limit** caps the depreciable cost for a car (Div 28 / s 40-230) — not auto-applied (the car-limit threshold isn't in the corpus catalogue), flagged for the agent.

---

## 9. No-advice, reuse, failures

- **Reuse:** `resolveCitations()` from `packages/shared/src/lib/citations.ts` (the spine shipped with tool 1) attaches per-method citations; `store.getThreshold("instant_asset_write_off", pit)` for the IAWO limit. No new shared infrastructure.
- **No-advice:** mandatory `disclaimer`; `recommended` is eligibility-driven only (§7).
- **No silent failures:** null facts → onboard throw; null store → "Corpus not installed" throw; if the IAWO threshold doesn't resolve (e.g. local stale corpus), IAWO is surfaced as `eligible: false` with reason "instant asset write-off threshold unavailable for {fy}" — never a fabricated limit.

---

## 10. Gaps (deferred, documented)

- **Curated effective-life lookup** (auto-fill common assets) — v0.5.
- **Low-value pool** (Subdiv 40-E), **pre-9-May-2006 DV (150%)**, **balancing adjustments on disposal**, **car-limit auto-application**, **second-hand rental auto-denial**, **Div 43 4%/25-year auto-detection** — all flagged via notes rather than computed.
- **SBE aggregated-turnover auto-determination** — needs a new threshold + pipeline extractor (same class of work as `audit_risk_check`'s benchmarks); deferred.

---

## 11. Testing strategy

### Unit (vitest, mock `store` + `embedder` + `userFacts`)
- **PC math:** `$1,000`, life 5, 100% use, acquired `2025-07-01` (FY start) → FY1 deduction `$200`, schedule sums to ~`$1,000` over 5 years.
- **DV math:** same asset → FY1 `$400` (200%/5 × 1,000), declining; FY2 opening `$600`.
- **First-year proration:** acquired mid-FY (`2026-01-01`) → FY1 PC deduction ≈ `$200 × 181/365`.
- **business_use_pct:** 50% → deduction halves; `closing_adjustable_value` still reduces by the full decline.
- **IAWO:** business + SBE + `cost < threshold` → eligible, `first_year_deduction = cost × use`; not SBE (`is_small_business_entity:false`) → ineligible with reason.
- **$300 immediate:** individual + `cost = 250` → eligible; business → `unavailable`.
- **Div 43:** `is_capital_works:true`, cost `$200,000` → `$5,000`/yr (2.5%).
- **Structure branching:** individual → no IAWO/pool; sole trader → IAWO present.
- **No effective life:** PC + DV in `unavailable`; IAWO/$300/Div43 still computed.
- **Pre-2006 acquisition:** DV → `unavailable` with the 150% note.
- **null facts → throws `/onboard/`.**

### Integration (backend handler, `MOCK_SUPABASE=1`)
- `packages/backend/api/depreciation_helper.ts` — standard shape (`adapt` + `authMiddleware` + resolve `user_facts` + tool). Tests: 401 without auth; factless-user onboard error (mock returns null facts → 400).

### Registration / forwarding
- `DepreciationHelperInputSchema` added to `packages/shared/src/tools.ts`; `ToolName` extended.
- Registered in `packages/mcp/src/server.ts` (TOOLS entry + dispatch passing `{store, embedder, userFacts}`); the e2e tool-list assertion updated to 11 tools.
- Backend route name `depreciation_helper` → picked up automatically by `RemoteToolForwarder`.
- Shared subpath export `./tools/depreciation_helper` added to `packages/shared/package.json`.
