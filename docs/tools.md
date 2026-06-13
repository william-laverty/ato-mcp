# ato-mcp tool reference

ato-mcp exposes 13 MCP tools. Every tool returns structured JSON; search hits and citations carry resolvable identifiers — pass a `chunk_id` to [`get_chunks`](#get_chunks) for the passage and its neighbours, or a `doc_id` to [`get_doc`](#get_doc) for the full document.
The personal-context tool ([`get_user_facts`](#get_user_facts)) and the four workflow tools ([`deduction_discovery`](#deduction_discovery), [`depreciation_helper`](#depreciation_helper), [`bas_prep_checklist`](#bas_prep_checklist), [`audit_risk_check`](#audit_risk_check)) require completed onboarding; they throw until personal facts are set.
Tool failures are returned as MCP error content of the form `{"kind": "error", "message": "..."}`.

### Citations

The workflow tools attach **Citation** objects, resolved live from the corpus (hybrid keyword + vector search, de-duplicated to the best chunk per document):

```json
{ "chunk_id": "…", "doc_id": "…", "title": "…", "snippet": "…", "score": 0.03 }
```

| field | meaning |
|---|---|
| `chunk_id` | Corpus chunk identifier (`<doc_id>#<ord>`) — resolve with `get_chunks`. |
| `doc_id` | Parent document identifier — resolve with `get_doc`. |
| `title` | Parent document title. |
| `snippet` | Short extract from the cited chunk. |
| `score` | Retrieval relevance score (rank-fusion value; comparable within one response only). |

If live citation resolution is partially degraded under load, a workflow tool still returns its full result with fewer (or no) citations and says so in `notes` — it never silently drops citations and never fails the whole call for that reason.

**Point-in-time (`pit`):** several retrieval tools accept `pit`, an ISO date (`YYYY-MM-DD`). Results are restricted to content effective at that date. Workflow tools derive `pit` internally from `fy` (30 June of the ending year).

### Contents

**Retrieval tools**
[`search`](#search) · [`get_chunks`](#get_chunks) · [`get_doc`](#get_doc) · [`get_doc_anchors`](#get_doc_anchors) · [`get_definition`](#get_definition) · [`get_threshold`](#get_threshold) · [`fetch`](#fetch) · [`stats`](#stats)

**Personal context**
[`get_user_facts`](#get_user_facts)

**Workflow tools**
[`deduction_discovery`](#deduction_discovery) · [`depreciation_helper`](#depreciation_helper) · [`bas_prep_checklist`](#bas_prep_checklist) · [`audit_risk_check`](#audit_risk_check)

[Disclaimers](#disclaimers)

---

# Retrieval tools

## search

Hybrid BM25 + vector search over the ATO corpus (ato.gov.au guidance, ITAA 1997 legislation, ATO public rulings). `hybrid` mode runs the keyword and vector legs in parallel, over-fetches each, and fuses them with reciprocal-rank fusion; `keyword` and `vector` run a single leg. Returns the top-k chunks, each carrying `chunk_id`/`doc_id` for follow-up retrieval.

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `query` | string | yes | — | Non-empty natural-language or keyword query. |
| `k` | integer | no | `10` | 1–50. Number of hits returned. |
| `mode` | string | no | `"hybrid"` | One of `"hybrid"`, `"vector"`, `"keyword"`. |
| `source` | string[] | no | — | Accepted by the input schema; not yet applied as a filter. |
| `doc_type` | string[] | no | — | Accepted by the input schema; not yet applied as a filter. |
| `jurisdiction` | string | no | — | Accepted by the input schema; not yet applied as a filter. |
| `pit` | string | no | — | Point-in-time date `YYYY-MM-DD`; restricts to content effective at that date. |
| `include_old` | boolean | no | `false` | Accepted by the input schema; not yet applied as a filter. |

### Output

- `query`, `mode` — echo of the request.
- `hits` — array of hit objects:
  - `chunk_id` — chunk identifier (`<doc_id>#<ord>`).
  - `doc_id` — parent document identifier.
  - `ord` — chunk position within the document.
  - `text` — full chunk text.
  - `heading_path` — heading breadcrumb (array of strings).
  - `score` — relevance score (RRF-fused in hybrid mode).
  - `title`, `url`, `doc_type` — parent document metadata.
  - `snippet` — short extract.

### Example

```json
{ "query": "working from home fixed rate method", "k": 3 }
```

Response (abridged):

```json
{
  "query": "working from home fixed rate method",
  "mode": "hybrid",
  "hits": [
    {
      "chunk_id": "ato:individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/working-from-home-expenses#4",
      "doc_id": "ato:individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/working-from-home-expenses",
      "title": "Working from home expenses",
      "snippet": "…fixed rate method … cents per hour you work from home…",
      "score": 0.032,
      "doc_type": "ATO_GUIDE",
      "url": "https://www.ato.gov.au/…",
      "heading_path": ["…"],
      "ord": 4,
      "text": "…"
    }
  ]
}
```

**Errors:** throws `Corpus unavailable. This is a server-side issue — please try again shortly.` when the corpus store is not available.

## get_chunks

Fetch chunk bodies by `chunk_id`, optionally widened with neighbouring chunks (`±N` by position) from the same document. Use it to expand a `search` hit or workflow citation into enough surrounding context to quote accurately.

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `chunk_ids` | string[] | yes | — | 1–50 ids, each non-empty. |
| `neighbours` | integer | no | `0` | 0–5. Also return up to N adjacent chunks either side of each id. |
| `pit` | string | no | — | Point-in-time date `YYYY-MM-DD`. |

### Output

- `chunks` — array of chunk records in the same shape as `search` hits (`chunk_id`, `doc_id`, `ord`, `text`, `heading_path`, `score`, `title`, `url`, `doc_type`, `snippet`).

### Example

```json
{ "chunk_ids": ["legis:c2004a05138/40-25#0"], "neighbours": 1 }
```

Response (abridged):

```json
{
  "chunks": [
    { "chunk_id": "legis:c2004a05138/40-25#0", "doc_id": "legis:c2004a05138/40-25", "title": "ITAA 1997 s 40-25", "text": "…deduct an amount equal to the decline in value…", "ord": 0, "…": "…" },
    { "chunk_id": "legis:c2004a05138/40-25#1", "…": "…" }
  ]
}
```

**Errors:** throws `Corpus unavailable. This is a server-side issue — please try again shortly.` when the corpus store is not available.

## get_doc

Fetch a full document by `doc_id`: its metadata record, the cleaned HTML body, and the list of in-document anchors (each anchor maps to a `chunk_id`). Use after `search`/citations when chunk-level context is not enough.

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `doc_id` | string | yes | — | e.g. `legis:c2004a05138/40-75` or `ato:individuals-and-families/…`. |
| `pit` | string | no | — | Accepted by the input schema; not used by the current implementation. |

### Output

- `doc` — document metadata: `doc_id`, `source` (`ato` \| `legislation` \| `austlii` \| `state_revenue`), `url`, `title`, `jurisdiction`, `doc_type`, `effective_from`, `effective_to`, `published_at`, `retrieved_at`, `metadata`.
- `cleaned_html` — sanitised HTML body, or `null`.
- `anchors` — array of `{ anchor_id, anchor_name, chunk_id }` for in-document targets.

### Example

```json
{ "doc_id": "legis:c2004a05138/328-180" }
```

Response (abridged):

```json
{
  "doc": { "doc_id": "legis:c2004a05138/328-180", "source": "legislation", "title": "ITAA 1997 s 328-180", "doc_type": "LEGISLATION_ITAA1997", "url": "…", "retrieved_at": "…", "…": "…" },
  "cleaned_html": "<h1>328-180 …</h1>…",
  "anchors": [ { "anchor_id": "…", "anchor_name": "…", "chunk_id": "legis:c2004a05138/328-180#0" } ]
}
```

**Errors:** throws `Corpus unavailable. This is a server-side issue — please try again shortly.` when the corpus store is not available; throws `Document not found: <doc_id>` for an unknown id.

## get_doc_anchors

List a document's in-document anchors plus its citation graph: inbound edges (chunks elsewhere in the corpus that cite this document) and outbound edges (documents this document's chunks cite). Useful for walking from a ruling to the sections it interprets, or from a section to everything that cites it.

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `doc_id` | string | yes | — | Document identifier. |

### Output

- `anchors` — array of `{ anchor_id, doc_id, anchor_name, chunk_id }`.
- `inbound` — citation edges pointing at this document: `{ from_chunk_id, to_doc_id, to_anchor, citation_kind }`.
- `outbound` — citation edges from this document's chunks, same shape.

### Example

```json
{ "doc_id": "legis:c2004a05138/8-1" }
```

Response (abridged):

```json
{
  "anchors": [ { "anchor_id": "…", "doc_id": "legis:c2004a05138/8-1", "anchor_name": "…", "chunk_id": "legis:c2004a05138/8-1#0" } ],
  "inbound": [ { "from_chunk_id": "ato-law:TR/2024/3#12", "to_doc_id": "legis:c2004a05138/8-1", "to_anchor": null, "citation_kind": "…" } ],
  "outbound": [ "…" ]
}
```

**Errors:** throws `Corpus unavailable. This is a server-side issue — please try again shortly.` when the corpus store is not available.

## get_definition

Look up the statutory definition of a term (e.g. from the ITAA 1997 dictionary), point-in-time aware. When there is no statutory match, falls back to a clearly labelled ordinary-meaning result instead of failing. The caller MUST respect `kind`: `"statutory"` is a defined legal term; `"ordinary"` is not, and must not be presented as one.

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `term` | string | yes | — | Term to define, e.g. `"depreciating asset"`. |
| `pit` | string | no | today | Point-in-time date `YYYY-MM-DD`; defaults to today's date. |
| `jurisdiction` | string | no | `"AU"` | Corpus is Commonwealth (AU) only today. |

### Output

- `term` — echo of the request.
- `kind` — `"statutory"` or `"ordinary"`.
- `source` — statutory only: `{ doc_id, anchor, citation }` for the defining provision.
- `body` — the definition text. For ordinary-meaning results, carries an explicit WordNet attribution (when a WordNet provider is wired), or the sentence `No statutory definition found for "<term>".`
- `effective_from`, `effective_to` — statutory only: validity window (nullable).
- `alternatives` — statutory only: additional statutory matches as `{ doc_id, citation, body }`.

### Example

```json
{ "term": "small business entity", "pit": "2026-06-30" }
```

Response (abridged):

```json
{
  "term": "small business entity",
  "kind": "statutory",
  "source": { "doc_id": "legis:c2004a05138/995-1", "anchor": "…", "citation": "legis:c2004a05138/995-1" },
  "body": "small business entity has the meaning given by section 328-110…",
  "effective_from": "…",
  "effective_to": null,
  "alternatives": []
}
```

**Errors:** throws `Corpus unavailable. This is a server-side issue — please try again shortly.` when the corpus store is not available. A missing definition does not throw — it returns `kind: "ordinary"`.

## get_threshold

Time-keyed scalar tax fact lookup, point-in-time aware. The corpus currently carries 8 thresholds: `gst_registration_threshold`, `gst_registration_threshold_nonprofit`, `instant_asset_write_off`, `cgt_discount_individual`, `super_concessional_cap`, `tax_free_threshold`, `low_income_tax_offset_max`, `small_business_income_tax_offset_cap`.

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `name` | string | yes | — | Threshold key (see list above). |
| `pit` | string | no | today | Date the threshold must be effective at (`YYYY-MM-DD`). |

### Output

A single threshold row:

- `name` — threshold key.
- `value` — numeric value.
- `unit` — `"AUD"` for dollar amounts, `"percent"` for rates.
- `effective_from`, `effective_to` — validity window (nullable).
- `source_doc_id`, `source_anchor` — provenance pointers into the corpus (nullable).

### Example

```json
{ "name": "instant_asset_write_off", "pit": "2026-06-30" }
```

Response (abridged):

```json
{
  "name": "instant_asset_write_off",
  "value": 20000,
  "unit": "AUD",
  "effective_from": "2023-07-01",
  "effective_to": null,
  "source_doc_id": "ato:businesses-and-organisations/…/instant-asset-write-off",
  "source_anchor": null
}
```

**Errors:** throws `Corpus unavailable. This is a server-side issue — please try again shortly.` when the corpus store is not available; throws `Threshold not found: <name> at <pit>` when no row is effective at the date.

## fetch

Live-fetch a document over HTTPS by scheme-prefixed URI — for content newer than, or outside, the installed corpus. Does not require a corpus. Scheme mapping:

| scheme | resolves to |
|---|---|
| `ato:<path>` | `https://www.ato.gov.au/<path>` |
| `ato-law:<docid>` | `https://www.ato.gov.au/law/view.htm?docid=<docid>` |
| `legis:<act>/<section>` | `https://www.legislation.gov.au/Latest/<act>/<section>` |
| `staterev-<juris>:<path>` | the state revenue office site for `nsw`, `vic`, `qld`, `sa`, `wa`, `tas`, `act`, `nt` |

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `uri` | string | yes | — | Non-empty, scheme-prefixed URI (see table above). |

### Output

- `uri` — echo of the request.
- `url` — the resolved HTTPS URL fetched.
- `status` — HTTP status code.
- `content_type` — response `content-type` header, or `null`.
- `body` — response body text; empty string when `status` is not 200.

### Example

```json
{ "uri": "ato-law:PCG/2023/1" }
```

Response (abridged):

```json
{
  "uri": "ato-law:PCG/2023/1",
  "url": "https://www.ato.gov.au/law/view.htm?docid=PCG/2023/1",
  "status": 200,
  "content_type": "text/html; charset=utf-8",
  "body": "<!DOCTYPE html>…"
}
```

**Errors:** throws `Unsupported URI scheme: <uri>` for unknown schemes (including an unrecognised `staterev-` jurisdiction). A non-200 HTTP response is not an error — it is reported via `status` with an empty `body`.

## stats

Report corpus installation status, schema version, and document/chunk counts. The cheapest health check: call it first to confirm a corpus is installed and how stale it is. Never throws — an uninstalled corpus is reported, not raised.

### Input

No parameters (`{}`).

### Output

- `installed` — whether a corpus database is present.
- `schema_version` — corpus schema version (e.g. `"0.3.0"`), or `null`.
- `docs` — number of documents.
- `chunks` — number of chunks.
- `data_dir` — the ato-mcp data directory.
- `corpus_path` — full path of the corpus SQLite file.
- `staleness_days` — days since the corpus was built, or `null`.

### Example

```json
{}
```

Response (abridged):

```json
{
  "installed": true,
  "schema_version": "0.3.0",
  "docs": 29180,
  "chunks": 224585,
  "data_dir": "/Users/you/Library/Application Support/ato-mcp",
  "corpus_path": "…/ato-mcp/live/ato.sqlite",
  "staleness_days": 12
}
```

**Errors:** none. When no corpus is installed, returns `installed: false` with zero counts.

---

# Personal context

## get_user_facts

Return the authenticated user's personal tax facts captured during onboarding — state, residency, ABN/business structure, GST registration, household and investment flags, and the current financial year. Call once when a session starts and reason from the result throughout; the workflow tools read the same facts server-side.

### Input

No parameters (`{}`).

### Output

- `facts` — the validated UserFacts object:

| field | type | notes |
|---|---|---|
| `given_name` | string | |
| `state` | enum | `NSW` `VIC` `QLD` `WA` `SA` `TAS` `ACT` `NT` |
| `residency_status` | enum | `resident` `non_resident` `temporary_resident` `working_holiday_maker` |
| `has_abn` | boolean | |
| `abn` | string? | Present when `has_abn`; passes the ABR modulus-89 checksum. |
| `business_structure` | enum | `sole_trader` `partnership` `company` `trust` `none` |
| `business_name` | string? | |
| `industry_code` | string? | Validated ANZSIC code. |
| `occupation` | string? | |
| `gst_registered` | boolean | |
| `gst_period` | enum | `monthly` `quarterly` `annual` `n/a` — `n/a` iff not registered. |
| `payg_instalments` | boolean | |
| `fbt_payer` | boolean | |
| `has_spouse` | boolean | |
| `dependants` | integer | 0–20 |
| `hecs_help_debt` | boolean | |
| `private_health_insurance` | boolean | |
| `has_investment_property` | boolean | |
| `has_shares_or_managed_funds` | boolean | |
| `has_crypto` | boolean | |
| `super_fund_type` | enum | `industry` `retail` `smsf` `unsure` `none` |
| `current_fy` | string | `YYYY-YY`, e.g. `"2025-26"`. |
| `prior_fy_lodged` | boolean | |
| `accepted_disclaimer_at` | string | Timestamp. |
| `facts_updated_at` | string | Timestamp. |
| `schema_version` | literal `1` | |

- `mode` — `"local"` or `"hosted"`.
- `fetched_from` — `"config_file"` (local config.json) or `"hosted_api"`.

### Example

```json
{}
```

Response (abridged):

```json
{
  "facts": {
    "given_name": "Daisy",
    "state": "NSW",
    "residency_status": "resident",
    "business_structure": "sole_trader",
    "has_abn": true,
    "abn": "51824753556",
    "gst_registered": true,
    "gst_period": "quarterly",
    "has_crypto": true,
    "current_fy": "2025-26",
    "…": "…"
  },
  "mode": "local",
  "fetched_from": "config_file"
}
```

**Errors:** throws `Personal facts not set. Complete onboarding at ato-mcp.com.au/onboard.` when onboarding has not been completed.

---

# Workflow tools

All four workflow tools require personal facts (onboarding) and an installed corpus. Each result includes [`citations`](#citations) per item, a `notes` array (including a degradation note if citation resolution was impaired), and a `disclaimer` string.

## deduction_discovery

Surface every deduction-related category that plausibly applies to the user's tax profile, drawn from a curated taxonomy filtered by their facts. Branches across all taxpayer structures (individual, sole trader, partnership, company, trust, SMSF member), tags each category as belonging on the personal or business-entity return, types it by kind (deduction, offset, CGT event, disallowance, precondition, strategy), and attaches live thresholds, fresh corpus citations, and a discrete confidence rating. Optionally pass `activity` (a free-text spend description) to have the best-matching category identified.

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `activity` | string | no | — | Free-text activity/spend to match against surfaced categories. |
| `fy` | string | no | user's `current_fy` fact | Format `YYYY-YY` (e.g. `"2025-26"`); validation error otherwise. |
| `k_citations` | integer | no | `3` | 1–5 citations resolved per category. |
| `include_low_confidence` | boolean | no | `true` | Set `false` to drop low-confidence categories. |

### Output

- `fy` — financial year analysed.
- `taxpayer_profile` — `{ business_structure, residency_status, has_abn, occupation?, industry_code?, flags[] }`; `flags` lists the fact flags that drove filtering (e.g. `gst_registered`, `has_crypto`, `smsf`).
- `activity` — echo (only when provided).
- `categories` — array of surfaced categories, ATO focus areas first, then by kind and confidence:
  - `id`, `label` — category identity.
  - `kind` — `deduction` \| `offset` \| `cgt_event` \| `disallowance` \| `precondition` \| `strategy`.
  - `return_context` — `personal` or `business_entity` (which return it belongs on).
  - `confidence`, `confidence_reason` — `high` \| `medium` \| `low` with a one-line justification.
  - `applies_because` — why your facts triggered it.
  - `examples` — example expenses (array).
  - `substantiation` — the records required.
  - `consider_prompt` — a question to ask the user.
  - `ato_focus_area` — boolean; current ATO scrutiny area.
  - `legal_basis` — provision/ruling reference string.
  - `thresholds` — live threshold rows (same shape as `get_threshold`).
  - `citations` — [Citation](#citations) array.
  - `residency_caveat`, `fy_note` — optional caveats.
- `matched_activity` — `{ category_id, rationale }` for the best `activity` match, or `null`.
- `counts` — per-kind totals (`deduction`, `offset`, `cgt_event`, `disallowance`, `precondition`, `strategy`).
- `notes` — structural caveats (entity-return split, PSI, residency) plus any citation-degradation note.
- `disclaimer` — fixed not-tax-advice statement.

### Example

```json
{ "activity": "new laptop for client work", "k_citations": 2 }
```

Response (abridged):

```json
{
  "fy": "2025-26",
  "taxpayer_profile": { "business_structure": "sole_trader", "residency_status": "resident", "has_abn": true, "flags": ["gst_registered", "has_crypto"] },
  "activity": "new laptop for client work",
  "categories": [
    {
      "id": "wre_tools_equipment",
      "label": "Tools, equipment and depreciating assets used for work (D5)",
      "kind": "deduction",
      "return_context": "personal",
      "confidence": "high",
      "confidence_reason": "Matches your stated facts and is backed by 2 ATO source(s).",
      "applies_because": "Applies to your structure (sole_trader). …",
      "thresholds": [ { "name": "instant_asset_write_off", "value": 20000, "unit": "AUD", "…": "…" } ],
      "citations": [ { "chunk_id": "…", "doc_id": "…", "title": "…", "snippet": "…", "score": 0.03 } ],
      "…": "…"
    }
  ],
  "matched_activity": { "category_id": "wre_tools_equipment", "rationale": "Activity text best matches …" },
  "counts": { "deduction": 14, "offset": 2, "cgt_event": 2, "disallowance": 1, "precondition": 1, "strategy": 2 },
  "notes": ["Personal services income (PSI) rules can restrict some business deductions…"],
  "disclaimer": "This tool retrieves and structures ATO material; it is not tax advice. …"
}
```

**Errors:** throws `Personal facts not set. Complete onboarding at ato-mcp.com.au/onboard.` when onboarding is incomplete; throws `Corpus unavailable. This is a server-side issue — please try again shortly.` when the corpus store is not available.

## depreciation_helper

Compute depreciation for a single asset across all applicable methods — prime cost, diminishing value, instant asset write-off, the $300 immediate deduction, the small business pool, and Division 43 capital works — branched by the user's taxpayer structure and small-business-entity status. Calculations are deterministic (day-count apportioned, rounded to cents); the live instant-asset-write-off threshold and ATO/legislation citations are attached per method. Methods that do not apply are listed with the reason rather than omitted.

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `asset_cost` | number | yes | — | Must be > 0. Use the GST-exclusive cost if GST-registered. |
| `acquisition_date` | string | yes | — | `YYYY-MM-DD`; validation error otherwise. |
| `business_use_pct` | number | no | `100` | 0–100. Taxable-purpose proportion. |
| `asset_type` | string | no | — | Free text; `"car"`/`"vehicle"` adds a car-limit note. |
| `effective_life_years` | number | no | — | Must be > 0. Required for prime-cost / diminishing-value schedules; without it those methods are reported under `unavailable`. |
| `is_small_business_entity` | boolean | no | — | Unset: SBE assumed with a confirm-eligibility note. `false`: disables IAWO and the SBE pool. |
| `is_capital_works` | boolean | no | `false` | `true` computes the Division 43 (2.5%/40-year) schedule. |
| `method` | string | no | `"both"` | `"prime_cost"`, `"diminishing_value"`, or `"both"` (Div 40 method selection only). |
| `fy` | string | no | user's `current_fy` fact | `YYYY-YY`. |
| `years` | integer | no | ceil(effective life), else 10 | 1–40. Schedule horizon. |

### Output

- `inputs_echo` — `{ asset_cost, acquisition_date, business_use_pct, effective_life_years, fy, asset_type }`.
- `taxpayer_context` — `{ business_structure, is_business, is_small_business_entity }` (`null` when not provided).
- `methods` — one entry per applicable method:
  - `method` — `prime_cost` \| `diminishing_value` \| `instant_asset_write_off` \| `low_cost_immediate_300` \| `sbe_pool` \| `capital_works_div43`.
  - `label`, `eligible`, `eligibility_reason` — human-readable eligibility.
  - `first_year_deduction` — first-year claim (business-use-adjusted), or `null`.
  - `total_base` — cost × business-use %.
  - `schedule` — year-by-year rows `{ fy, opening_adjustable_value, decline_in_value, business_use_pct, deduction, closing_adjustable_value }`; empty for immediate write-offs.
  - `threshold` — live threshold row (IAWO methods), or `null`.
  - `legal_basis` — provision reference.
  - `citations` — [Citation](#citations) array.
  - `notes` — per-method caveats (e.g. the Div 40/Div 43 same-expenditure exclusion).
- `unavailable` — `{ method, reason }` for every method that did not apply.
- `recommended` — `{ method, rationale }` or `null`; immediate write-offs are preferred, and the prime-cost vs diminishing-value choice is flagged as a taxpayer election, not a recommendation.
- `disclaimer`, `notes` — fixed disclaimer; general notes (GST-exclusive cost, car limit, second-hand rental asset restriction, citation degradation).

### Example

```json
{ "asset_cost": 2800, "acquisition_date": "2025-09-15", "business_use_pct": 80, "effective_life_years": 4, "asset_type": "laptop" }
```

Response (abridged):

```json
{
  "inputs_echo": { "asset_cost": 2800, "acquisition_date": "2025-09-15", "business_use_pct": 80, "effective_life_years": 4, "fy": "2025-26", "asset_type": "laptop" },
  "taxpayer_context": { "business_structure": "sole_trader", "is_business": true, "is_small_business_entity": null },
  "methods": [
    {
      "method": "prime_cost",
      "eligible": true,
      "first_year_deduction": 443.4,
      "total_base": 2240,
      "schedule": [ { "fy": "2025-26", "opening_adjustable_value": 2800, "decline_in_value": 554.25, "business_use_pct": 80, "deduction": 443.4, "closing_adjustable_value": 2245.75 }, "…" ],
      "threshold": null,
      "legal_basis": "ITAA 1997 s 40-75; s 40-25",
      "citations": [ "…" ],
      "notes": []
    },
    {
      "method": "instant_asset_write_off",
      "eligible": true,
      "first_year_deduction": 2240,
      "total_base": 2240,
      "schedule": [],
      "threshold": { "name": "instant_asset_write_off", "value": 20000, "unit": "AUD", "…": "…" },
      "citations": [ "…" ],
      "notes": ["Assumes you are a small business entity…"]
    }
  ],
  "unavailable": [ { "method": "low_cost_immediate_300", "reason": "The $300 immediate deduction is for non-business depreciating assets…" }, "…" ],
  "recommended": { "method": "instant_asset_write_off", "rationale": "Eligible for an immediate full write-off this year…" },
  "disclaimer": "…", "notes": ["Use the GST-exclusive cost…"]
}
```

**Errors:** throws `Personal facts not set. Complete onboarding at ato-mcp.com.au/onboard.` when onboarding is incomplete; throws `Corpus unavailable. This is a server-side issue — please try again shortly.` when the corpus store is not available. (A pre-9-May-2006 acquisition makes diminishing value `unavailable` — it does not throw.)

## bas_prep_checklist

Produce a tiered, cited BAS preparation checklist for the user's GST reporting period: which labels apply (GST G1/1A/1B, full-method G labels, PAYG withholding, PAYG instalments, FBT instalments, fuel tax credits, WET, LCT), what evidence to gather per label, and common gotchas. Sections are tiered `core` (every registered taxpayer), `confirmed` (driven by your facts, e.g. `payg_instalments`), and `conditional` (apply only if the activity exists — verify). Defaults to Simpler BAS; it does not calculate amounts. Users not registered for GST get a cited IAS or no-BAS note instead.

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `period_type` | string | no | from the user's `gst_period` fact | `"monthly"`, `"quarterly"`, `"annual"`. |
| `quarter` | integer | no | — | 1–4. Sets `due_date` for quarterly BAS (statutory dates). |
| `fy` | string | no | user's `current_fy` fact | `YYYY-YY`. |
| `full_gst_method` | boolean | no | `false` | `true` adds the full-method labels (G2, G3, G10, G11). |

### Output

- `registered` — whether the user is GST-registered.
- `reporting` — `{ period_type, period_label, form, due_date, simpler_bas }`; `period_type` may be `"none"` for unregistered users, `form` is e.g. `"Quarterly BAS"` or `"Instalment activity statement (IAS)"`, `due_date` is set for quarterly periods with `quarter` given (else `null`).
- `taxpayer_context` — `{ business_structure, gst_period, payg_instalments, fbt_payer }`.
- `sections` — checklist sections, core first:
  - `id`, `label` — section identity (e.g. `gst_on_sales`, "GST on sales (1A)").
  - `tier` — `core` \| `confirmed` \| `conditional`.
  - `applies_reason` — why it is on your checklist.
  - `bas_labels` — the BAS label codes covered (e.g. `["1A"]`).
  - `what_to_gather` — evidence/figures to assemble.
  - `gotchas` — common mistakes for that label.
  - `legal_basis` — Act reference, or `null`.
  - `citations` — [Citation](#citations) array.
- `not_applicable_note` — `null` when registered; otherwise the IAS / no-BAS explanation.
- `disclaimer`, `notes` — fixed disclaimer; period guidance (Simpler BAS hint, nil-lodgment reminder, due-date notes, citation degradation).

### Example

```json
{ "quarter": 2, "full_gst_method": false }
```

Response (abridged):

```json
{
  "registered": true,
  "reporting": { "period_type": "quarterly", "period_label": "FY2025-26 Q2", "form": "Quarterly BAS", "due_date": "2026-02-28", "simpler_bas": true },
  "taxpayer_context": { "business_structure": "sole_trader", "gst_period": "quarterly", "payg_instalments": true, "fbt_payer": false },
  "sections": [
    {
      "id": "gst_total_sales", "label": "Total sales (G1)", "tier": "core",
      "applies_reason": "You are registered for GST.",
      "bas_labels": ["G1"],
      "what_to_gather": ["Total of all sales for the period…"],
      "gotchas": ["G1 includes ALL sales, not just taxable ones.", "…"],
      "legal_basis": "A New Tax System (GST) Act 1999",
      "citations": [ "…" ]
    },
    "…"
  ],
  "not_applicable_note": null,
  "disclaimer": "…",
  "notes": ["Most small businesses use Simpler BAS…", "Lodge a 'nil' activity statement even if…"]
}
```

**Errors:** throws `Personal facts not set. Complete onboarding at ato-mcp.com.au/onboard.` when onboarding is incomplete; throws `Corpus unavailable. This is a server-side issue — please try again shortly.` when the corpus store is not available.

## audit_risk_check

Flag patterns the ATO is known to scrutinise, given the user's facts plus an optional draft return summary (income, itemised deductions, rental figures). Runs ~13 pure rules — high work-related expenses relative to income, deductions exceeding income, round-number claims, claims hugging the $300 written-evidence concession, car claims near the cents-per-km cap, WFH + phone/internet double-claims, high clothing/laundry, self-education nexus, rental deductions with no rental income, rental interest above rental income, large repairs, crypto held but no CGT reported, and prior-year non-lodgment. Each finding carries a risk band, why it was flagged, what to do, and ATO guidance citations. It is a qualitative heuristic indicator — not an audit prediction and not numeric benchmarking.

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `income` | number | no | — | ≥ 0. Total income in the draft return; without it the income-ratio checks are skipped. |
| `deductions` | object[] | no | — | Items `{ category: string, amount: number ≥ 0 }`; category text is keyword-matched (e.g. "car", "working from home", "phone"). |
| `rental` | object | no | — | `{ income?, interest?, repairs?, capital_works? }`, all ≥ 0. |
| `business_income` | number | no | — | May be negative. |
| `fy` | string | no | user's `current_fy` fact | `YYYY-YY`. |

### Output

- `fy` — financial year analysed.
- `taxpayer_context` — `{ business_structure, occupation, has_investment_property, has_crypto }` (`occupation` nullable).
- `summary` — `{ income, total_deductions, deduction_to_income_pct }`; `null` where not derivable from the input.
- `findings` — fired rules, sorted high → low:
  - `id`, `title` — rule identity (e.g. `wre_high_vs_income`).
  - `risk_band` — `low` \| `medium` \| `high`.
  - `pattern` — what the ATO looks for.
  - `why_flagged` — the specific figures/facts that triggered it.
  - `what_to_do` — substantiation/correction guidance.
  - `legal_basis` — provision/ruling reference, or `null`.
  - `citations` — [Citation](#citations) array.
- `overall_risk` — the highest band among findings, or `"low"` when none fired.
- `checked` — ids of every rule evaluated.
- `skipped` — `{ id, reason }` for checks not assessable from the input provided (e.g. no `income` given).
- `disclaimer`, `notes` — fixed disclaimer; heuristic/no-benchmarking caveats plus any citation-degradation note.

### Example

```json
{
  "income": 90000,
  "deductions": [
    { "category": "working from home", "amount": 1500 },
    { "category": "phone and internet", "amount": 800 },
    { "category": "car expenses", "amount": 4900 }
  ]
}
```

Response (abridged):

```json
{
  "fy": "2025-26",
  "taxpayer_context": { "business_structure": "sole_trader", "occupation": "software developer", "has_investment_property": false, "has_crypto": true },
  "summary": { "income": 90000, "total_deductions": 7200, "deduction_to_income_pct": 8 },
  "findings": [
    {
      "id": "wfh_phone_double",
      "title": "Working-from-home and phone/internet double-claim",
      "risk_band": "medium",
      "why_flagged": "You have claimed both working-from-home running costs and a separate phone/internet amount — the WFH fixed rate already bundles phone and internet.",
      "what_to_do": "If you used the WFH fixed rate, do not also claim phone and internet for the same usage.",
      "legal_basis": "PCG 2023/1",
      "citations": [ "…" ]
    },
    { "id": "crypto_unreported", "risk_band": "medium", "…": "…" },
    { "id": "large_round_numbers", "risk_band": "medium", "…": "…" },
    { "id": "car_near_cap", "risk_band": "low", "…": "…" }
  ],
  "overall_risk": "medium",
  "checked": ["wre_high_vs_income", "deductions_exceed_income", "…"],
  "skipped": [],
  "disclaimer": "…",
  "notes": ["Risk bands are heuristic indicators based on conservative thresholds…", "…"]
}
```

**Errors:** throws `Personal facts not set. Complete onboarding at ato-mcp.com.au/onboard.` when onboarding is incomplete; throws `Corpus unavailable. This is a server-side issue — please try again shortly.` when the corpus store is not available.

---

# Disclaimers

- Every workflow tool returns **structured data plus ATO citations, not tax advice**, and says so in its `disclaimer` field. Verify material decisions with a registered tax agent.
- `audit_risk_check` risk bands and `deduction_discovery` confidence ratings are **heuristic indicators** built on conservative rules of thumb — not audit predictions, ATO determinations, or numeric benchmarking.
- Citations resolve against the installed corpus snapshot; for time-sensitive matters check `stats.staleness_days` and confirm currency with `fetch` against the live source.
