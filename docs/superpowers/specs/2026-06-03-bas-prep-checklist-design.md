# bas_prep_checklist — design spec

**Date:** 2026-06-03
**Status:** Draft for review (brainstorming → spec gate)
**Owner:** William Laverty
**Phase:** v0.4 hero workflow tools (tool 3 of 4)
**Relates to:** `docs/superpowers/specs/2026-05-25-ato-mcp-design.md` §4; reuses the `resolveCitations()` spine (tool 1) and the curated-catalogue pattern (tools 1–2).

---

## 1. Purpose and contract

`bas_prep_checklist` produces, for a GST-registered taxpayer, a **structured, tiered checklist** of the Business Activity Statement sections that apply to them for their reporting period — which labels to complete, what evidence to gather, and the common gotchas — each backed by corpus citations. It does **not** compute any dollar amounts; it tells the taxpayer *what to prepare and where it goes*.

Output is structured data + resolvable citations (same legal frame as tools 1–2): the agent does prose; the tool never gives advice in its own voice.

### Non-goals (this version)
- **No amount calculation** (no GST/PAYG/FTC totals — the tool lists labels and evidence, not figures).
- **No lodgement** (it prepares; the user lodges via Online services / a BAS agent).
- **No new facts.** Works off the existing `UserFactsSchema`. Sections with no backing fact (employees/PAYG-W, fuel tax credits, WET, LCT) are surfaced as **conditional** ("applies if…"), not omitted (the locked tiered-recall-first decision).
- **No agent-concession due dates beyond a note** (statutory due dates are given; the BAS-agent/online concession is noted, not computed per-taxpayer).

---

## 2. Dependencies and input

```ts
export interface BasPrepChecklistDeps {
  store: Store | null;
  embedder: Embedder;
  userFacts: UserFacts | null;     // gst_registered, gst_period, payg_instalments, fbt_payer, business_structure
}

export interface BasPrepChecklistInput {
  period_type?: "monthly" | "quarterly" | "annual";  // defaults userFacts.gst_period (mapped)
  quarter?: 1 | 2 | 3 | 4;          // for a quarterly due-date; ignored otherwise
  fy?: string;                       // "YYYY-YY"; defaults userFacts.current_fy (due-date + citation pit)
  full_gst_method?: boolean;         // true → include full-BAS labels (G2/G3/G10/G11); default false (Simpler BAS)
}
```

`userFacts` null → standard onboard throw (consistent with tools 1–2). `period_type` defaults from `gst_period` (`n/a` → the not-registered path, §6).

---

## 3. The BAS section catalogue (curated)

A small inline `BAS_SECTIONS` catalogue (~13 entries) in the tool module (small + stable, like the depreciation method catalogue — not a generated file). Each entry:

```ts
interface BasSectionDef {
  id: string;
  label: string;                 // human label, e.g. "GST on sales (1A)"
  tier: "core" | "confirmed" | "conditional";
  bas_labels: string[];          // the BAS form labels, e.g. ["1A"]
  applies(facts, input): boolean;
  applies_reason(facts): string;
  what_to_gather: string[];
  gotchas: string[];
  seed_queries: string[];
  seed_doc_ids: string[];        // best-effort corpus pins; citations resolve live regardless
  legal_basis?: string;
}
```

### Sections (tiered)

**core** — surfaced when `gst_registered` (Simpler BAS labels by default):
- `gst_total_sales` — **G1** Total sales (incl GST). Gather: total sales for the period incl GST-free & input-taxed. Gotcha: G1 includes all sales, not just taxable.
- `gst_on_sales` — **1A** GST on sales. Gather: GST collected on taxable sales. Gotcha: include GST on taxable sales of assets.
- `gst_on_purchases` — **1B** GST on purchases. Gather: GST credits on business purchases. Gotcha: need a valid tax invoice for purchases > $82.50; exclude private-use and input-taxed-supply portions.
- `gst_accounting_basis` — cash vs accruals reporting basis + reporting method (Simpler vs full). Gather: confirm your registered method. Gotcha: the basis determines *when* a sale/purchase is reported.

**core / conditional on `full_gst_method`** — full-BAS extra labels (only if not on Simpler BAS):
- `gst_full_method_labels` — **G2** exports, **G3** GST-free sales, **G10** capital purchases, **G11** non-capital purchases. Tier `conditional` unless `full_gst_method`.

**confirmed** — surfaced from facts:
- `payg_income_instalment` — **T7** (and T1/T2/T4/T11) PAYG income-tax instalment. Gated `payg_instalments`. Gather: instalment income, or use the ATO-notified instalment amount. Gotcha: the instalment is a *pre-payment* of income tax, reconciled at lodgment.
- `fbt_instalment` — **F1–F4** FBT instalment. Gated `fbt_payer`. Gather: your FBT instalment amount (ATO-notified) or varied estimate. Gotcha: only appears for registered FBT payers; the annual FBT return is separate.

**conditional** — no backing fact; surfaced with an "applies if…" reason:
- `payg_withholding` — **W1** total payments, **W2** amounts withheld, **W3/W4**, **5A/5B**. Applies if you employ staff or withhold (e.g. no-ABN withholding). Gather: payroll/STP totals for the period. Gotcha: W2 must reconcile with STP.
- `fuel_tax_credits` — **7D** fuel tax credits. Applies if you use fuel in machinery/heavy vehicles. Gather: litres by activity; use the ATO FTC calculator/rates. Gotcha: rates change each indexation; use the rate for the period.
- `wine_equalisation_tax` — **1C/1D** WET. Applies if you make/import/wholesale wine. 
- `luxury_car_tax` — **1E/1F** LCT. Applies if you sell/import luxury cars above the LCT threshold.

**cross-cutting** — always surfaced when registered:
- `lodge_and_pay` — lodgement channels (Online services for business / BAS agent) + the period due date (§5) + payment options. Gotcha: lodge even if nil ("nil BAS").
- `records_and_corrections` — keep records 5 years; how to correct a GST error on a later BAS. Gotcha: thresholds/time limits apply to correcting errors vs revising.

Each section resolves live citations via `resolveCitations(seed_queries, {pinnedDocIds: seed_doc_ids, pit})`. Verified corpus anchors include the BAS forms (`ato:forms-and-instructions/bas-*`), `ato:…/business-activity-statements-bas/goods-and-services-tax-gst/simpler-bas-gst-bookkeeping-guide`, `ato:…/gst/accounting-for-gst-in-your-business`, the PAYG-instalments how-to page, and the fuel-tax-credit / WET / LCT pages (all confirmed present).

---

## 4. Tiering and assembly

1. If `!gst_registered` → §6 not-registered path.
2. `period_type = input.period_type ?? mapGstPeriod(facts.gst_period)`.
3. For each catalogue section where `applies(facts, input)`: resolve citations + emit `{id, label, tier, applies_reason, bas_labels, what_to_gather, gotchas, citations}`.
4. Order by tier (`core` → `confirmed` → `conditional`), cross-cutting (`lodge_and_pay`, `records_and_corrections`) last.
5. Attach the reporting summary (§5) + `notes` (Simpler-vs-full BAS; agent due-date concession; "lodge nil if no activity").

---

## 5. Reporting period + due date

`mapGstPeriod`: `monthly`→monthly, `quarterly`→quarterly, `annual`→annual, `n/a`→(not registered).

| period_type | form | statutory due date |
|---|---|---|
| monthly | monthly BAS | 21st of the month after the period |
| quarterly | quarterly BAS | Q1 28 Oct · Q2 28 Feb · Q3 28 Apr · Q4 28 Jul (of the relevant year) |
| annual | annual GST return (BAS Z) | with the income tax return (or 28 Feb if not required to lodge a return) |

`reporting = { period_type, period_label, form, due_date | null, simpler_bas: !full_gst_method }`. The quarterly due date is computed from `quarter` + `fy`; a note flags that lodging through a BAS agent or online may extend it.

---

## 6. Not-registered path

When `gst_registered === false`:
- `registered: false`, `sections: []` for GST.
- If `payg_instalments` → surface the `payg_income_instalment` section on an **Instalment Activity Statement (IAS)** (not a BAS) with its citations, plus a `not_applicable_note` "You are not registered for GST, so you do not lodge a BAS. You lodge an Instalment Activity Statement (IAS) for PAYG instalments."
- Else → `not_applicable_note` "You are not registered for GST and have no PAYG instalment obligation, so you do not lodge a BAS or IAS." (still returns the cross-cutting records guidance + disclaimer).

No throw — a clear, cited "nothing to do here" is the correct, helpful result.

---

## 7. Output

```ts
export interface BasSectionResult {
  id: string; label: string; tier: "core" | "confirmed" | "conditional";
  applies_reason: string; bas_labels: string[];
  what_to_gather: string[]; gotchas: string[];
  legal_basis: string | null;
  citations: Citation[];
}
export interface BasPrepChecklistOutput {
  registered: boolean;
  reporting: { period_type: string; period_label: string; form: string; due_date: string | null; simpler_bas: boolean };
  taxpayer_context: { business_structure: BusinessStructure; gst_period: string; payg_instalments: boolean; fbt_payer: boolean };
  sections: BasSectionResult[];
  not_applicable_note: string | null;
  disclaimer: string;
  notes: string[];
}
```

---

## 8. No-advice, reuse, failures
- **Reuse:** `resolveCitations()` (tool 1 spine). No `get_threshold` needed (BAS prep lists labels, not amounts — the GST-registration and FTC thresholds are informational, surfaced via citations not computed).
- **No-advice:** mandatory `disclaimer`; the checklist describes obligations + evidence, never "you should claim X".
- **No silent failures:** null facts → onboard throw; null store → "Corpus not installed" throw; not-registered → the §6 cited note (not an error).

---

## 9. Gaps (deferred, documented)
- **`has_employees` / withholding-registration facts** — would let PAYG-W move from conditional to confirmed. v0.4 surfaces it conditionally.
- **GST turnover fact** — would let Simpler-vs-full BAS be auto-determined instead of the `full_gst_method` input + default.
- **Per-taxpayer agent-concession due dates** — only the statutory dates + a concession note are given.
- **Nil/again, instalment variation maths** — out of scope (no amounts).

---

## 10. Testing strategy

### Unit (vitest, mock `store` + `embedder` + `userFacts`)
- **GST-registered quarterly:** core G1/1A/1B + accounting-basis surface; `reporting.form` = quarterly BAS; `due_date` for `quarter:2` = `…-02-28`.
- **payg_instalments true:** `payg_income_instalment` present, tier `confirmed`.
- **fbt_payer true:** `fbt_instalment` present.
- **Conditional always present:** PAYG-W / FTC / WET / LCT appear with tier `conditional` and an "applies if…" reason (recall-first).
- **full_gst_method true:** `gst_full_method_labels` tier becomes non-conditional / surfaces G2/G3/G10/G11.
- **Not registered + payg_instalments:** `registered:false`, IAS note, `payg_income_instalment` present; no GST core sections.
- **Not registered + no PAYG-I:** `registered:false`, "no BAS or IAS" note, GST/PAYG sections absent.
- **Citations resolve** for a core section (mock store returns a hit).
- **null facts → throws `/onboard/`.**

### Integration (backend handler, `MOCK_SUPABASE=1`)
- `packages/backend/api/bas_prep_checklist.ts` — standard shape. Tests: 401 without auth; factless-user onboard error (mock null facts → 400).

### Registration / forwarding
- `BasPrepChecklistInputSchema` in `packages/shared/src/tools.ts`; `ToolName` extended.
- Registered in `packages/mcp/src/server.ts` (TOOLS + dispatch); e2e tool-list → 12 tools.
- Backend route `bas_prep_checklist` → automatic via `RemoteToolForwarder`.
- Shared subpath export `./tools/bas_prep_checklist`.
