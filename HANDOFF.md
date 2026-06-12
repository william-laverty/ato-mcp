# Website redesign — "Clinical" design system (2026-06-12, branch `feat/clinical-redesign`)

Full visual redesign of `packages/web` + brand assets away from the NOX dark-mesh/purple aesthetic to a superpower.com-inspired light system: **Switzer** (self-hosted, Fontshare FFL) + **Geist Mono**, Tailwind-zinc neutrals on white, one vermillion accent (`#fa520f`) reserved for citation chips/dots/logo, regular-weight headlines, flat pill buttons, hairline cards, light code blocks. New brand mark (vermillion citation-chip square), new light OG image, new homepage sections (How-it-works, corpus editorial index, striped retrieval-tool table). Every page restyled: home, docs, privacy, terms, onboard ×4 + wizard, account ×3, 404, nav/footer.

- Spec: `docs/superpowers/specs/2026-06-12-website-redesign-design.md` (incl. extracted superpower.com token analysis)
- Plan: `docs/superpowers/plans/2026-06-12-website-redesign.md`
- Verified: 3/3 web tests (privacy contract intact), typecheck, build, grep-audit (zero legacy tokens), Playwright screenshot sweep desktop+mobile of all pages
- `globals.css` 330 → ~120 lines; design vocabulary: `.btn-primary/.btn-outline/.btn-fill`, `.card`, `.chip`, `.code-block`, `.eyebrow`, `.input/.label`, `.badge`
- **Awaiting:** PR review + merge (deploys to Vercel `ato-mcp-web` on merge)

---

# v1.0 — LAUNCHED (2026-06-12)

**ato-mcp v1.0.0 is public.** Repo public (full-history secret scan clean), website redesigned + live at https://ato-mcp.com.au, `v1.0.0` + `corpus-v2026.06` releases published, local mode verified end-to-end (`ato-mcp update` → sha256 → install), hosted mode verified end-to-end with an authenticated 13-tool production smoke. 318 TS + 85 Python tests green.

Launch-day engineering: two live bugs found by the authenticated smoke and fixed (hosted getThreshold SETOF unwrap; citation fan-out statement timeouts → bounded fault-tolerant resolution with explicit degradation notes); backend consolidated 16 → 4 serverless functions via the dynamic `api/[tool].ts` dispatcher; corpus released by exporting the live hosted corpus (`packages/pipeline/scripts/export_from_supabase.py`) because ato.gov.au now bot-blocks fresh scrapes — local and hosted serve the identical snapshot.

**Open human actions:** npm org + token then enable `NPM_PUBLISH_ENABLED` (issue #9); disclaimer legal review before marketing push (issue #10). Open engineering: numeric benchmarking (#5), KV rate-limit + RLS CI (#11), Granite embeddings (#12).

---

# v0.4 handoff (history) — all 4 hero tools shipped

All four v0.4 hero tools are **merged to `main` (PR #1) and live in production** (`api.ato-mcp.com.au` — all four routes return 401 unauthenticated = deployed + auth-gated). Full TS suite green: 159 shared + 79 mcp + 49 backend + 3 web (290 total). **Vercel Web Analytics enabled** on the web app (PR #2; `/_vercel/insights/script.js` serving). **The backend now requires the Vercel Pro plan** — 16 serverless functions exceed Hobby's 12-function cap (the deploy fails post-build otherwise). Recommended next step: consolidate the backend tool endpoints into a single dynamic `api/[tool].ts` dispatcher to remove the function-count pressure and shrink bundles.

> Not yet verified: an **authenticated** prod call exercising the new tools' hosted path (RemoteToolForwarder → backend → WasmEmbedder cold-start → Supabase). The 401s prove the routes deploy, not that the tools execute. Run one real authenticated call per tool before calling v0.4 fully battle-tested.

- `deduction_discovery` (tool 1 of 4) — curated 59-row deduction taxonomy, `resolveCitations()` spine, discrete confidence
- `depreciation_helper` (tool 2 of 4) — deterministic PC/DV/IAWO/SBE-pool/Div 43 schedules
- `bas_prep_checklist` (tool 3 of 4) — tiered, cited BAS checklist filtered by user facts
- `audit_risk_check` (tool 4 of 4) — ~13 qualitative red-flag rules over facts + draft return summary; risk bands + ATO guidance citations; heuristic indicator not numeric benchmarking

All four tools reuse the `resolveCitations()` spine (`packages/shared/src/lib/citations.ts`). All four are registered in `packages/mcp/src/server.ts` (now 13 tools total) and have backend handlers under `packages/backend/api/`.

**Next:** v0.5 scoping. Per-ANZSIC/occupation numeric benchmarking (requires a `benchmarks` table), edited PBR ingest, AAT/FCA case summaries, state revenue offices, better embedding model (see CLAUDE.md "Not yet implemented").

---

# v0.4 handoff — bas_prep_checklist (superseded)

`bas_prep_checklist` (v0.4 tool 3 of 4) is shipped on `feat/v0.4-deduction-discovery`. Full test suite green: 136 shared + 77 mcp + 47 backend + 3 web. Remaining hero tool: `audit_risk_check`.

`deduction_discovery` (v0.4 tool 1 of 4) and `depreciation_helper` (v0.4 tool 2 of 4) are also on this branch and shipped. All three tools reuse the `resolveCitations()` spine (`packages/shared/src/lib/citations.ts`).

---

# v0.3 handoff

Phases A, B, C, D shipped as code. Phase E (analytics polish + RLS verification) and **deployment** are explicit follow-ups that need real Supabase + Vercel credentials. The Granite embedding swap was deferred (still on MiniLM); the v0.2 corpus is what's installed.

## Status snapshot

- **~70 commits on `main`** (run `git log --oneline | head -70`)
- **254 tests passing** across 5 workspaces: 56 shared + 70 mcp + 40 backend + 3 web + 85 pipeline
- Existing v0.2 corpus still installed: **29,180 docs / 224,585 chunks / 1.1 GB** — unchanged
- Two new workspaces: `packages/web/` (Next.js 15 onboarding app) and `packages/backend/` (Vercel functions over Supabase)
- One refactor: tool implementations moved from `packages/mcp/src/tools/` to `packages/shared/src/tools/` behind `Store` + `Embedder` interfaces
- One new MCP tool: `get_user_facts` reads from `~/.ato-mcp/config.json` (local) or from the hosted API (when implemented)

## What you can test right now (without any credentials)

```bash
# 1. All tests still green
pnpm -r test
cd packages/pipeline && uv run pytest -k "not slow"

# 2. Stats still report the v0.2 corpus
node packages/mcp/bin/ato-mcp.js stats

# 3. Web app builds (uses mock Supabase)
pnpm --filter @ato-mcp/web build

# 4. Backend compiles (uses mock Supabase)
pnpm --filter @ato-mcp/backend build

# 5. Web app runs locally with mocked auth
cd packages/web && MOCK_SUPABASE=1 pnpm dev   # http://localhost:3001
```

Visit `http://localhost:3001/onboard` to walk through the 5-step flow against the mock client. Submissions go to in-memory mock; no database writes.

## What shipped in v0.3

### Phase A — Shared-core refactor (commits 4de05e2 → b363b48)

- New `packages/shared/src/store/types.ts` (`Store` interface) and `embed/types.ts` (`Embedder` interface)
- 8 tool implementations moved from `packages/mcp/src/tools/` → `packages/shared/src/tools/`. They now depend on interfaces, not concrete classes.
- `rrfFuse` moved to `packages/shared/src/lib/rrf.ts`
- `RemoteStore` adapter in `packages/mcp/src/store/remote.ts` — forwards every `Store` method to a configurable HTTP endpoint with Bearer auth
- `runMcp()` reads `~/.ato-mcp/config.json`. `mode=hosted` uses `RemoteStore`; `mode=local` (or unset) uses `SqliteStore`. The same MCP binary serves both modes.

### Phase B — Facts schema + `get_user_facts` (commits 16af39e → 4bb6489)

- Bundled ANZSIC 2006 class codes in `packages/shared/src/lib/anzsic.ts` (representative ~80-code subset across all 19 divisions)
- `UserFactsSchema` in `packages/shared/src/facts.ts` — 25 fields, ABN modulus-89 checksum, ANZSIC code validation, cross-field rules (gst_period must match gst_registered, etc.)
- `get_user_facts` MCP tool in `packages/shared/src/tools/get_user_facts.ts`
- MCP `server.ts` reads `facts` from config on startup, passes them to the tool. Hosted-mode path has a `TODO(hosted)` stub — backend is built but not wired

### Phase C — Web onboarding (commits 6272d70 → 0acd19e)

- New `packages/web/` workspace: Next.js 15 (App Router), React 19, Tailwind 3, TypeScript, `@supabase/supabase-js` + `@supabase/ssr`, React Hook Form + zod
- Mock Supabase fallback (`MOCK_SUPABASE=1` or missing env vars) — app builds and runs without any external credentials
- 5-step onboarding flow at `/onboard` → `/onboard/verify` → `/onboard/facts` → `/onboard/mode` → `/onboard/install`
- `FactsWizard` component — 6 sub-steps inside `/onboard/facts`, conditional fields, ANZSIC `<select>` autocomplete using the bundled codes, ABN checksum-validated client- and server-side
- Account dashboard at `/account` with edit, mode-switch, and delete-account flows
- Privacy page at `/privacy` — **schema-driven**: rendered from `UserFactsSchema.shape` at build time. The privacy contract test asserts every schema field is documented.
- `/api/poll` and `/api/onboard/poll` route handlers
- `ato-mcp onboard` CLI command — opens the browser, polls for completion, writes `~/.ato-mcp/config.json`

### Phase D — Hosted backend (commits 151a0ba → bedf23f)

- New `packages/backend/` workspace: Vercel function shape, `@supabase/supabase-js`, `@xenova/transformers`, zod
- `SupabaseStore` in `src/supabase-store.ts` — implements the `Store` interface via Supabase RPC functions. Mock fallback when `MOCK_SUPABASE=1`.
- `WasmEmbedder` in `src/wasm-embedder.ts` — same shape as `OnnxEmbedder` but loads via `@xenova/transformers` WASM (designed for Vercel cold-start)
- 12 Vercel function handlers under `api/v1/`: `search`, `get_chunks`, `fetch`, `stats`, `get_definition`, `get_doc`, `get_doc_anchors`, `get_threshold`, `get_user_facts`, `facts` (PUT), `usage_event` (POST), `onboard/poll` (GET)
- Auth middleware in `api/_middleware.ts` — Bearer-token sha256 lookup against `bearer_tokens` (real Supabase) or simple prefix check (mock). In-memory rate-limit (60 req/min) with a TODO to swap to Vercel KV
- 4 SQL migration files committed at `packages/backend/migrations/`:
  1. `0001_corpus_schema.sql` — `docs`, `chunks` (with `VECTOR(384)` + `TSVECTOR` generated), `anchors`, `citations`, `definitions`, `thresholds`, indexes
  2. `0002_user_schema.sql` — `users`, `user_facts`, `bearer_tokens`, `usage_events`, `onboard_sessions`, `mcp_connections`
  3. `0003_rpc_functions.sql` — `ato_keyword_search`, `ato_vector_search`, `ato_get_chunks`, `ato_get_doc`, `ato_get_doc_anchors`, `ato_get_definition`, `ato_get_threshold`
  4. `0004_rls.sql` — RLS policies isolating each user's facts + events

## What v0.3 did NOT ship (explicitly deferred)

### Granite embedding swap (Phase B4-B6)

Skipped to avoid autonomous risk. The MCP and pipeline still use `sentence-transformers/all-MiniLM-L6-v2`. Retrieval quality is acceptable but a Granite swap would help citation-style queries.

To do later:
1. `embedding_model` in `packages/pipeline/src/ato_pipeline/config.py` → `ibm-granite/granite-embedding-small-english-r2`
2. Probe `Xenova/granite-embedding-small-english-r2` on HuggingFace. If present, just change the model name in `packages/mcp/src/embed/onnx.ts`. If absent, `optimum-cli export onnx ...` and bundle in npm.
3. Rebuild corpus (~70 min).

### Phase E — RLS verification + analytics polish

Tests for RLS isolation (user A can't read user B's data) need a real Postgres + RLS to verify. The SQL is committed (`0004_rls.sql`) but untested.

The schema↔privacy contract test exists (`packages/web/test/privacy-contract.test.tsx`) and asserts every `UserFactsSchema` field appears in the rendered privacy page.

### Deployment

Nothing is deployed. The user must:

1. **Create Supabase project**. Get the project URL, publishable key (`sb_publishable_...`), and secret key (`sb_secret_...`).
2. **Apply migrations in order**:
   ```bash
   psql "$SUPABASE_DB_URL" < packages/backend/migrations/0001_corpus_schema.sql
   psql "$SUPABASE_DB_URL" < packages/backend/migrations/0002_user_schema.sql
   psql "$SUPABASE_DB_URL" < packages/backend/migrations/0003_rpc_functions.sql
   psql "$SUPABASE_DB_URL" < packages/backend/migrations/0004_rls.sql
   ```
   Enable pgvector extension first: `CREATE EXTENSION IF NOT EXISTS vector;`
3. **Import corpus to Supabase** — write a small script (`packages/backend/scripts/import-corpus.ts`, TBD) that reads `ato.sqlite` and batch-inserts into Postgres. Granite embedding swap happens around the same time so we don't have to import twice.
4. **Configure Supabase Auth** — set magic-link sender domain to `auth.ato-mcp.com.au` (CNAME → Supabase) or use Supabase's default sender for dev.
5. **Deploy `packages/web` to Vercel** — `ato-mcp.com.au` and `www.ato-mcp.com.au`. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` in Vercel env.
6. **Deploy `packages/backend` to Vercel** at `api.ato-mcp.com.au`. Set `SUPABASE_URL`, `SUPABASE_SECRET_KEY` in Vercel env.
7. **Test the end-to-end onboarding flow** through a real magic-link email.
8. **(Optional)** swap in-memory rate-limit for `@vercel/kv` in `packages/backend/api/_middleware.ts`.

## Architecture diagram (current state)

```
                ┌────────────────────────────────────┐
                │  packages/shared/                  │
                │   ├─ corpus.ts, tools.ts, facts.ts │
                │   ├─ store/types.ts (Store iface)  │
                │   ├─ embed/types.ts (Embedder)     │
                │   ├─ tools/ (8 tool impls)         │
                │   └─ lib/ (rrf, anzsic)            │
                └─────┬─────────┬──────────────┬─────┘
                      │         │              │
                ┌─────▼────┐ ┌──▼──────┐ ┌─────▼─────┐
                │   mcp    │ │ backend │ │    web    │
                │ (Node)   │ │ (Vercel)│ │ (Next.js) │
                │          │ │         │ │           │
                │ SqliteSt │ │ Supabase│ │  ── only  │
                │ +OnnxEmb │ │ Store + │ │  imports  │
                │  (local) │ │ WasmEmb │ │   types   │
                │          │ │         │ │           │
                │ Remote-  │ │ 12      │ │ 5-step    │
                │  Store   │ │ Vercel  │ │ onboard   │
                │ (hosted) │ │ funcs   │ │ + dash    │
                └────┬─────┘ └────┬────┘ └─────┬─────┘
                     │            │            │
                     │            ▼            ▼
                     │     ┌──────────────────────┐
                     │     │  Supabase (NOT YET)  │
                     │     │  Postgres + pgvector │
                     │     │  Auth (magic link)   │
                     │     │  4 migrations ready  │
                     │     └──────────────────────┘
                     │
              ┌──────▼──────┐
              │ SQLite +    │
              │ sqlite-vec  │  ← v0.2 corpus (1.1 GB)
              │ + FTS5      │
              └─────────────┘

  packages/pipeline (Python) — unchanged. Builds the SQLite corpus.
```

## Comparison vs `gunba/ato-mcp` (status check)

| Aspect | ato-mcp v0.3 (today) | gunba/ato-mcp |
|---|---|---|
| Docs / chunks | 29,180 / 224,585 (unchanged from v0.2) | ~158k / ~467k |
| Tools | 9 (`stats`, `search`, `get_chunks`, `fetch`, `get_definition`, `get_doc`, `get_doc_anchors`, `get_threshold`, `get_user_facts`) | similar set + `get_asset` |
| **Personal facts layer** | yes (new) | none |
| **Web onboarding** | code-complete (Next.js 15) | none |
| **Hosted-mode option** | code-complete (Vercel + Supabase), not deployed | local only |
| **Shared tool core** | yes — same tools run on local MCP and hosted backend | n/a |
| **Time-keyed thresholds** | 3 working | not present |
| **Federal statute (ITAA 1997)** | yes — 4,638 sections + 1,929 definitions | not present |
| ATO public rulings | 2,127 across 10 types | yes |
| Edited PBRs | not yet | yes (~120k) |
| Embedding model | MiniLM-L6-v2 (Granite deferred) | Granite Small R2 |

**v0.3 differentiation is now real, not just promised.** Personal facts + hosted-mode capability are things ato-mcp deliberately doesn't have. Once deployed, the user experience diverges meaningfully.

## Known issues / minor TODOs

1. **Schema version label still `0.1.0`** in the `meta` table — cosmetic.
2. **`citations` table empty** — extraction not wired in.
3. **`search` `doc_type` filter** still ignored.
4. **3 of 8 threshold extractors fail** against live ATO pages.
5. **Hosted-mode facts fetch** in MCP is a `TODO(hosted)` stub — wire up once backend is deployed.
6. **In-memory rate-limit** in backend — swap to Vercel KV for production.
7. **Granite swap** — single-config-line change + rebuild.
8. **`open` npm package** in mcp deps — bumps install size by ~50 KB.
9. **Pages.jsonl scrape cache** from a previous build is gitignored but lingers locally.

## Quick health checks

```bash
pnpm test                                     # 169 TS tests
cd packages/pipeline && uv run pytest -k "not slow"   # 85 Python tests
node packages/mcp/bin/ato-mcp.js stats    # 29180 docs (v0.2 corpus)
node packages/mcp/bin/ato-mcp.js help     # mentions all subcommands incl. onboard
pnpm --filter @ato-mcp/web build              # Next.js builds
pnpm --filter @ato-mcp/backend build          # backend compiles
```

## What I'd recommend for when you wake up

1. **Test the web app locally** with `MOCK_SUPABASE=1 pnpm --filter @ato-mcp/web dev`. Walk through the onboarding flow. Critique the UX before committing to a deployment.
2. **Test the new `get_user_facts` tool**: manually edit `~/.ato-mcp/config.json` to add a `facts` field per `UserFactsSchema`. Reconnect Claude Code. Ask the agent "what do you know about me?" — it should call `get_user_facts` and respond with your facts.
3. **Decide whether to deploy** before v0.4 workflow tools, or skip ahead. Deploying gives you a real shareable URL; skipping ahead means more retrieval features.
4. **Granite swap** is a low-risk, high-value 1-line change + 70-min rebuild. Worth doing whenever you have a free hour.
5. **v0.4 workflow tools** (`deduction_discovery`, `bas_prep_checklist`, etc.) are the next phase of real differentiation. They need the personal facts layer (done) and benchmark/threshold extraction (partly done in v0.2).

## File map of v0.3 additions

```
packages/shared/src/
├── store/types.ts            (NEW)  Store interface
├── embed/types.ts            (NEW)  Embedder interface
├── lib/
│   ├── rrf.ts                (MOVED from mcp)
│   └── anzsic.ts             (NEW)  ANZSIC class codes
├── tools/                    (MOVED 8 files from mcp + 1 NEW)
│   ├── search.ts             (MOVED)
│   ├── get_chunks.ts         (MOVED)
│   ├── fetch.ts              (MOVED)
│   ├── stats.ts              (MOVED)
│   ├── get_definition.ts     (MOVED)
│   ├── get_doc.ts            (MOVED)
│   ├── get_doc_anchors.ts    (MOVED)
│   ├── get_threshold.ts      (MOVED)
│   └── get_user_facts.ts     (NEW)
└── facts.ts                  (NEW)  UserFactsSchema + isValidAbn

packages/mcp/src/
├── store/remote.ts           (NEW)  RemoteStore (hosted-mode forwarder)
├── lib/onboard.ts            (NEW)  CLI onboard command
└── server.ts                 (UPDATED) mode-aware startup

packages/web/                 (NEW WORKSPACE)
├── app/
│   ├── onboard/{,verify/,facts/,mode/,install/}page.tsx
│   ├── account/{,facts/edit/,delete/}page.tsx
│   ├── privacy/page.tsx                       (schema-driven)
│   ├── terms/page.tsx
│   └── api/{poll,onboard/poll}/route.ts
├── components/{FactsWizard,ModeCard,InstallSnippet,DeleteAccountClient}.tsx
└── lib/supabase/{client,server,service}.ts    (with mock fallback)

packages/backend/             (NEW WORKSPACE)
├── api/
│   ├── _middleware.ts                         (auth + rate-limit)
│   └── v1/{12 handlers}.ts
├── src/{supabase,supabase-store,wasm-embedder}.ts
└── migrations/{0001_corpus,0002_user,0003_rpc,0004_rls}.sql
```

## Commit history summary

- **v0.1**: 18 commits — monorepo, pipeline, MCP server, smoke + CI
- **v0.2 Phase A** (framework): 5 commits
- **v0.2 Phase B** (legislation + thresholds): 3 commits
- **v0.2 Phase C** (law.ato.gov.au): 1 commit
- **v0.2 Phase E** (release flow): 3 commits + HANDOFFs
- **v0.3 Phase A** (shared refactor): 4 commits
- **v0.3 Phase B** (facts schema + get_user_facts): 3 commits
- **v0.3 Phase C** (web onboarding): 5 commits
- **v0.3 Phase D** (backend): 3 commits
- **v0.3 HANDOFF**: this commit
