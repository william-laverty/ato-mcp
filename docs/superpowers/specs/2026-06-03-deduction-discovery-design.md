# deduction_discovery — design spec

**Date:** 2026-06-03
**Status:** Draft for review (brainstorming → spec gate)
**Owner:** William Laverty
**Phase:** v0.4 hero workflow tools (tool 1 of 4)
**Relates to:** `docs/superpowers/specs/2026-05-25-ato-mcp-design.md` §4 (hero workflow tools), §1 (legal frame)
**Companion data:** `2026-06-03-deduction-discovery-taxonomy.json` (59 verified category rows), `2026-06-03-deduction-discovery-analysis.json` (coverage / edge-cases / test scenarios / gaps from the research workflow)

---

## 1. Purpose and contract

`deduction_discovery` takes a taxpayer's stored facts plus an optional free-text description of an activity or spend, and surfaces **every deduction-related category that plausibly applies to that taxpayer**, each with:

- resolvable corpus citations (`chunk_id`s that resolve via `get_chunks`, `doc_id`s via `get_doc`),
- the controlling legal basis (ITAA 1997 section / ATO ruling),
- a discrete confidence rating with a reason,
- worked examples, substantiation requirements, and a "have you considered…" nudge,
- linked time-keyed thresholds (resolved live via `get_threshold`).

It is the first and most cross-cutting of the four v0.4 hero tools. It establishes the reusable spine — **filter a curated taxonomy by user facts → resolve fresh citations → attach thresholds → rate confidence** — that `bas_prep_checklist` and `audit_risk_check` will reuse.

### Non-goals (this tool, this version)

- **No advice in the tool's own voice.** Per design §1 legal frame, the tool returns structured data + citations only. The agent does any prose. `confidence` measures eligibility/citation strength, never "you should claim this".
- **No dollar amounts or totals.** It does not compute a taxpayer's deductible amount. It surfaces *categories*, not figures. (Depreciation math is `depreciation_helper`; numeric benchmarking is `audit_risk_check`.)
- **No entity-return completeness.** The taxonomy is personal-return-centric with a *common* company/trust/partnership entity set. Full entity coverage (FBT-as-deduction, start-up/blackhole s 40-880, prepaid-expense regime, SMSF fund-level deductions, partnership/trust distribution mechanics) is explicitly deferred — see §11 Gaps.
- **No new facts fields.** Works against the existing `UserFactsSchema` (25 fields). Residency, property-ownership-entity, R&D, and PSI nuances are handled as runtime *caveats*, not new facts (see §9).

---

## 2. Dependencies and input

Follows the existing `(deps, args) => result` contract. Adds a `userFacts` dep, plumbed exactly like `get_user_facts` (see `packages/shared/src/tools/get_user_facts.ts`): the backend handler resolves facts via `getUserFacts` and passes them in; local mode reads them from `~/.ato-mcp/config.json`.

```ts
export interface DeductionDiscoveryDeps {
  store: Store | null;          // corpus access (hybrid search, thresholds)
  embedder: Embedder;           // query embedding for citation resolution
  userFacts: UserFacts | null;  // the taxpayer profile that drives branching
}

export interface DeductionDiscoveryInput {
  activity?: string;             // optional free-text spend/activity, e.g. "bought a $1,800 laptop for work"
  fy?: string;                   // FY override "YYYY-YY"; defaults to userFacts.current_fy
  k_citations?: number;          // citations to resolve per surfaced category (default 3, max 5)
  include_low_confidence?: boolean; // default true — recall-first
}
```

If `userFacts` is null the tool throws the same actionable error as `get_user_facts` ("Personal facts not set. Run `ato-mcp onboard`…"). It never silently degrades.

---

## 3. The taxonomy (curated spine)

The category set is a versioned, corpus-grounded data file: `packages/shared/src/data/deduction-categories.ts`, seeded from the verified `2026-06-03-deduction-discovery-taxonomy.json` (59 rows). Each row:

```ts
export type FactsOp = "truthy" | "falsy" | "eq" | "in";
export interface FactsPredicate {
  field: keyof UserFacts;        // must be a real facts field (validated by a unit test)
  op: FactsOp;
  value?: string;                // for eq/in
}

export type CategoryKind =
  | "deduction"      // a claimable deduction
  | "offset"         // a tax offset (reduces tax, NOT a deduction) — e.g. spouse super offset
  | "cgt_event"      // a CGT outcome to report — e.g. crypto disposal
  | "disallowance"   // a NOT-deductible warning — e.g. rental travel (s 26-31), vacant land (s 26-102)
  | "precondition"   // a gating requirement worth $0 itself — e.g. super notice of intent
  | "strategy";      // an adjacent planning interaction — e.g. FHSS, carry-forward concessional

export interface DeductionCategory {
  id: string;                          // stable snake_case id
  label: string;
  kind: CategoryKind;                  // how the output renders + whether it counts as a deduction
  structures: BusinessStructure[];     // gates on userFacts.business_structure
  return_context: "personal" | "business_entity";
  triggers: FactsPredicate[];          // AND-ed; empty = applies to everyone in `structures`
  dedupe_key?: string;                 // economic-claim key; rows sharing one collapse to a single output card
  seed_queries: string[];              // 2–4 NL queries used to resolve live citations
  seed_doc_ids: string[];              // 2–4 corpus-verified authoritative doc_ids (pins)
  thresholds: string[];                // allow-listed threshold names, resolved at runtime
  examples: string[];
  substantiation: string;
  consider_prompt: string;
  ato_focus_area: boolean;             // known ATO scrutiny area (flag only; numbers → audit_risk_check)
  legal_basis: string;                 // controlling ITAA section / ruling
  residency_caveat?: boolean;          // true → attach a residency note for non-resident/WHM/temp-resident
  fy_note?: string;                    // FY-sensitive law-change note (e.g. GIC/SIC repeal from 1 Jul 2025)
  notes?: string;
}
```

`kind`, `dedupe_key`, `residency_caveat`, and `fy_note` are additions beyond the research JSON, introduced to resolve the open questions in §9. The build step that converts the JSON → TS data file assigns them (mechanical; see implementation plan).

A category **surfaces** when:
1. `userFacts.business_structure ∈ category.structures`, **and**
2. every `trigger` predicate passes against `userFacts`.

The full taxonomy is grouped by slice in the Appendix (§13).

---

## 4. Resolution algorithm

```
1. fy = args.fy ?? userFacts.current_fy
2. candidates = TAXONOMY.filter(c => structureMatches(c, facts) && allTriggersPass(c, facts))
3. dedupe candidates by dedupe_key (keep the most structure-specific row;
   union examples; choose the consider_prompt matching the user's structure)
4. for each surviving category (bounded concurrency):
     citations = resolveCitations({store, embedder}, c.seed_queries, { k: k_citations, pit: fyToPit(fy) })
                 // hybrid search, same path as search.ts; seed_doc_ids pinned/boosted
     thresholds = await Promise.all(c.thresholds.map(n => store.getThreshold(n, fyToPit(fy))))
     confidence = rateConfidence(c, facts, citations)
5. if args.activity:
     activityVec = embedder.embed(activity)
     score each surfaced category against activity (cosine vs its resolved citations / label);
     set matched_activity = best category + rationale (never suppress others)
6. order: ato_focus_area first within each (return_context, kind) group, then by confidence
7. attach residency_caveats (if residency_status ≠ resident) and fy notes
8. return structured output (§5)
```

### Reusable spine — `resolveCitations()`

Extract `packages/shared/src/lib/citations.ts`:

```ts
export async function resolveCitations(
  deps: { store: Store; embedder: Embedder },
  seedQueries: string[],
  opts: { k: number; pit?: string; pinnedDocIds?: string[] },
): Promise<Citation[]>;   // { chunk_id, doc_id, title, snippet, score }
```

It runs the same hybrid keyword+vector+RRF flow as `search.ts` (reuse `rrfFuse`), de-duplicates by `doc_id`, and boosts `pinnedDocIds` (the category's `seed_doc_ids`) so the authoritative page leads. **This is the function `bas_prep_checklist` and `audit_risk_check` reuse** — it is the single most important shared artefact in v0.4.

---

## 5. Output

```ts
export interface DeductionDiscoveryOutput {
  fy: string;
  taxpayer_profile: {            // echo of the facts that drove branching (audit trail; no PII beyond what's needed)
    business_structure: BusinessStructure;
    residency_status: UserFacts["residency_status"];
    has_abn: boolean;
    occupation?: string;
    industry_code?: string;
    flags: string[];             // e.g. ["has_investment_property","has_crypto","has_spouse","smsf"]
  };
  activity?: string;
  categories: Array<{
    id: string;
    label: string;
    kind: CategoryKind;
    return_context: "personal" | "business_entity";
    confidence: "high" | "medium" | "low";
    confidence_reason: string;
    applies_because: string;     // facts-driven explanation
    examples: string[];
    substantiation: string;
    consider_prompt: string;
    ato_focus_area: boolean;
    legal_basis: string;
    thresholds: ThresholdRow[];  // resolved (value/unit/effective dates/source)
    citations: Citation[];       // resolve via get_chunks / get_doc
    residency_caveat?: string;   // present only when relevant to this taxpayer
    fy_note?: string;
  }>;
  matched_activity?: { category_id: string; rationale: string } | null;
  counts: { deduction: number; offset: number; cgt_event: number; disallowance: number; precondition: number; strategy: number };
  notes: string[];               // e.g. "Your company lodges its own return — business_entity items belong there, not on your personal return."
  disclaimer: string;            // mandatory, fixed text (information infrastructure, not tax advice)
}
```

`kind` lets a consumer cleanly separate genuine deductions from offsets, CGT events, disallowance warnings, preconditions, and strategy notes — so nothing miscounts toward a "total deductions" figure and disallowance flags render as warnings, not claims.

---

## 6. Confidence model

Discrete `high | medium | low` (no false-precision 0–1 score; the agent does prose):

- **high** — structure + all triggers are a *definite* match to the taxpayer's facts **and** ≥1 live citation resolved. (e.g. `business_structure=none`, `occupation` set → `wre_self_education` = high)
- **medium** — applies by structure but the trigger is a profile default rather than an explicit fact, OR citations resolved only generally (no pinned authoritative hit).
- **low** — plausible-but-conditional: surfaced for recall with an explicit "depends on…" in `confidence_reason`. (e.g. `ent_rd_tax_incentive` for any company — surfaced low because no R&D fact exists; activity text can lift it.)

`disallowance` and `precondition` kinds carry their own framing: confidence reflects "this *limit*/*requirement* applies to you", not "you can claim".

---

## 7. Branching by taxpayer type (return_context model)

Per the locked decision: surface **both** the entity's deductions and the person's personal-return deductions, tagged by `return_context`, with a `notes` entry explaining separate lodgement.

Coverage verified across all structures (full detail in the analysis JSON):

- **`none` (employee individual):** the `wre_*` D1–D15 family (occupation-gated), the no-trigger personal items (`wre_gifts_donations`, `wre_managing_tax_affairs`), all `structures=[all]` super/insurance/offset rows. Investors reachable via `has_investment_property` / `has_shares_or_managed_funds` / `has_crypto` (those triggers include `none`).
- **`sole_trader`:** BOTH the personal `wre_*` set (a sole trader who is also employed) AND the `st_*` business set (`has_abn`-gated), plus investor + super rows. Business income reported on the individual return → `return_context=personal`.
- **`partnership`:** entity `ent_*` set at the partnership level + the partner's personal investor/super rows. (Partnership net income/loss flows to partners — see Gaps.)
- **`company`:** the `ent_*` set incl. company-only `ent_directors_fees`, `ent_prior_year_tax_losses`, `ent_rd_tax_incentive`, plus the director-shareholder's personal `structures=[all]` rows.
- **`trust`:** the `ent_*` set minus the two company-only rows; `ent_prior_year_tax_losses` applies (Sch 2F trust loss rules); plus beneficiaries' personal rows.
- **SMSF members:** `smsf_member_personal_super_deduction` (gated `super_fund_type=eq=smsf`) — the **member's** personal-return deduction, explicitly disambiguated from the SMSF fund's own deductions (out of scope).

---

## 8. Edge cases (from the research workflow)

The implementation MUST handle these (full list in the analysis JSON; the salient ones):

1. **Sole trader who is also an employee** — both `wre_car` (D1 employment use) and `st_business_motor_vehicle` (business use) can fire; output must label them distinctly so the same kilometres aren't double-claimed. The tool surfaces both; the warning lives in `consider_prompt`/`notes`.
2. **Company director who is also a personal investor** — entity rows on the company return + personal rows on the individual return = two `return_context` groups from one fact set. `notes` must make the split explicit.
3. **WFH double-count** — `wre_wfh_fixed_rate` bundles phone+internet+energy; `wre_phone_internet` and `wre_wfh_actual` overlap. All surface (recall-first) but `consider_prompt`s warn against double-claiming; fixed-rate vs actual are mutually exclusive for the same hours.
4. **Triple income-protection / triple personal-super rows** — deduped at output via `dedupe_key` (IP premium: one card; s 290-150 super deduction: one card) while preserving the structure-specific prompt.
5. **Disallowance flags render as warnings** — `rental_travel_disallowed_note` (s 26-31) and `rental_vacant_land_holding_costs` (s 26-102) are `kind: "disallowance"`, never presented as claimable.
6. **Offsets / CGT events / preconditions are not deductions** — `spouse_super_contribution_offset` (offset), `crypto_cgt_on_disposal` (cgt_event), `personal_super_notice_of_intent` (precondition), FHSS (strategy) are typed so they never sum into a deductions total.
7. **`prior_fy_lodged=false`** — `ent_prior_year_tax_losses` correctly suppressed (no brought-forward loss to use yet).
8. **Working-holiday-maker / non-resident** — categories currently surface identically; the tool attaches a `residency_caveat` (see §9).

---

## 9. Open questions — resolutions

The research surfaced 7 open questions. Resolutions for v0.4 (flagged items for reviewer attention marked ★):

| # | Question | Resolution |
|---|----------|-----------|
| 1 ★ | Residency gating — suppress or warn for non-resident / WHM / temporary-resident? | **Soft-warn, never suppress.** Categories with `residency_caveat: true` (CGT discount, tax-free threshold, main-residence-linked, home-office) attach a `residency_caveat` string when `residency_status ≠ resident`. Recall-first + no-advice frame favour surfacing with a caveat over hiding. |
| 2 | Merge vs surface the 3 identical s 290-150 super rows and 2 IP rows | **Keep separate in the taxonomy (recall/clarity), dedupe at output** via `dedupe_key`. One output card per economic claim, structure-specific `consider_prompt` chosen for the user. |
| 3 ★ | Should offsets / assessable-income items live in this tool? | **Yes, but typed via `kind`.** They are surfaced for recall, clearly labelled non-deductions, and excluded from any deduction count (`counts` breaks down by kind). |
| 4 | Entity-vs-individual rental ownership (no owner field on `has_investment_property`) | **Defer.** Surface personal `rental_*` on the boolean and attach a `notes` reconciliation hint ("if your company/trust owns the property these belong on the entity return"). No facts-schema change in v0.4. |
| 5 | Scope of entity coverage | **Personal-return-centric for v0.4.** The common `ent_*` set ships; full entity completeness deferred (Gaps §11). |
| 6 | Activity-text contract | activity is embedded and used to (a) rank surfaced categories and (b) set `matched_activity`; it **never suppresses** categories. For R&D/industry rows with no backing fact, activity presence boosts confidence/ranking; absence does not hide them. |
| 7 | FY-rolling thresholds | **Always resolve via `get_threshold` at runtime** honouring `fy`/`current_fy`. Literals in `examples`/`substantiation` are illustrative only. FY-sensitive law changes carried in `fy_note` (e.g. GIC/SIC repeal for charges incurred on/after 1 Jul 2025 in `wre_managing_tax_affairs`). |

---

## 10. No-advice and legal framing

- Output is data + resolvable citations. The mandatory `disclaimer` field repeats the onboarding disclaimer (information infrastructure, not tax advice; verify material decisions with a registered tax agent).
- `ato_focus_area` is a flag only — no risk numbers (those are `audit_risk_check`).
- No silent failures: missing facts → actionable throw; missing corpus/store → the standard "Corpus not installed" error; a threshold that doesn't resolve is returned as `null` with the category still surfaced (the citation carries the rule), never a fabricated value.

---

## 11. Gaps (deferred, documented)

From the research, intentionally **not** modelled in v0.4 (each is a real future category):

- **FBT-as-a-deduction** to the employer entity (s 8-1; TR 95/24 in corpus). `fbt_payer` fact has no category yet.
- **Business start-up / blackhole expenditure** (s 40-880, in corpus).
- **Prepaid-expense regime** (12-month rule / small-business immediate deduction).
- **GST credit ↔ income-tax-deduction netting** (deductible amount is GST-exclusive for registered taxpayers).
- **SMSF fund-level deductions** (s 295-465 insurance, admin/audit/actuarial) — the fund's own return.
- **Partnership/trust distribution mechanics** — partner-level claim of a partnership loss.
- **Personal-services-income (PSI) restrictions** — can deny certain sole-trader/entity deductions; no PSI fact/category. v0.4 attaches a general `notes` caveat for sole traders.

These are listed so the deferral is explicit, not silent.

---

## 12. Testing strategy

### Unit (vitest, mock `store` + `embedder` + `userFacts`)
The 11 research test scenarios become the spec for unit tests (see analysis JSON `test_scenarios`). Key assertions:
- `employee_nurse_wfh` → surfaces the occupation `wre_*` set; **no** `st_*`/`ent_*`/investor rows.
- `sole_trader_tradie_also_employed` → surfaces **both** `wre_*` and `st_*`; **no** `ent_*`.
- `company_director_with_rental_and_crypto` → entity rows tagged `business_entity` **and** personal rental/crypto/super tagged `personal`; `notes` explains the split.
- `trust_no_directors_no_rd` → `ent_*` minus `ent_directors_fees` and `ent_rd_tax_incentive`.
- `smsf_member_individual` → `smsf_member_personal_super_deduction` fires; **no** fund-level rows.
- `working_holiday_maker_employee` → categories surface **with** a `residency_caveat`.
- Confidence downgrades to `low`/`medium` when no pinned citation resolves.
- `dedupe_key` collapses the duplicate super/IP rows to one card.
- `kind` counts: offsets/cgt/disallowance/precondition excluded from the `deduction` count.
- **Schema-integrity test:** every `trigger.field` is a real `UserFacts` key; every `threshold` is in the allow-list; every `seed_doc_id` matches the corpus id format. (Corpus-existence is validated at build time, not in CI, since CI has no 1 GB DB.)

### Integration (backend handler, `MOCK_SUPABASE=1`)
- `packages/backend/api/deduction_discovery.ts` — follows the standard handler shape (`adapt` + `authMiddleware` + `getUserFacts` → tool). One happy-path test asserting a 200 with a well-formed payload for a seeded mock user.

### Registration / forwarding
- Register the tool in `packages/mcp/src/server.ts` (local mode wires `{store, embedder, userFacts}`).
- Backend route name `deduction_discovery` → the `RemoteToolForwarder` (`packages/mcp/src/lib/remote-tools.ts`) picks it up automatically by name. No forwarder change needed.

---

## 13. Appendix — taxonomy by slice (59 categories)

Full rows in `2026-06-03-deduction-discovery-taxonomy.json`. Summary:

**Individual / employee WRE (personal, occupation-gated)** — `wre_car`, `wre_travel`, `wre_clothing_laundry`, `wre_protective_ppe`, `wre_self_education`, `wre_wfh_fixed_rate`, `wre_wfh_actual`, `wre_phone_internet`, `wre_tools_equipment`, `wre_union_professional_fees`, `wre_income_protection_insurance`, `wre_seminars_subscriptions`, `wre_occupation_specific`; **(no trigger)** `wre_gifts_donations`, `wre_managing_tax_affairs`.

**Investment / passive (personal, investor-gated)** — rental: `rental_loan_interest`, `rental_capital_works_div43`, `rental_decline_in_value_div40`, `rental_repairs_vs_improvements`, `rental_management_and_admin_fees`, `rental_borrowing_and_misc_setup_costs`, `rental_travel_disallowed_note` (disallowance), `rental_vacant_land_holding_costs` (disallowance); shares: `shares_borrowing_interest`, `shares_management_advice_and_platform_fees`; crypto: `crypto_cgt_on_disposal` (cgt_event), `crypto_trading_stock_vs_investment`.

**Sole-trader business (personal, `has_abn`-gated)** — `st_business_motor_vehicle`, `st_home_based_business`, `st_operating_expenses`, `st_trading_stock_cogs`, `st_depreciating_assets_iawo`, `st_small_business_pool`, `st_professional_fees`, `st_business_insurance`, `st_phone_internet`, `st_repairs_maintenance`, `st_bad_debts`, `st_personal_super_contribution`.

**Company / trust / partnership entity (business_entity, `has_abn`-gated)** — `ent_general_operating_8_1`, `ent_salaries_wages_super`, `ent_directors_fees` (company-only), `ent_depreciating_assets`, `ent_instant_asset_write_off_sb_pool`, `ent_motor_vehicle_entity_owned`, `ent_premises_occupancy`, `ent_professional_compliance_fees`, `ent_business_insurance`, `ent_interest_business_borrowings`, `ent_trading_stock`, `ent_prior_year_tax_losses` (company/trust), `ent_rd_tax_incentive` (company-only).

**Super / SMSF / offsets (personal, mostly all-structures)** — `personal_super_concessional_deduction`, `personal_super_notice_of_intent` (precondition), `personal_super_carry_forward_concessional` (strategy), `smsf_member_personal_super_deduction` (smsf-gated), `income_protection_insurance_premiums`, `fhss_personal_contribution_notes` (strategy), `spouse_super_contribution_offset` (offset, `has_spouse`-gated).
