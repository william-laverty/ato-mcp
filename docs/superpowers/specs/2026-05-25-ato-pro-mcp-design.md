# ato-pro MCP — design spec

**Date:** 2026-05-25
**Status:** Approved for implementation planning
**Owner:** William Laverty
**Working name:** `ato-pro` (rename TBD before public release)

## 1. Goals and non-goals

### Goals

1. Give AI agents (Claude Code primarily, any MCP host secondarily) high-quality, cited retrieval over the Australian tax corpus — broader and fresher than the reference implementation `ato-mcp`.
2. Provide a lightweight personal-facts layer (ABN, business type, industry, FY end, GST status, residency, dependants) so the agent always reasons about *this* user without re-asking each session.
3. Provide four high-value structured workflow tools: deduction discovery, BAS prep checklist, audit-risk check, depreciation helper.
4. Ship two deployment modes — fully local (privacy, offline, no ongoing cost) or hosted (no download, always fresh). User picks at onboarding.
5. Open-sourceable end-to-end with no proprietary dependencies.

### Non-goals (v1)

- Lodging tax returns or BAS to the ATO. The MCP prepares figures; the user lodges via MyTax or the ATO Business Portal.
- Connecting to bank feeds, accounting software (Xero / MYOB), or storing transactional data. Receipts and transactions live in agent conversation context only.
- Giving tax advice in the MCP's own voice. Tools return structured data and cited corpus chunks; the agent does any prose.
- Multi-tenant teams, client portfolios for tax agents, or PI-insured advisory features.
- Internationalisation. AU only.
- Native mobile UI. Web onboarding is responsive; everything else is agent-driven.

### Legal frame

- The MCP is information infrastructure, not a Tax Practitioners Board–registered service.
- No fee, no advice-for-reward, no person-to-person advisory relationship — TPB registration is not required at the planned scale.
- Onboarding shows a plain-English disclaimer that the user must accept before continuing: the tool retrieves ATO material and structures the user's situation; it does not constitute tax advice; users should verify with a registered tax agent for material decisions.
- Corpus pipeline records source, jurisdiction, and licence per chunk. ATO content remains subject to ATO publication terms; AustLII / Jade content under their respective terms.

## 2. Architecture

### Deployment modes

The user picks **Local** or **Hosted** at onboarding. The MCP server is the same Node.js process either way; the difference is which storage adapter and embedding client it uses.

```
┌─────────────────────────────────────────────────────────────┐
│                      USER'S MACHINE                          │
│                                                              │
│  ┌────────────────┐         ┌──────────────────────────┐    │
│  │  Claude Code   │  stdio  │  ato-pro-mcp (Node.js)   │    │
│  │  / other host  │ ───MCP──▶  - protocol handler       │    │
│  └────────────────┘         │  - tool router            │    │
│                             │  - per-user config        │    │
│                             └────────┬─────────────────-┘    │
│                                      │                       │
│                       ┌──────────────┴──────────────┐        │
│                  [LOCAL mode]                   [HOSTED mode]│
│                       │                              │       │
│   ┌───────────────────▼──────────┐          ┌────────▼────┐  │
│   │ Local backend (in-process)   │          │ HTTPS+token │  │
│   │  - SQLite + sqlite-vec       │          │  to Vercel  │  │
│   │  - onnxruntime-node          │          └────────┬────┘  │
│   │  - Granite Embed Small R2    │                   │       │
│   │  - workflow tools            │                   │       │
│   └──────────────────────────────┘                   │       │
└──────────────────────────────────────────────────────┼───────┘
                                                       │
                                                       ▼
                            ┌──────────────────────────────────┐
                            │  HOSTED BACKEND (Vercel)         │
                            │  - /api/mcp/* functions          │
                            │  - same tool logic as local      │
                            │  - reads from Supabase           │
                            └──────────────┬───────────────────-┘
                                           ▼
                            ┌──────────────────────────────────┐
                            │  SUPABASE                        │
                            │  - Postgres + pgvector (corpus)  │
                            │  - Postgres FTS (BM25)           │
                            │  - users, personal_facts,        │
                            │    anonymous-aggregate analytics │
                            │  - Supabase Auth (magic link)    │
                            └──────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  WEB ONBOARDING (Vercel, Next.js)                        │
  │  - Sign up (magic link)                                  │
  │  - Personal-facts form                                   │
  │  - Choose local vs hosted                                │
  │  - Generate MCP install snippet + user token             │
  │  - Disclaimer acceptance                                 │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  CORPUS PIPELINE (Python, monthly CI job)                │
  │   ato.gov.au · legislation.gov.au · AustLII · state ROs  │
  │     ↓ scrape (httpx + playwright fallback)               │
  │     ↓ clean (selectolax)                                 │
  │     ↓ chunk (heading-aware)                              │
  │     ↓ embed (Granite Small R2 ONNX, GPU)                 │
  │     ↓ produce: ato-corpus-vYYYY.MM.sqlite (local)        │
  │     ↓ produce: postgres dump (hosted)                    │
  │     ↓ publish: GitHub release + Supabase migration       │
  └──────────────────────────────────────────────────────────┘
```

### Components

1. **`ato-pro-mcp`** — Node.js MCP server, distributed as an npm package. Speaks stdio MCP protocol. Reads `~/.ato-pro/config.json` to know the user's mode, token, and personal facts. Routes each tool call to the local backend or the hosted backend.
2. **Local backend** — in-process within `ato-pro-mcp` when in local mode. SQLite with the `sqlite-vec` extension for vector search; FTS5 for BM25. `onnxruntime-node` runs the Granite Embedding Small R2 model (~50 MB) for query embedding. Workflow tools execute as TypeScript functions over the same SQLite.
3. **Hosted backend** — Vercel functions (TypeScript). Each tool is a `/api/mcp/<tool>` endpoint. Authenticates with a per-user bearer token issued at onboarding. Reads from Supabase via the same tool functions as local.
4. **Supabase** — Postgres + pgvector (corpus chunks), Postgres FTS (BM25), `users` and `user_facts` tables, anonymous-aggregate `usage_events`. Supabase Auth handles magic-link sign-in. RLS isolates users.
5. **Web onboarding** — Next.js app on Vercel. Open-source so users can verify what data is collected. Generates the install snippet for the chosen mode.
6. **Corpus pipeline** — Python, runs as a monthly scheduled GitHub Actions workflow. Scrapes the five source families, cleans HTML, chunks heading-aware, embeds on GPU, ships two artefacts: a SQLite file for local-mode installs (GitHub release) and a Postgres migration for the hosted backend.

### Monorepo layout (Approach A — lean monorepo)

```
ato-pro/
├── packages/
│   ├── mcp/              # TypeScript MCP server (local-mode bundle)
│   ├── backend/          # Vercel functions (hosted-mode tool handlers)
│   ├── web/              # Next.js onboarding app
│   ├── shared/           # TS types: tools, facts, corpus schema
│   └── pipeline/         # Python: scrapers, cleaners, chunker, embedder
├── migrations/           # Supabase SQL migrations
├── scripts/              # release, smoke-test, dev orchestration
├── docs/                 # specs, plans, ADRs
└── .github/workflows/    # corpus-build (monthly), npm-publish, web-deploy
```

A single repo, single npm publish. The corpus is not independently versioned in v1 — easy to split later if needed.

## 3. Corpus pipeline

### Sources

| Source | Acquisition | Volume estimate | Why |
|--------|--------|-----------------|-----|
| ato.gov.au | `tree-crawl` (httpx, async pool, robots-respecting) | ~160k docs | Guidance, calculators, instructions, rulings hub |
| Federal Register of Legislation (`legislation.gov.au`) | Bulk XML compilation download | ITAA 1997 / 1936, GST Act, FBT Act, TAA, SIS Act + regulations across PIT versions; ~50–100k chunks | Statutory law, point-in-time |
| AustLII tax databases | Bulk page scrape with rate-limit; AAT + FCA tax decisions only | ~30–60k decisions, longer chunks | Case law that interprets the statutes and rulings |
| ATO rulings index | Re-indexed from ato.gov.au but typed separately (TR / TD / GSTR / GSTD / PR / CR / LCR / PCG) | overlaps with #1 | The reference lumps rulings; we type them |
| State Revenue Offices (NSW, VIC, QLD, SA, WA, TAS, ACT, NT) | Per-jurisdiction scraper | ~10–40k | Payroll tax, land tax, stamp duty |

Estimated total after dedup: 500k–1M chunks (vs the reference's 467k).

Each pipeline stage emits a JSONL artefact so stages are re-runnable independently — a failure in chunking does not require re-scraping.

### Pipeline stages

```
scrape  → raw_pages/{source}/{doc_id}.html        (httpx + playwright fallback)
clean   → cleaned/{source}/{doc_id}.html          (selectolax; strip nav, ads; keep semantic HTML)
parse   → docs.jsonl                              (doc-level metadata)
chunk   → chunks.jsonl                            (heading-aware ~512-token chunks)
embed   → chunks.npz                              (Granite Small R2 ONNX, GPU; cosine-normalised 384-dim)
package → ato-corpus-vYYYY.MM.sqlite              (SQLite + sqlite-vec virtual table; FTS5 over chunk text)
publish → ato.db.zst on GitHub release + Supabase migration with same data shape
```

### Shared schema (local SQLite and hosted Postgres)

```sql
-- docs: one row per source document
docs(
  doc_id PK, source, url, title, jurisdiction,
  doc_type,                       -- 'ATO_RULING_TR', 'LEGISLATION_ITAA1997', 'AAT_DECISION', ...
  effective_from, effective_to,   -- point-in-time bounds; null=current
  published_at, retrieved_at,
  metadata JSONB                  -- ruling number, court, citation, etc.
);

-- chunks: one row per searchable chunk
chunks(
  chunk_id PK, doc_id FK, ord, text,
  heading_path TEXT[],            -- ['Division 8', 'Section 8-1', 'Subsection (1)']
  effective_from, effective_to,   -- inherited from doc but overridable for amendments
  char_start, char_end,           -- offsets into the cleaned HTML
  embedding vector(384),          -- pgvector (hosted) or sqlite-vec (local)
  tsv tsvector                    -- BM25 (Postgres) or FTS5 (SQLite)
);

-- anchors: in-doc anchors and cross-doc citations
anchors(anchor_id PK, doc_id FK, anchor_name, chunk_id FK);
citations(from_chunk_id FK, to_doc_id FK, to_anchor TEXT NULL, citation_kind);

-- definitions: statutory definitions (ITAA 1997 Dictionary, GST Act, etc.)
definitions(term, doc_id FK, anchor_id FK, body, effective_from, effective_to);

-- benchmarks: ATO small-business benchmarks by ANZSIC code
benchmarks(industry_code, year, metric, low_pct, high_pct, source_doc_id FK);

-- thresholds: time-keyed scalar tax facts
thresholds(name, value, unit, effective_from, effective_to, source_doc_id FK);
```

The `benchmarks` and `thresholds` tables are pipeline-extracted from specific ATO pages. They turn "what is the threshold for X right now?" from a search problem into a lookup. This is what powers the workflow tools.

## 4. MCP tool surface

### Primitives

Every tool returns JSON. Corpus hits include `[doc:<doc_id>]` markers the agent can resolve via `get_chunks` / `get_doc_anchors`; out-of-corpus references use `[fetch:<uri>]`.

| Tool | Purpose |
|------|---------|
| `search` | Hybrid BM25 + pgvector / sqlite-vec. Filters: `source`, `doc_type`, `jurisdiction`, `pit` (point-in-time), `include_old`, `k`. Returns top-k chunks with `doc_id`, `chunk_id`, citation, score, snippet. |
| `get_chunks` | Fetch chunk bodies by `chunk_id` with optional neighbour context (±N chunks). Same shape as the reference for compatibility. |
| `get_doc` | Fetch a whole document by `doc_id` (cleaned HTML, metadata, all anchors). |
| `get_doc_anchors` | Anchor list + reverse citations + historical-version URLs (`pit` URLs for prior compilations). |
| `get_definition` | Statutory definition lookup with PIT support. Returns body + source citation. Falls back to labelled ordinary-meaning (WordNet) only if no statutory definition exists. |
| `fetch` | Live-fetch by URI: `ato:<doc_id>`, `legis:<act>/<section>`, `austlii:<citation>`. Used when the corpus doesn't have something current. |
| `get_threshold` | Lookup time-keyed scalars by name + date. E.g. `get_threshold("instant_asset_write_off", "2025-06-30")` → `{value: 20000, unit: "AUD", source: "ato:..."}`. |
| `get_user_facts` | Returns the personal facts JSON from onboarding. Agent calls this once per session. |
| `get_benchmarks` | Returns ATO small-business benchmarks for an industry code + year. |
| `stats` | Index version, counts, default policy. Same as the reference; includes a `staleness` flag when the corpus is older than 60 days. |

### Hero workflow tools

| Tool | Inputs | Output |
|------|--------|--------|
| `deduction_discovery` | `{occupation?, industry_code?, fy: "2025-26"}`. Defaults pulled from `get_user_facts`. | List of deduction categories applicable to the user's profile. Each item: category name, common examples, ATO ruling refs, "have you considered..." prompt, claim rate, audit-risk band. |
| `bas_prep_checklist` | `{period: "Q4-FY25"}` | Structured checklist: GST line items, PAYG-W lines, PAYG-I, fuel tax credits, WET / LCT / instalment income. For each: what to gather, where it goes on the BAS form, ATO source citation. Does not compute amounts. |
| `audit_risk_check` | `{deductions: [{category, amount}], income, fy}` | Per-deduction: benchmark range for the user's industry, whether the claim is inside / below / above, the ATO publication backing each benchmark, and a risk-band label. |
| `depreciation_helper` | `{asset_cost, business_use_pct, asset_type, acquisition_date, fy}` | Compares Div 40 prime cost vs diminishing value vs Div 43 vs instant asset write-off (using `get_threshold` for current limits). Returns rule sources and the recommended path with reasoning structured as data. |

### Filtering defaults

- `mode=hybrid` by default. `mode=vector` and `mode=keyword` available; both fail loudly rather than degrading when the embedding model can't load.
- Edited Private Advice (EV) excluded unless explicitly included in `types`.
- Non-legislation documents older than `2000-01-01` excluded unless `include_old=true`. Legislation is exempt — historic Acts often have old commencement dates.

## 5. Personal facts and onboarding

### Personal facts model

`get_user_facts` returns this JSON, set during onboarding and editable from the web app:

```ts
type UserFacts = {
  given_name: string
  state: "NSW" | "VIC" | "QLD" | "WA" | "SA" | "TAS" | "ACT" | "NT"
  residency_status: "resident" | "non_resident" | "temporary_resident" | "working_holiday_maker"

  has_abn: boolean
  abn?: string
  business_structure: "sole_trader" | "partnership" | "company" | "trust" | "none"
  business_name?: string
  industry_code?: string                // ANZSIC
  occupation?: string
  gst_registered: boolean
  gst_period: "monthly" | "quarterly" | "annual" | "n/a"
  payg_instalments: boolean
  fbt_payer: boolean

  has_spouse: boolean
  dependants: number
  hecs_help_debt: boolean
  private_health_insurance: boolean
  has_investment_property: boolean
  has_shares_or_managed_funds: boolean
  has_crypto: boolean
  super_fund_type: "industry" | "retail" | "smsf" | "unsure" | "none"

  current_fy: string                    // "2025-26"
  prior_fy_lodged: boolean

  accepted_disclaimer_at: string
  facts_updated_at: string
  schema_version: 1
}
```

About 25 fields. Conservative by design — facts the agent would otherwise have to ask every conversation. No transactions, no receipts, no figures.

### Onboarding flow

Next.js app on Vercel. Steps:

1. **Landing + disclaimer**. Plain-English "this is information infrastructure, not tax advice" with a required checkbox.
2. **Magic-link sign-in** via Supabase Auth. Email + verify. No password.
3. **Facts form**. Multi-step wizard with conditional fields; ABN validated against ABR checksum; occupation / industry picker uses ANZSIC autocomplete.
4. **Deployment choice**. Two cards with plain-English tradeoffs:
   - **Local** — ~3–5 GB one-time download, queries never leave the device, monthly updates via `ato-pro-mcp update`, free forever.
   - **Hosted** — no download, always-fresh corpus, queries sent to the server over TLS but never logged or retained, server code is open source so the user can verify.
5. **Install instructions**. Single command for the chosen mode (claude plugin install or pasteable MCP config snippet).
6. **Verify**. Page polls for the first `stats` call from the user's MCP. When it arrives, onboarding is marked complete.

### Auth and tokens

- **Hosted mode**: per-user bearer token issued at onboarding. Stored in `~/.ato-pro/config.json` chmod 600. Sent as `Authorization: Bearer <token>` to the Vercel backend. Tokens are revocable from the web app.
- **Local mode**: no token needed for tool calls. A separate token is issued only for the `usage_events` ping (see §6) and the update-check call.

### Analytics — what is collected, what is not

The hard rule: collect facts about the *user population*, never about queries or sessions.

Stored in Supabase:

```
users(user_id PK, email, created_at, last_seen_at, mode, schema_version)

user_facts(user_id FK, ...UserFacts shape, but no given_name)
   -- so the operator can see population shape (distribution of business
   -- structures, GST registration, industries) without seeing individual identity

usage_events(user_id FK, event_time, event_type, mode)
   -- event_type ∈ { mcp_started, heartbeat, update_check, update_applied }
   -- heartbeat: any MCP activity in the last N minutes (no tool name recorded)
   -- NO tool name, NO query content, NO chunk IDs, NO results
```

The backend has *no* table that stores tool calls, queries, or results. Vercel functions log only HTTP status + latency, with the path stripped to the tool name. The published privacy policy mirrors the schema literally.

A "delete my data" button in the web app deletes the user row, cascading via foreign keys to facts and events.

## 6. Execution paths and security

### Request lifecycle — local mode

```
agent: "Can a sole trader graphic designer claim Adobe Creative Cloud?"
  ↓
Claude Code → stdio → ato-pro-mcp
  1. Resolve tool → search
  2. Read ~/.ato-pro/config.json → mode = "local"
  3. Open SQLite at ~/.ato-pro/corpus/ato.db (lazy, cached process-wide)
  4. Load Granite ONNX model (lazy, cached)
  5. Embed query → 384-dim vector
  6. Hybrid search: vec_distance_cosine + chunks_fts MATCH, fused by RRF
  7. Resolve citations, attach [doc:X] markers
  8. Return JSON via stdio
```

No network. Only outbound calls in local mode:

- `ato-pro-mcp update` (manual) → GitHub releases for the latest corpus zst.
- `usage_events` ping → Supabase, payload limited to `{user_id, event_type, timestamp, mode}`.

### Request lifecycle — hosted mode

```
ato-pro-mcp (Node, user's machine):
  1. Read ~/.ato-pro/config.json → mode = "hosted", token = "..."
  2. POST https://api.ato-pro.dev/mcp/<tool>
     Authorization: Bearer <token>
     Body: { args: {...} }
  ↓
Vercel function /api/mcp/<tool>:
  1. Validate token via Supabase Auth helpers
  2. Embed query (Granite ONNX in WASM via @xenova/transformers — see open question §8.1)
  3. Hybrid search against Supabase:
       SELECT ... FROM chunks
       WHERE embedding <=> $1 < threshold
          OR tsv @@ websearch_to_tsquery($2)
       ORDER BY ... LIMIT k;
  4. Log only: tool=<name> status=200 dur_ms=143  (no inputs, no outputs)
  5. Return JSON
```

The two paths share the **same TypeScript tool-handler code** in `packages/shared/tools/`. What differs is the storage adapter (`SqliteStore` vs `SupabaseStore`) and the embedding client (`OnnxEmbedder` vs `RemoteEmbedder`). This is the single biggest correctness lever — both modes go through the same code, so behaviour cannot drift.

### Embedding parity

The corpus is embedded with Granite Embedding Small R2 on GPU. Local mode embeds queries with the same model via `onnxruntime-node`. Hosted mode embedding is an **open question** (see §8.1) — default plan is to run the same ONNX model in a Vercel function via WASM. If cold-start cost is unacceptable, fall back to a dedicated embedding worker on Cloudflare Workers AI or Modal.

A different embedding model (e.g. Voyage AI) is **disqualifying** unless the corpus is re-embedded with the same model — the vector space would not match.

### Security controls

| Surface | Threat | Control |
|---------|--------|---------|
| Local config (`~/.ato-pro/config.json`) | Other local processes read the bearer token | File mode `0600` on write; documented in privacy policy; tokens revocable |
| Onboarding (Next.js) | Account takeover via magic-link replay | Supabase default magic-link TTL (1 hour), one-time use, IP recorded for the auth event (audit only) |
| MCP → hosted API | Token theft from logs / Vercel deployment | Token never logged; bearer comparison constant-time; rate-limit by user_id via Vercel KV |
| Hosted DB | Vendor outage or breach | Row-Level Security: users can only read their own facts and events; corpus tables public-read by role; RLS verified by integration test on every CI |
| Hosted DB | Internal access by maintainer | Production access via least-privileged service role; query logs disabled at the Postgres level for the user tables; "delete my data" enforced by cascading FKs |
| Corpus releases | Tampered SQLite from a hijacked release | Each release manifest carries SHA-256; `ato-pro-mcp update` verifies before atomic-rename; signed manifests deferred to v1.1 |
| Web onboarding | XSS via uncontrolled facts input | React default escaping + strict CSP; ABN / industry / occupation use server-validated enums or checksum validation |
| Personal facts at rest | Operator reads PII | Sensitive columns (`given_name`, `abn`) encrypted at column level with a server-held key separate from the Supabase project key (envelope encryption via Vercel env + KMS). The maintainer logically *can* decrypt; the system is designed so they don't. Documented honestly. |

Honest framing: this is "no-log policy" privacy, not cryptographic privacy. The open-source server code lets users verify the architecture matches the claim. Users wanting stronger guarantees pick local mode.

### Reliability and failure modes

| Failure | What the user sees | What the MCP does |
|---------|--------------------|-------------------|
| Corpus missing (first run, local) | "Corpus not found. Run `ato-pro-mcp update`." | `stats` returns `{installed: false}`; `initialize` includes a setup instruction the agent surfaces |
| Embedding model missing | Distinct, actionable message | Auto-download on first run if user opted in; otherwise instruct |
| Hosted backend down | "Hosted backend unreachable. Try again or switch to local mode." | Retry once with backoff; surface a single clear error; no silent fallback to keyword-only |
| Hosted token revoked / expired | "Authentication failed. Re-run onboarding to reissue your token." | One actionable message, no retry loop |
| Search returns zero results | Empty results array | Caller's problem; the agent broadens filters or calls `fetch` |
| `fetch` target 4xx / rate-limited | Structured error with the source URL | Surface to the agent; never swallow |
| Stale corpus (>60 days) | `stats.staleness` flag set; `initialize` instructions suggest an update | Same pattern as the reference |

Hard rule: **no silent failures.** Errors propagate as structured tool results with `kind: "error"` and a human-readable message — never empty arrays, never best-effort fallback unless the user opted in to it.

## 7. Testing strategy

### Unit (per package)

- `packages/shared/tools/`: each tool function tested against a tiny synthetic SQLite fixture and a mocked Supabase. The same test suite runs against both adapters — this guarantees local / hosted parity.
- `packages/pipeline/`: scraper tests pin against recorded HTML fixtures (a sample ATO ruling page, a legislation compilation, an AAT decision). Cleaning and chunking are pure functions, property-testable.
- `packages/web/`: form-level tests on the onboarding wizard (conditional fields, ABN checksum, disclaimer gate).

### Integration

- **Local mode**: launch `ato-pro-mcp` against a 100-doc seeded SQLite, send MCP protocol messages over a stdio harness, assert tool round-trips. Mirrors the reference's `scripts/smoke.sh`.
- **Hosted mode**: Vitest hits a `pnpm dev` Vercel function on a local Postgres seeded with the same 100-doc fixture. Same assertions as the local-mode suite (`testToolBehaviour(adapter)` shared spec, run twice).
- **RLS verification**: dedicated test that, as user A, attempts to read user B's facts via every endpoint. Must fail. This is the test that protects the privacy promise — runs on every CI.
- **Onboarding end-to-end**: Playwright happy path through the wizard, magic-link mocked, asserts the final config snippet matches schema.

### Corpus quality (eval, runs on each release)

- A hand-curated set of ~50 representative sole-trader questions with expected `doc_id` citations. Pipeline regression: `recall@10 ≥ 0.85`; drops in score block the release.
- Schema-validity check: every chunk has `effective_from`, citation, `heading_path`. Drift catches scraper breakage early.
- Threshold / benchmark extraction check: a tiny set of known-good thresholds (e.g. instant asset write-off for FY24) — pipeline must reproduce exactly. This protects the workflow tools from silently going wrong.

### Out of scope for v1

- Load / soak testing (single user at v1).
- Multi-region failover (Vercel handles it).
- Chaos / fuzz on the MCP protocol layer (SDK is the source of truth).

## 8. Open questions

1. **Hosted embedding parity** — confirm whether Granite Small R2 ONNX runs acceptably in a Vercel edge function (~300 ms warm tolerable; cold start could be 1–2 s and unacceptable). If not, fall back to a dedicated embedding worker on Cloudflare Workers AI or Modal. Smoke-test in week 1 of implementation.
2. **AustLII scraping terms** — re-read AustLII's policy on bulk download. Acquiring metadata + body for non-commercial open-source use is likely fine; record the exact URL patterns and cadence used and surface them in the corpus manifest. Fallback: Federal Court direct + Jade (also free).
3. **Industry-code source** — ANZSIC 2006 is the AU standard; the ATO uses its own derived codes for benchmarks. Map ANZSIC → ATO industry code in the pipeline. ATO publishes the mapping as a CSV; one-time ingest task.
4. **Web onboarding domain and plugin name** — placeholders `app.ato-pro.dev` and `@williaml/ato-pro-mcp`. Final naming during implementation planning.
5. **Disclaimer wording sign-off** — draft text exists in §1, but a tax-aware lawyer should review before public open-source launch. Not a v1 blocker; required before broad release.
6. **Residency mid-FY changes** — facts model assumes residency is stable for the FY. If status changes mid-year, the agent needs to know. Probably surface in the facts UI as "if your residency changed during the FY, tell the agent." Out of scope for v1 schema.

## 9. Phased delivery (high-level sketch)

The detailed implementation plan replaces this. Sketch only:

- **v0.1 — scaffolding**: monorepo + shared schema + Python pipeline scraping ATO website only + SQLite output + minimal MCP server with `search` / `get_chunks` / `stats` working locally. Goal: parity with the reference's core.
- **v0.2 — wider corpus**: legislation, AAT / FCA, ATO rulings re-indexed by type, state revenue offices. Point-in-time queries first-class. Add `get_definition`, `get_doc_anchors`, `fetch`, `get_threshold`.
- **v0.3 — personal**: web onboarding, Supabase, magic-link, facts schema, `get_user_facts`. Local mode reads facts from `~/.ato-pro/`; hosted mode introduced; both modes share tool code.
- **v0.4 — workflows**: `deduction_discovery`, `bas_prep_checklist`, `audit_risk_check`, `depreciation_helper`. Benchmark and threshold extraction wired into the pipeline.
- **v1.0 — open source**: docs, privacy policy, license, GitHub Actions, plugin marketplace listing, public launch.

## 10. Explicit v1 non-features

These are deliberately out of scope; each would double the v1 surface:

- Lodgement to the ATO (MyTax / Business Portal integration).
- Bank-feed / Xero / MYOB integration.
- Australian Business Register (ABR) live lookups (corpus is sufficient).
- Fringe benefits tax calculator (FBT is rare for sole traders without employees).
- SMSF-specific tooling (would require SIS Act deep dive).
- Multi-user / team / agent-portfolio features.
- Paid tier or billing.
