# audit_risk_check — design spec

**Date:** 2026-06-03
**Status:** Draft for review (brainstorming → spec gate)
**Owner:** William Laverty
**Phase:** v0.4 hero workflow tools (tool 4 of 4)
**Scope decision (locked):** **Qualitative, cited red-flags** — no numeric per-industry/occupation benchmarking (that needs a `benchmarks` table + pipeline extractor + re-import; deferred to v0.5). The output schema is designed so numeric benchmarks can slot in later.
**Relates to:** `docs/superpowers/specs/2026-05-25-ato-mcp-design.md` §4; reuses the `resolveCitations()` spine (tool 1) and the curated-catalogue pattern (tools 1–3).

---

## 1. Purpose and contract

`audit_risk_check` takes the taxpayer's facts plus a **draft return summary** (income + draft deduction claims) and flags the patterns the ATO is known to scrutinise — high work-related expenses relative to income, large round numbers, rental over-claims, work-from-home double-dipping, deductions exceeding income, unreported crypto, etc. — each with the **risk band**, **why it was flagged for this taxpayer**, **what to do** (verify / keep records), and the **ATO guidance citation**.

It is a **risk indicator, not advice and not an ATO determination**: findings say "this resembles a pattern the ATO scrutinises — verify and keep records," never "you will be audited" or "reduce this claim." The risk heuristics (e.g. WRE > 12% of income) are the tool's own conservative flags, explicitly documented; the *authority* for each pattern is the cited ATO guidance.

### Non-goals (this version)
- **No numeric benchmarking** (no "your claim is above the 73rd percentile for your ANZSIC code"). The corpus has the *guidance* pages but not the structured benchmark numbers, and there is no `benchmarks` table. Deferred to v0.5.
- **No amount correction / optimisation** (it does not tell the user what to claim).
- **No income-vs-lifestyle / asset-betterment analysis** (out of scope; no data).
- **No new facts.** Uses the existing `UserFactsSchema`; the draft figures come in as input.

---

## 2. Dependencies and input

```ts
export interface AuditRiskCheckDeps {
  store: Store | null;
  embedder: Embedder;
  userFacts: UserFacts | null;
}

export interface AuditRiskCheckInput {
  income?: number;                                   // total assessable income for the FY (optional but enables ratio checks)
  deductions?: Array<{ category: string; amount: number }>;  // draft deduction claims (free-text category label + amount)
  rental?: { income?: number; interest?: number; repairs?: number; capital_works?: number };  // optional rental detail
  business_income?: number;                          // optional, for sole-trader non-commercial-loss check
  fy?: string;                                       // defaults userFacts.current_fy (citation pit)
}
```

`userFacts` null → standard onboard throw. All figures optional: with no figures, the tool still surfaces fact-driven flags (e.g. `has_crypto` with no crypto gain field, no prior-year lodgement) and notes which checks were skipped for lack of data.

---

## 3. Red-flag rule catalogue (curated)

A small inline `RISK_RULES` catalogue (~13 entries). Each:

```ts
interface RiskRule {
  id: string;
  title: string;
  default_band: "low" | "medium" | "high";
  pattern: string;            // what the ATO targets (static description)
  what_to_do: string;         // verify / records guidance (static)
  seed_queries: string[];
  seed_doc_ids: string[];
  legal_basis: string | null;
  // returns null if not triggered, else the per-taxpayer explanation + optional band escalation
  detect: (facts: UserFacts, input: AuditRiskCheckInput, m: DerivedMetrics) => { why_flagged: string; band?: "low" | "medium" | "high" } | null;
}
```

`DerivedMetrics` (computed once): `total_deductions`, `deduction_to_income_pct`, `wre_total` (sum of deductions whose category matches a WRE keyword set), `has_category(keywords)`, `category_amount(keywords)`, `round_number_claims` (count of deduction amounts that are exact multiples of $100 ≥ $300).

### Rules (with conservative heuristics — documented, not statutory)

| id | trigger (heuristic) | band | cites |
|---|---|---|---|
| `wre_high_vs_income` | `wre_total > 12% of income` (→ high if > 20%) | medium | work-related-deductions; occupation guides; s 8-1 |
| `deductions_exceed_income` | `total_deductions > income` | medium | non-commercial losses |
| `large_round_numbers` | ≥1 deduction is an exact multiple of $100 ≥ $300 (→ medium if ≥3) | low | record-keeping / substantiation Div 900 |
| `near_300_substantiation` | a WRE category amount in [$295, $300] (claiming up to the no-receipt cap) | medium | $300 written-evidence rule (Div 900) |
| `car_near_cap` | a car/D1 category amount in [$3,300, $5,000] (near the 5,000 km cents-per-km max) | low | D1 car expenses; Div 28 |
| `wfh_phone_double` | both a "working from home" category AND a separate "phone/internet" category present | medium | PCG 2023/1 (WFH fixed rate bundles phone/internet) |
| `clothing_high` | a clothing/laundry category > $150 (laundry no-receipt limit) | low | TR 97/12 |
| `self_education_present` | a self-education category present | low | TR 2024/3 (must connect to current work) |
| `rental_deductions_no_income` | `has_investment_property` AND rental deductions present AND (`rental.income` missing or 0) | high | genuinely-available-for-rent; TR 2026/1 |
| `rental_interest_vs_income` | `rental.interest > rental.income` (and income present) | medium | rental focus; interest apportionment (TR 2000/2) |
| `rental_repairs_large` | `rental.repairs > 0` AND (`rental.repairs > rental.income` OR `> $5,000`) | medium | TR 97/23 (repairs vs capital) |
| `crypto_unreported` | `has_crypto` AND no crypto/capital-gain signal in the draft (no category matching "crypto"/"capital gain", and `income` provided) | medium | data-matching for investments & assets |
| `no_prior_year_lodged` | `prior_fy_lodged === false` | low | lodgment program / "what attracts our attention" |

Verified corpus anchors include `ato:…/our-focus-areas-for-small-business/what-attracts-our-attention-in-small-business`, `ato:…/losses/non-commercial-losses`, `ato:…/data-matching-letters/types-of-letters/data-matching-for-investment-and-assets`, `ato:…/deductions-you-can-claim/work-related-deductions`, `legis:c2004a05138/8-1`, plus the TR/PCG rulings reused from tool 1's taxonomy (`ato-law:PCG/2023/1`, `ato-law:TXR/TR9712/...`, `ato-law:TXR/TR9723/...`). Citations resolve live via `seed_queries`; `seed_doc_ids` are best-effort pins.

---

## 4. Assembly

```
1. fy = input.fy ?? facts.current_fy; pit = fyToPit(fy)
2. m = deriveMetrics(facts, input)
3. for each rule: r = rule.detect(facts, input, m); if r → resolve citations, emit finding {id, title, risk_band: r.band ?? default_band, pattern, why_flagged: r.why_flagged, what_to_do, citations, legal_basis}
4. order findings by band (high → medium → low)
5. overall_risk = highest finding band (or "low" if none)
6. checked = every rule id evaluated (transparency); skipped = checks that needed missing data (e.g. ratio checks when income absent)
```

---

## 5. Output

```ts
export interface AuditRiskFinding {
  id: string; title: string;
  risk_band: "low" | "medium" | "high";
  pattern: string; why_flagged: string; what_to_do: string;
  legal_basis: string | null;
  citations: Citation[];
}
export interface AuditRiskCheckOutput {
  fy: string;
  taxpayer_context: { business_structure: BusinessStructure; occupation: string | null; has_investment_property: boolean; has_crypto: boolean };
  summary: { income: number | null; total_deductions: number | null; deduction_to_income_pct: number | null };
  findings: AuditRiskFinding[];
  overall_risk: "low" | "medium" | "high";
  checked: string[];                 // rule ids evaluated
  skipped: Array<{ id: string; reason: string }>;  // checks not run for lack of data
  disclaimer: string;
  notes: string[];
}
```

`overall_risk` is framed (in `disclaimer`/`notes`) as a heuristic flag, not an audit prediction.

---

## 6. No-advice, reuse, failures
- **Reuse:** `resolveCitations()` (tool 1 spine). No `get_threshold` (qualitative — no amounts compared to thresholds).
- **No-advice:** mandatory `disclaimer`; findings describe ATO-scrutiny patterns + cite guidance + advise verification/records, never "reduce this" or "you'll be audited." Heuristic thresholds are the tool's own conservative flags, documented as such.
- **No silent failures:** null facts → onboard throw; null store → "Corpus not installed" throw; missing figures → checks gracefully skipped + listed in `skipped` (never a fabricated ratio).

---

## 7. Gaps (deferred, documented)
- **Numeric benchmarking** (per-ANZSIC / occupation ranges) — needs a `benchmarks` table + pipeline extractor + Supabase re-import. The `summary` + `findings` shapes are forward-compatible (a finding could later carry a `benchmark: {low, high, your_value}` block). **v0.5.**
- **Income-vs-lifestyle / asset-betterment**, **prior-year-comparison** (no historical data), **occupation-specific WRE norms** (qualitative only here).
- **Heuristic-threshold tuning** — the percentages/dollar cutoffs are conservative first-pass values; a future calibration pass against real ATO benchmark data would replace them.

---

## 8. Testing strategy

### Unit (vitest, mock `store` + `embedder` + `userFacts`)
- **High WRE:** `income: 60000`, a WRE deduction of `12000` (20%) → `wre_high_vs_income` fires `high`; `overall_risk: "high"`.
- **Deductions > income:** total deductions exceed income → `deductions_exceed_income` fires.
- **Round numbers:** deductions `[{wre, 1000},{donations, 500},{other, 300}]` → `large_round_numbers` fires `medium` (≥3 round).
- **WFH double-dip:** categories include "working from home" and "phone and internet" → `wfh_phone_double` fires.
- **Rental no income:** `has_investment_property` + `rental: {interest: 8000}` + no `rental.income` → `rental_deductions_no_income` fires `high`.
- **Crypto unreported:** `has_crypto:true`, `income: 90000`, no crypto/capital-gain category → `crypto_unreported` fires.
- **Clean return:** modest figures, no triggers → `findings: []`, `overall_risk: "low"`.
- **Missing income:** no `income` → ratio checks appear in `skipped` with a reason; tool still runs.
- **Citations resolve** for a fired finding (mock store returns a hit).
- **null facts → throws `/onboard/`.**

### Integration (backend handler, `MOCK_SUPABASE=1`)
- `packages/backend/api/audit_risk_check.ts` — standard shape. Tests: 401 without auth; factless-user onboard error (mock null facts → 400).

### Registration / forwarding
- `AuditRiskCheckInputSchema` in `packages/shared/src/tools.ts`; `ToolName` extended.
- Registered in `packages/mcp/src/server.ts` (TOOLS + dispatch); e2e tool-list → 13 tools.
- Backend route `audit_risk_check` → automatic via `RemoteToolForwarder`.
- Shared subpath export `./tools/audit_risk_check`.
