# Australian Tax MCP tool reference

Australian Tax MCP exposes 12 MCP tools. Every tool returns structured JSON; search hits and citations carry resolvable identifiers — pass a `chunk_id` to [`get_chunks`](#get_chunks) for the passage and its neighbours, or a `doc_id` to [`get_doc`](#get_doc) for the full document.
The personal-context tool ([`get_user_facts`](#get_user_facts)) and the four workflow tools ([`deduction_discovery`](#deduction_discovery), [`depreciation_helper`](#depreciation_helper), [`bas_prep_checklist`](#bas_prep_checklist), [`audit_risk_check`](#audit_risk_check)) read the user's saved tax profile. When none is saved they don't fail: they return `profile_saved: false` with a `setup_url` and a `message` (see [Profile not saved](#profile-not-saved)).
Tool failures are returned as MCP error content of the form `{"kind": "error", "message": "..."}`.

### Titles, annotations and output schemas

Every tool has a human-readable `title` (shown under each heading below) and MCP annotations. All 12 tools are read-only (`readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`); `fetch` is the only one with `openWorldHint: true`, since it reads live pages outside the stored corpus.

Every tool also declares an `outputSchema`. A successful result carries the result object as `structuredContent`, and the same JSON in its text content block for clients that don't read structured output. Output schemas list only the fields every result carries and allow extra ones (such as `disclaimer` and `notice`).

### When it runs

The connector is for Australian tax questions only. Each tax tool's description tells your AI agent so, and the server asks it to read your saved profile on the first tax question in a conversation, not at the start of every conversation. All tools are read-only.

### Profile not saved

When the user hasn't saved a tax profile, the four workflow tools return a normal (non-error) result instead of their usual output:

```json
{
  "profile_saved": false,
  "setup_url": "https://ato-mcp.com.au/account/facts/edit",
  "message": "deduction_discovery needs the user's saved tax profile, and none is saved yet. The user can save one at https://ato-mcp.com.au/account/facts/edit (about 2 minutes); search and the other retrieval tools work without it."
}
```

`get_user_facts` returns `profile_saved: false` with `facts: null` in the same situation. The retrieval tools never need a profile.

### Citations

The workflow tools attach **Citation** objects, resolved live from the corpus, one per document:

```json
{ "chunk_id": "…", "doc_id": "…", "title": "…", "snippet": "…", "score": 0.03 }
```

| field | meaning |
|---|---|
| `chunk_id` | Corpus chunk identifier (`<doc_id>#<ord>`) — resolve with `get_chunks`. |
| `doc_id` | Parent document identifier — resolve with `get_doc`. |
| `title` | Parent document title. |
| `snippet` | Short extract from the cited chunk. |
| `score` | Retrieval relevance score; comparable within one response only. |

If live citation resolution is partially degraded under load, a workflow tool still returns its full result with fewer (or no) citations and says so in `notes` — it never silently drops citations and never fails the whole call for that reason.

**Point-in-time (`pit`):** several retrieval tools accept `pit`, an ISO date (`YYYY-MM-DD`). Results are restricted to content effective at that date. On every tool `pit` must be a real calendar date — `2026-02-30` is a validation error, not a rollover. Workflow tools derive `pit` internally from `fy` (30 June of the ending year).

### Contents

**Retrieval tools**
[`search`](#search) · [`get_chunks`](#get_chunks) · [`get_doc`](#get_doc) · [`get_definition`](#get_definition) · [`get_threshold`](#get_threshold) · [`fetch`](#fetch) · [`stats`](#stats)

**Personal context**
[`get_user_facts`](#get_user_facts)

**Workflow tools**
[`deduction_discovery`](#deduction_discovery) · [`depreciation_helper`](#depreciation_helper) · [`bas_prep_checklist`](#bas_prep_checklist) · [`audit_risk_check`](#audit_risk_check)

[Plans and limits](#plans-and-limits)

[Disclaimers](#disclaimers)

---

# Plans and limits

Free accounts have 25 corpus lookups every 30 days. Each 30-day period runs from when the account was created. A lookup is any tool call except `get_user_facts` and `stats`. Pro accounts are unlimited. Plan details: https://ato-mcp.com.au/pricing

When 10 or fewer lookups remain, results carry a `notice` string, e.g. `"Free plan: 8 of 25 lookups left (resets 14 March 2027). Plan details: https://ato-mcp.com.au/pricing?src=notice"`. A Pro account whose last payment failed gets a `notice` asking the owner to update their card on its first call of each day (Sydney time); the call still succeeds. When the Free allowance is used up, a tool call returns an `isError` result:

```json
{ "kind": "error", "code": "lookup_limit_reached", "message": "Lookup limit reached: this Free account has used all 25 of its lookups. The allowance resets on 14 March 2027. Plan details: https://ato-mcp.com.au/pricing?src=limit. Tell the user this and do not retry this call.", "plan": "free", "used": 25, "limit": 25, "resets_at": "2027-03-14T02:14:09.457+00:00", "upgrade_url": "https://ato-mcp.com.au/pricing?src=limit" }
```

The error carries `upgrade_url`, an informational link to the plans page. Agents should relay the message and stop retrying. A Pro account that hits the daily fair-use ceiling receives `code: "fair_use_ceiling"` with instructions to email william@ato-mcp.com.au.

---

# Retrieval tools

## search

**Search Australian tax law.** Searches Australian tax sources: ATO guidance from ato.gov.au, the ITAA 1997, ITAA 1936 and GST Act, and ATO public rulings. Returns the most relevant passages best-first, each with its document title, source url, section headings and `published_at` date, carrying `chunk_id`/`doc_id` for follow-up retrieval with `get_chunks` or `get_doc`. Narrow with `source` (and `ruling_series`) when the question is about one kind of source.

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `query` | string | yes | — | 1–2000 chars. What to look for, in plain English or with section and ruling references (e.g. `"s 8-1 general deductions"`, `"TR 2021/1"`). |
| `k` | integer | no | `10` | 1–50. How many passages to return. |
| `source` | string | no | — | Only search one kind of source: `"guidance"` (ato.gov.au pages), `"legislation"` (the Acts) or `"rulings"` (ATO public rulings). Omit to search everything. |
| `ruling_series` | string[] | no | — | Only these ruling series: any of `TR`, `TD`, `GSTR`, `GSTD`, `PR`, `CR`, `LCR`, `PCG`, `MT`, `FTR` — e.g. `["TR", "TD"]` for taxation rulings and determinations, `["GSTR", "GSTD"]` for GST. Implies `source: "rulings"`; combining it with another `source` is a validation error. |
| `include_old` | boolean | no | `false` | Include withdrawn rulings (flagged with `doc_status`), e.g. to research what applied before. |
| `pit` | string | no | today | Answer as at this date (`YYYY-MM-DD`), for law or figures that applied in the past. |

### Output

- `query` — echo of the request.
- `hits` — array of hit objects, ranked best-first:
  - `chunk_id` — chunk identifier (`<doc_id>#<ord>`).
  - `doc_id` — parent document identifier.
  - `ord` — chunk position within the document.
  - `text` — full chunk text.
  - `heading_path` — heading breadcrumb (array of strings).
  - `title`, `url`, `doc_type` — parent document metadata.
  - `published_at` — the source document's last-published date (nullable). Check it when citing rates or thresholds and prefer recent sources.
  - `doc_status` — present only when the source document is not current (e.g. `"withdrawn"`).
  - `income_years` — present only when the page is about specific income years (e.g. `["2016-17"]`). Unless the query names a year, pages only about years before last year rank below current ones.

### Example

```json
{ "query": "working from home fixed rate method", "k": 3, "source": "guidance" }
```

Response (abridged):

```json
{
  "query": "working from home fixed rate method",
  "hits": [
    {
      "chunk_id": "ato:individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/working-from-home-expenses#4",
      "doc_id": "ato:individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/working-from-home-expenses",
      "title": "Working from home expenses",
      "doc_type": "ATO_GUIDE",
      "url": "https://www.ato.gov.au/…",
      "heading_path": ["…"],
      "ord": 4,
      "text": "…fixed rate method … cents per hour you work from home…",
      "published_at": "2026-05-26"
    }
  ]
}
```

**Errors:** throws `Corpus unavailable. This is a server-side issue — please try again shortly.` when the corpus store is not available.

## get_chunks

**Read passages.** Returns specific passages by `chunk_id` (from search results or workflow citations), optionally with the passages either side for context. Use it to expand a hit into enough surrounding context to quote accurately; for a whole document use `get_doc`.

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `chunk_ids` | string[] | yes | — | 1–50 passage ids from search results. |
| `neighbours` | integer | no | `0` | 0–5. Also return this many passages before and after each one. |
| `pit` | string | no | today | Answer as at this date (`YYYY-MM-DD`). |

### Output

- `chunks` — array of chunk records in reading order, in the same shape as `search` hits (`chunk_id`, `doc_id`, `ord`, `text`, `heading_path`, `title`, `url`, `doc_type`, `published_at`, `doc_status` when the source is not current, and `income_years` when the page is about specific years). Unlike `search`, chunks from withdrawn documents are always returned — you asked for them explicitly — with `doc_status` set.
- `truncated` — at most 50 passages are returned per call, requested ones first; `true` when context passages were cut.

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

**Read a full document.** Returns a whole document by `doc_id` (from search results): metadata such as ruling status and Act section, the full text in reading order, and its section anchors. Set `include_citations` to also get the documents it cites and the documents that cite it — useful for walking from a ruling to the sections it interprets, or from a section to the rulings that interpret it.

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `doc_id` | string | yes | — | Document id from search results, e.g. `legis:c2004a05138/40-75` or `ato:individuals-and-families/…`. |
| `include_citations` | boolean | no | `false` | Also list outbound citations (what this document cites) and inbound ones (what cites it). |
| `pit` | string | no | — | Accepted (`YYYY-MM-DD`) for consistency with the other tools; the document is returned as stored. |

### Output

- `doc` — document metadata: `doc_id`, `source` (`ato` \| `legislation` \| `austlii` \| `state_revenue`), `url`, `title`, `jurisdiction`, `doc_type`, `effective_from`, `effective_to`, `published_at`, `metadata` (`status` such as `"withdrawn"`, `act_key` and `section` where relevant).
- `text` — the full document text in reading order, with heading breadcrumbs re-inserted as `## …` lines where they change.
- `chunk_count` — how many chunks the document has in total.
- `truncated` — `true` when the document is very long and `text` was capped at a chunk boundary; fetch the remainder with `get_chunks`.
- `anchors` — array of `{ anchor_id, doc_id, anchor_name, chunk_id }` for sections within the document.
- `citations` — present only when `include_citations` is `true`:
  - `inbound` — passages elsewhere that cite this document: `{ from_chunk_id, to_doc_id, to_anchor, citation_kind }`.
  - `outbound` — documents this one cites, same shape.
  - `inbound_total`, `outbound_total` — how many exist in total. Each list is capped at 50 entries; heavily cited sections (e.g. ITAA 1997 s 8-1) have far more inbound links than that.

### Example

```json
{ "doc_id": "legis:c2004a05138/8-1", "include_citations": true }
```

Response (abridged):

```json
{
  "doc": { "doc_id": "legis:c2004a05138/8-1", "source": "legislation", "title": "ITAA 1997 s 8-1", "doc_type": "LEGISLATION_ITAA1997", "url": "…", "metadata": { "act_key": "…", "section": "8-1" }, "…": "…" },
  "text": "## 8-1 General deductions\n\nYou can deduct from your assessable income any loss or outgoing to the extent that…",
  "chunk_count": 4,
  "truncated": false,
  "anchors": [ { "anchor_id": "…", "doc_id": "legis:c2004a05138/8-1", "anchor_name": "…", "chunk_id": "legis:c2004a05138/8-1#0" } ],
  "citations": {
    "inbound": [ { "from_chunk_id": "ato-law:TR/2024/3#12", "to_doc_id": "legis:c2004a05138/8-1", "to_anchor": null, "citation_kind": "…" }, "…" ],
    "outbound": [ "…" ],
    "inbound_total": 1840,
    "outbound_total": 6
  }
}
```

**Errors:** throws `Corpus unavailable. This is a server-side issue — please try again shortly.` when the corpus store is not available; throws `Document not found: <doc_id>` for an unknown id.

## get_definition

**Look up a tax definition.** Returns the statutory definition of a term from Australian tax law (for example the ITAA 1997 dictionary in s 995-1, or GST Act s 195-1), point-in-time aware. When there is no statutory match, falls back to a clearly labelled ordinary-meaning result instead of failing. The caller MUST respect `kind`: `"statutory"` is a defined legal term; `"ordinary"` is not, and must not be presented as one.

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `term` | string | yes | — | 1–200 chars. The defined term, e.g. `"depreciating asset"` or `"enterprise"`. |
| `pit` | string | no | today | Answer as at this date (`YYYY-MM-DD`). |

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

**Look up tax rates and thresholds.** Returns the value of one or more Australian tax rates, caps and thresholds as at a date, each with its effective dates and source document. Takes several names at once, so related figures need only one call. Names are a closed set, enumerated in the tool schema: `cgt_discount_individual`, `fbt_rate`, `gst_registration_threshold`, `gst_registration_threshold_nonprofit`, `instant_asset_write_off`, `low_income_tax_offset_max`, `medicare_levy_rate`, `small_business_income_tax_offset_cap`, `super_concessional_cap`, `super_guarantee_rate`, `super_non_concessional_cap`, `tax_free_threshold`, `working_from_home_fixed_rate`.

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `names` | string[] | yes | — | The figures to look up: one or more of the enum values above. Duplicates are ignored. |
| `pit` | string | no | today | Answer as at this date (`YYYY-MM-DD`). |

Older callers may still send a single `name` string instead of `names`; it is accepted and treated as a one-item list.

### Output

- `pit` — the date the figures apply at.
- `thresholds` — one row per name with a value effective at `pit`:
  - `name` — threshold key.
  - `value` — numeric value.
  - `unit` — `"AUD"` for dollar amounts, `"percent"` for rates, `"cents_per_hour"` for the working-from-home fixed rate.
  - `effective_from`, `effective_to` — validity window (nullable).
  - `source_doc_id`, `source_anchor` — the document the figure comes from (pass to `get_doc`) and its section (nullable).
- `unavailable` — `{ name, reason }` for each valid name with no value effective at `pit` (for example a new financial year before the ATO publishes its figure). This is not an error; the other names still return.

### Example

```json
{ "names": ["instant_asset_write_off", "super_guarantee_rate"], "pit": "2026-06-30" }
```

Response (abridged):

```json
{
  "pit": "2026-06-30",
  "thresholds": [
    {
      "name": "instant_asset_write_off",
      "value": 20000,
      "unit": "AUD",
      "effective_from": "2023-07-01",
      "effective_to": null,
      "source_doc_id": "ato:businesses-and-organisations/…/instant-asset-write-off",
      "source_anchor": null
    },
    { "name": "super_guarantee_rate", "value": 12, "unit": "percent", "effective_from": "2025-07-01", "…": "…" }
  ],
  "unavailable": []
}
```

A name with no value at the date lands in `unavailable`:

```json
{ "name": "instant_asset_write_off", "reason": "No value is effective at 2027-07-01. It may not be published yet; try an earlier pit, such as the prior financial year." }
```

**Errors:** throws `Corpus unavailable. This is a server-side issue — please try again shortly.` when the corpus store is not available. An unknown name or an invalid `pit` is a validation error.

## fetch

**Fetch a live source page.** Live-fetch a document over HTTPS by scheme-prefixed URI — to check a citation against the live source, or for content newer than, or outside, the corpus snapshot. For documents already returned by `search`, `get_doc` is faster. This is the only open-world tool. Scheme mapping:

| scheme | resolves to |
|---|---|
| `ato:<path>` | `https://www.ato.gov.au/<path>` |
| `ato-law:<docid>` | `https://www.ato.gov.au/law/view.htm?docid=<docid>` |
| `legis:<act>/<section>` | `https://www.legislation.gov.au/Latest/<act>/<section>` |
| `staterev-<juris>:<path>` | the state revenue office site for `nsw`, `vic`, `qld`, `sa`, `wa`, `tas`, `act`, `nt` |

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `uri` | string | yes | — | 1–2048 chars. Page to fetch: a url from search results rewritten to its scheme (see table above), e.g. `"ato:individuals-and-families/your-tax-return"` for an ato.gov.au page or `"ato-law:TXR/TR20241/NAT/ATO/00001"` for a ruling. A full https URL on one of these sites also works, so links in a fetched page can be followed as given. |

### Output

- `uri` — echo of the request.
- `url` — the resolved HTTPS URL fetched.
- `status` — HTTP status code (always `200`; failures raise an error instead).
- `content_type` — response `content-type` header, or `null`.
- `body` — the page as readable text: main content, headings, lists and table rows, with links written as absolute markdown links. Scripts, styles and site navigation are dropped. Non-HTML responses are returned as-is.
- `served_from` — `"live"` for a direct fetch of the source site; `"corpus"` when the source blocked automated access and the stored corpus copy was served instead (`ato:`/`ato-law:` only).
- `retrieved_at` — when `served_from` is `"corpus"`, the timestamp the stored copy was retrieved.
- `truncated` — `true` when the text was capped at 80,000 characters, the same length as `get_doc`. For a stored copy (`served_from: "corpus"`), read the rest with `get_chunks`.

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

**Errors:** throws `Unsupported URI scheme: <uri>` for unknown schemes (including an unrecognised `staterev-` jurisdiction). Throws `Live fetch failed: HTTP <status> from <url> …` when the source responds with anything other than 200 and no corpus copy exists — a blocked or missing page is never silently returned as an empty success.

## stats

**Check plan and usage.** Shows the connected account's plan and lookup allowance — plan, lookups used and remaining, when the allowance resets, billing interval, renewal or end date, and whether a payment is past due — plus how many documents and passages are searchable. Use it when the user asks about their plan, remaining lookups or renewal; it is also the cheapest health check. Doesn't use a lookup. Never throws.

### Input

No parameters (`{}`).

### Output

- `installed` — whether the corpus is available.
- `schema_version` — corpus schema version (e.g. `"0.3.0"`), or `null`.
- `docs` — number of documents.
- `chunks` — number of chunks.
- `plan` — `"free"` or `"pro"`.
- `enforced` — whether lookup limits apply to this account.
- `lookups_used` — lookups used in the current 30-day period.
- `lookups_limit` — the allowance for each 30-day period (Free only; `null` on Pro).
- `lookups_remaining` — remaining in the current period (Free only; `null` on Pro).
- `resets_at` — ISO 8601 timestamp (Sydney) when the next period starts (Free only; `null` on Pro).
- `billing_interval` — `"year"` or `"lifetime"` on Pro (`"month"` on older plans); `null` on Free.
- `renews_at` — ISO 8601 timestamp of the next renewal on Pro; `null` if a cancel is scheduled or on Free.
- `ends_at` — ISO 8601 timestamp when Pro ends, set only when a cancel is scheduled.
- `cancel_scheduled` — `true` when Pro is set to end at the period end.
- `past_due` — `true` when the last Pro payment failed and is being retried.
- `upgrade_url` — informational link to the page describing the plans (Free only).

### Example

```json
{}
```

Response (abridged):

```json
{
  "installed": true,
  "schema_version": "0.3.0",
  "docs": 34564,
  "chunks": 286638,
  "plan": "free",
  "lookups_used": 7,
  "lookups_limit": 25,
  "lookups_remaining": 18,
  "resets_at": "2027-03-14T02:14:09.457+00:00",
  "upgrade_url": "https://ato-mcp.com.au/pricing?src=stats"
}
```

**Errors:** none. If the corpus is unavailable, returns `installed: false` with zero counts.

---

# Personal context

## get_user_facts

**Get the user's tax profile.** Returns the tax profile the user saved at ato-mcp.com.au — state, residency, ABN/business structure, GST registration and period, household and investment flags, and the current financial year. Call once, on the first Australian tax question in a conversation, and reason from it for the rest of that conversation; the workflow tools read the same facts server-side. Doesn't use a lookup.

### Input

No parameters (`{}`).

### Output

- `profile_saved` — `true` when a profile is saved, `false` otherwise.
- `facts` — the validated UserFacts object, or `null` when no profile is saved.
- `setup_url`, `message` — present only when `profile_saved` is `false`: where the user can save their profile, and what that means for the conversation.

UserFacts fields:

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


### Example

```json
{}
```

Response (abridged):

```json
{
  "profile_saved": true,
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
  }
}
```

With no profile saved:

```json
{
  "profile_saved": false,
  "facts": null,
  "setup_url": "https://ato-mcp.com.au/account/facts/edit",
  "message": "No tax profile saved yet. Retrieval tools work without it; workflow tools give general rather than personalised results until the user saves one (about 2 minutes)."
}
```

**Errors:** none. A missing profile returns `profile_saved: false`, not an error.

---

# Workflow tools

All four workflow tools read the user's saved tax profile. Without one they return `{ profile_saved: false, setup_url, message }` as a normal result (see [Profile not saved](#profile-not-saved)). Otherwise each result includes [`citations`](#citations) per item, a `notes` array (including a degradation note if citation resolution was impaired), and a `disclaimer` string.

## deduction_discovery

**Find likely deductions.** Surface every deduction-related category that plausibly applies to the user's tax profile, drawn from a curated taxonomy filtered by their facts. Branches across all taxpayer structures (individual, sole trader, partnership, company, trust, SMSF member), tags each category as belonging on the personal or business-entity return, types it by kind (deduction, offset, CGT event, disallowance, precondition, strategy), and attaches live thresholds, fresh corpus citations, and a discrete confidence rating. Optionally pass `activity` (a free-text spend description) to have the best-matching category identified.

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `activity` | string | no | — | Up to 500 chars. One kind of spending to match, e.g. `"home office internet"` or `"steel-capped boots"`. |
| `fy` | string | no | user's `current_fy` fact | Australian financial year (1 July to 30 June), written like `"2025-26"`; validation error otherwise. |
| `include_low_confidence` | boolean | no | `true` | Include categories that apply to the taxpayer type but have no specific ATO source behind them. Set `false` for a shorter list. |

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
{ "activity": "new laptop for client work" }
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

**No profile:** returns `{ profile_saved: false, setup_url, message }` (not an error) when no tax profile has been saved — see [Profile not saved](#profile-not-saved).

**Errors:** throws `Corpus unavailable. This is a server-side issue — please try again shortly.` when the corpus store is not available.

## depreciation_helper

**Calculate depreciation.** Compute depreciation for a single asset across all applicable methods — prime cost, diminishing value, instant asset write-off, the $300 immediate deduction, the small business pool, and Division 43 capital works — branched by the user's taxpayer structure and small-business-entity status. Calculations are deterministic (day-count apportioned, rounded to cents); the live instant-asset-write-off threshold and ATO/legislation citations are attached per method. Methods that do not apply are listed with the reason rather than omitted.

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `asset_cost` | number | yes | — | Must be > 0. Cost of the asset in Australian dollars, GST-exclusive if the user can claim GST credits. |
| `acquisition_date` | string | yes | — | Date the asset was bought or first used (`YYYY-MM-DD`); validation error otherwise. |
| `business_use_pct` | number | no | `100` | 0–100. Percentage of use that is for work or business. |
| `asset_type` | string | no | — | Up to 200 chars. What the asset is, e.g. `"laptop"` or `"car"`; adds asset-specific notes such as the car limit. |
| `effective_life_years` | number | no | — | Must be > 0. Effective life in years (from the ATO's effective life table). Needed for prime cost and diminishing value; without it those methods are reported under `unavailable`. |
| `is_small_business_entity` | boolean | no | — | Whether the business is a small business entity (aggregated turnover under $10 million). Unset: businesses are assumed to qualify, with a note to confirm. `false` rules out the instant asset write-off and the small business pool. |
| `is_capital_works` | boolean | no | `false` | `true` for building and structural improvements (Division 43) rather than plant and equipment; computes the 2.5%/40-year schedule. |
| `method` | string | no | `"both"` | `"prime_cost"`, `"diminishing_value"`, or `"both"`: which Division 40 schedule(s) to compute. |
| `fy` | string | no | user's `current_fy` fact | Australian financial year (1 July to 30 June), written like `"2025-26"`. |
| `years` | integer | no | ceil(effective life), else 10 | 1–40. How many financial years to schedule. |

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

**No profile:** returns `{ profile_saved: false, setup_url, message }` (not an error) when no tax profile has been saved — see [Profile not saved](#profile-not-saved).

**Errors:** throws `Corpus unavailable. This is a server-side issue — please try again shortly.` when the corpus store is not available. (A pre-9-May-2006 acquisition makes diminishing value `unavailable` — it does not throw.)

## bas_prep_checklist

**Prepare a BAS checklist.** Produce a tiered, cited BAS preparation checklist for the user's GST reporting period: which labels apply (GST G1/1A/1B, full-method G labels, PAYG withholding, PAYG instalments, FBT instalments, fuel tax credits, WET, LCT), what evidence to gather per label, and common gotchas. Sections are tiered `core` (every registered taxpayer), `confirmed` (driven by your facts, e.g. `payg_instalments`), and `conditional` (apply only if the activity exists — verify). Defaults to Simpler BAS; it does not calculate amounts. Users not registered for GST get a cited IAS or no-BAS note instead.

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `period_type` | string | no | from the user's `gst_period` fact | `"monthly"`, `"quarterly"`, `"annual"`: how often the business lodges. |
| `quarter` | integer | no | — | 1–4. Quarter of the Australian financial year: 1 = July–September, 2 = October–December, 3 = January–March, 4 = April–June. Sets `due_date` for quarterly lodgers (statutory dates). |
| `fy` | string | no | user's `current_fy` fact | Australian financial year (1 July to 30 June), written like `"2025-26"`. |
| `full_gst_method` | boolean | no | `false` | `true` if the business reports the full set of GST labels (G2, G3, G10, G11) rather than Simpler BAS. |

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

**No profile:** returns `{ profile_saved: false, setup_url, message }` (not an error) when no tax profile has been saved — see [Profile not saved](#profile-not-saved).

**Errors:** throws `Corpus unavailable. This is a server-side issue — please try again shortly.` when the corpus store is not available.

## audit_risk_check

**Check for audit risk areas.** Flag patterns the ATO is known to scrutinise, given the user's facts plus an optional draft return summary (income, itemised deductions, rental figures). Runs ~13 pure rules — high work-related expenses relative to income, deductions exceeding income, round-number claims, claims hugging the $300 written-evidence concession, car claims near the cents-per-km cap, WFH + phone/internet double-claims, high clothing/laundry, self-education nexus, rental deductions with no rental income, rental interest above rental income, large repairs, crypto held but no CGT reported, and prior-year non-lodgment. Each finding carries a risk band, why it was flagged, what to do, and ATO guidance citations. It is a qualitative heuristic indicator — not an audit prediction and not numeric benchmarking.

### Input

| field | type | required | default | notes |
|---|---|---|---|---|
| `income` | number | no | — | ≥ 0, in Australian dollars. Total income for the year (salary, wages and other assessable income); without it the income-ratio checks are skipped. |
| `deductions` | object[] | no | — | Up to 100 items `{ category: string, amount: number ≥ 0 }`, one per category. `category` is plain words for the claim; recognised: car (or motor vehicle, logbook, cents per km), travel, clothing (or uniform, laundry, dry cleaning), self-education (or course, study, tuition), working from home (or home office, wfh), phone (or internet, mobile), tools, equipment, union, professional, crypto (or capital gain, cgt). Other wording is counted in totals only. |
| `rental` | object | no | — | Rental property figures for the year, in Australian dollars: `{ income?, interest?, repairs?, capital_works? }` (rent received, loan interest, repairs and maintenance, Division 43 capital works), all ≥ 0. |
| `business_income` | number | no | — | Net business income in Australian dollars; can be negative for a loss. |
| `fy` | string | no | user's `current_fy` fact | Australian financial year (1 July to 30 June), written like `"2025-26"`. |

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

**No profile:** returns `{ profile_saved: false, setup_url, message }` (not an error) when no tax profile has been saved — see [Profile not saved](#profile-not-saved).

**Errors:** throws `Corpus unavailable. This is a server-side issue — please try again shortly.` when the corpus store is not available.

---

# Disclaimers

- Every workflow tool returns **structured data plus ATO citations, not tax advice**, and says so in its `disclaimer` field. Verify material decisions with a registered tax agent.
- `audit_risk_check` risk bands and `deduction_discovery` confidence ratings are **heuristic indicators** built on conservative rules of thumb — not audit predictions, ATO determinations, or numeric benchmarking.
- Citations resolve against the current corpus snapshot, which is refreshed monthly. For time-sensitive matters check `published_at` on the cited hit and confirm currency with `fetch` against the live source.
