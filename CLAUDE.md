# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Infra IDs & secrets** (Supabase project ref, Vercel project/team IDs, MCP-session notes, deployment-state table) live in **`CLAUDE.local.md`** (gitignored). This file is checked into the **public** repo — keep credentials out of it.

## What this is

`ato-mcp` gives AI agents cited, current retrieval over the Australian Taxation Office corpus — ATO website guidance, the Income Tax Assessment Act 1997, and ATO public rulings — plus personal tax context and four deterministic workflow tools, over the MCP stdio protocol.

It is **hosted-only** (as of v1.1.0). The shipped client is a thin forwarder: it reads `ATO_MCP_TOKEN` from the environment and forwards every tool call to `api.ato-mcp.com.au`, where the backend runs the shared tool code against Supabase Postgres + pgvector. There is no local corpus and no offline mode. The corpus-building engine is private (see Repositories), so the hosted service is the only way to access the corpus — the basis for eventual premium pricing.

## Repositories

| Repo | Visibility | Contents |
|---|---|---|
| **`william-laverty/ato-mcp`** | public | This monorepo: the `ato-mcp` client, `@ato-mcp/shared`, the Vercel/Supabase backend, the Next.js website, docs. |
| **`william-laverty/ato-mcp-engine`** | **private** | The corpus engine: the Python pipeline (scraper/embedder/indexer), the SQLite→Supabase importer (`import/import-corpus.ts`), and a monthly `corpus-build` GitHub Actions workflow that builds the corpus and auto-imports it to Supabase. The "moat". |

GitHub rulesets on the public repo: `protect-main` (require PR + the `node` status check; block force-push/deletion on `main`; admin bypass), `protect-release-tags` (block deletion/update of `v*` and `corpus-v*` tags).

## Product surfaces (the "listings")

- **npm:** **`ato-mcp`** (unscoped, public) — the MCP client. Install: `npx -y ato-mcp` with `ATO_MCP_TOKEN` in the AI client's MCP config `env`. `@ato-mcp/shared` is **not published** (dev-only dependency of the client, used by tests). Published from CI via **npm Trusted Publishing (OIDC)** — no stored token — on `v*` GitHub releases, gated by the `NPM_PUBLISH_ENABLED` repo variable. Provenance-signed.
- **Website:** `ato-mcp.com.au` (canonical) / `ato-mcp.com` (301 redirect) — Vercel project `ato-mcp-web`, root `packages/web`. Pages: `/` (landing), `/onboard` → `/onboard/verify` (magic link) → `/onboard/facts` (wizard) → `/onboard/install` (token + config snippet), `/account` (+ `/account/facts/edit`, `/account/delete`), `/docs`, `/privacy`, `/terms`. One Next.js API route: `/api/poll` (install-page connection detection).
- **Backend API:** `api.ato-mcp.com.au` — Vercel project `ato-mcp-backend`, root `packages/backend`. Bearer-token auth. Endpoints (the `/api` prefix is stripped by `vercel.json` rewrites): `api.ato-mcp.com.au/<tool>` for all 13 tools (one dispatcher), plus `/facts` (PUT) and `/usage_event` (POST). No `/v1/` versioning.
- **Database:** Supabase Postgres + pgvector, region `ap-southeast-2` (project ref & keys in `CLAUDE.local.md`). 7 migrations applied. See "Database schema" below.
- **Vercel:** two projects (`ato-mcp-web`, `ato-mcp-backend`), both git-integrated (auto-deploy on push to `main`; PR previews). Node runtime only (not Edge — see Gotchas). Project/team IDs in `CLAUDE.local.md`.

## The corpus

**Sources** (scraped/built by the private engine repo):
- **ato.gov.au** — website guidance, via the sitemap.
- **Federal Register of Legislation** (legislation.gov.au) — the Income Tax Assessment Act 1997, via EPUB compilations (4,638 sections + 1,929 statutory definitions).
- **law.ato.gov.au** — public rulings via the browse API (2,127 docs across 10 ruling series: TR, TD, GSTR, etc.).

**Live size** (in Supabase): ~29,181 docs, ~224,585 chunks, 4,638 anchors, 1,929 definitions, 8 thresholds, ~23,267 citation edges.

**Embedding model:** `all-MiniLM-L6-v2`, 384-dim. The engine embeds the corpus (`sentence-transformers/all-MiniLM-L6-v2`); the backend embeds queries at serve time (`Xenova/all-MiniLM-L6-v2` via `WasmEmbedder`). **These must use the same model** — a model upgrade is a coordinated change across both repos + a full re-embed.

**Refresh:** the engine repo's `corpus-build` workflow (monthly cron + `workflow_dispatch`) builds the corpus and imports it directly to Supabase (needs `SUPABASE_URL` + `SUPABASE_SECRET_KEY` in the engine repo's Actions secrets). The importer is idempotent: docs/chunks/anchors upsert on natural PKs; definitions/thresholds (BIGSERIAL PK, no natural key) are cleared then re-inserted. No public corpus download exists (the old `corpus-v*` GitHub release was withdrawn).

## The 13 MCP tools

Defined as schemas in `packages/mcp/src/server.ts` (`TOOLS`) and implemented in `packages/shared/src/tools/`. Same code runs server-side in the backend dispatcher.

**Retrieval (9):**
- `search` — hybrid BM25 + vector search; returns top-k chunks with `[doc:X]` citations.
- `get_chunks` — fetch chunk bodies by id, with optional neighbour context.
- `fetch` — live-fetch a document by URI. Schemes: `ato:`, `ato-law:`, `legis:`, `staterev-<juris>:`.
- `get_definition` — statutory definition, point-in-time aware (WordNet ordinary-meaning fallback is planned, not yet built).
- `get_doc` — full document by `doc_id` with cleaned HTML + anchors.
- `get_doc_anchors` — in-doc anchors + the citation graph (inbound/outbound).
- `get_threshold` — time-keyed scalar tax facts (e.g. `gst_registration_threshold`, `instant_asset_write_off`).
- `stats` — corpus coverage/freshness.
- `get_user_facts` — the authenticated user's saved tax profile (`{facts}`).

**Workflow (4)** — all cited, all branch on the user's taxpayer structure, all reuse `resolveCitations()` (`packages/shared/src/lib/citations.ts`):
- `deduction_discovery` — surfaces matching deductions from a 59-category cited taxonomy.
- `depreciation_helper` — prime cost / diminishing value / instant write-off / $300 / small-business pool / Division 43 schedules.
- `bas_prep_checklist` — tiered, cited BAS checklist for the user's GST period.
- `audit_risk_check` — ~13 red-flag rules with risk bands (heuristic, not a prediction).

## Monorepo layout (pnpm workspaces, pnpm@10.28.2)

```
packages/
├── shared/   @ato-mcp/shared — TS types + Zod schemas, Store/Embedder interfaces,
│             the 13 shared tool implementations, ANZSIC list, UserFactsSchema,
│             citations spine, deduction taxonomy. Consumed by mcp, backend, web.
├── mcp/      ato-mcp (unscoped npm) — hosted MCP client. RemoteToolForwarder
│             forwards every tool call to api.ato-mcp.com.au using ATO_MCP_TOKEN.
│             No native runtime deps. SqliteStore lives in test/helpers/ as a
│             test-only fixture (so retrieval-tool integration tests keep coverage).
├── backend/  @ato-mcp/backend — Vercel functions over Supabase. 3 serverless
│             functions; SupabaseStore + WasmEmbedder. Migrations under migrations/.
└── web/      @ato-mcp/web — Next.js 15 App Router site + onboarding + account.
              Magic-link auth via @supabase/ssr.
```

The Python corpus pipeline (`packages/pipeline` in the ≤v1.0 tree) now lives in the private `ato-mcp-engine` repo. **Note:** a stale, untracked `packages/pipeline/` directory (local `.venv` + `corpus-*` build artifacts, all gitignored) may linger on a dev machine from before the split — it is not in git and can be removed with `rm -rf packages/pipeline`.

## Toolchain and versions

- **Node 22+** (Vercel deploys on 24).
- **pnpm 10.28.2** (pinned via `packageManager`; CI/Vercel auto-pick it).
- **TypeScript 5.6.3** (root devDep, inherited by workspaces).
- Python/uv is used **only** in the private `ato-mcp-engine` repo (the corpus pipeline). There is no Python in this repo anymore.
- GitHub Actions are pinned to Node-24 majors: `actions/checkout@v6`, `actions/setup-node@v6`, `pnpm/action-setup@v6` (public repo); the engine repo adds `astral-sh/setup-uv@v8.2.0` (no moving major tag — pin exact) + `actions/upload-artifact@v7`.

`pnpm.onlyBuiltDependencies` (root `package.json`) whitelists `better-sqlite3`, `esbuild`, `onnxruntime-node`, `sharp` — pnpm 10 ignores postinstall builds by default; this opts them back in. `better-sqlite3` is needed by the mcp test fixture; `onnxruntime-node`/`sharp` by the backend's transformers embedder + the web OG renderer. Don't remove entries without checking each consumer.

## Common commands

```bash
# From repo root
pnpm install
pnpm -r build            # all packages
pnpm -r typecheck
pnpm -r test             # all TS tests
pnpm test:smoke          # hosted smoke (scripts/smoke.sh): build + token-guidance + help

# Per-workspace
pnpm --filter @ato-mcp/shared test
pnpm --filter @ato-mcp/web dev        # Next.js dev on :3001
pnpm --filter @ato-mcp/backend build
pnpm --filter ato-mcp build           # client tsc + emit dist/

# MCP client CLI (after building mcp)
ATO_MCP_TOKEN=... node packages/mcp/bin/ato-mcp.js   # start stdio server (default action)
node packages/mcp/bin/ato-mcp.js help

# Corpus refresh, pipeline work, and the Supabase importer live in the private
# ato-mcp-engine repo — trigger its `corpus-build` workflow (workflow_dispatch).
```

## Architecture: how the pieces fit

```
┌─────────────────────────────────────────────┐
│ Claude Code / any MCP host                   │
└───────────────┬─────────────────────────────┘
                │ stdio MCP protocol
                ▼
┌─────────────────────────────────────────────┐
│ packages/mcp  (npm: ato-mcp)                 │
│  reads ATO_MCP_TOKEN                          │
│  RemoteToolForwarder → POST {tool} over HTTPS │
│  + fire-and-forget usage_event "mcp_started"  │
└───────────────┬─────────────────────────────┘
                │ Bearer token
                ▼
   ato-mcp.com.au        api.ato-mcp.com.au          Supabase
     (Next.js, Vercel)    (Vercel functions)         (Postgres + pgvector)
        │                    │                            │
   magic-link auth      api/[tool].ts dispatcher      corpus tables (read)
   /onboard /account    facts.ts, usage_event.ts      user tables (RLS)
   /docs /privacy       SupabaseStore + WasmEmbedder   RPCs (search, threshold…)
```

### Shared tool core

Every tool lives in `packages/shared/src/tools/` as a pure function `(deps: { store, embedder, ... }, args) => result`. The backend runs them directly. The contract is the `Store` (`packages/shared/src/store/types.ts`) and `Embedder` (`embed/types.ts`) interfaces — implement them and the tools work.

Adapters:
- `packages/mcp/src/lib/remote-tools.ts` — the shipped HTTP forwarder (the only thing the client does).
- `packages/backend/src/supabase-store.ts` — Supabase RPC/query implementation (the serving path).
- `packages/backend/src/wasm-embedder.ts` — MiniLM query embedding (lazy-loaded; mocked in tests via `MOCK_SUPABASE=1`).
- `packages/mcp/test/helpers/sqlite-store.ts` — SqliteStore, a **test-only** fixture for retrieval-tool integration tests (`packages/mcp/test/tools/*.test.ts`).

### Backend handler convention

All 13 tool endpoints are one dynamic dispatcher: `packages/backend/api/[tool].ts` — a `TOOLS` map of `name → runner`, a module-level `SupabaseStore`, a lazy `WasmEmbedder` (only for tools that embed), and a single `lookupUserFacts(userId)`. Unknown tool → 404; tool errors → 400 `{kind:"error", message}`. To add a tool: schema in shared, entry in the dispatcher map — do NOT add a new `api/*.ts` file (function count + bundle size regress).

Only non-tool endpoints get their own files: `facts.ts` (PUT user facts), `usage_event.ts` (POST analytics + connection ping). `_adapter.ts` wraps Web-Standard `(req: Request) => Response` handlers for Vercel's Node runtime; `_middleware.ts` does bearer-token auth (sha256 lookup in `bearer_tokens`) + rate limiting. Three serverless functions total.

## Database schema (Supabase)

**Corpus tables** (read-only at serve time; populated by the engine repo's importer):
- `docs`, `chunks` (with pgvector embeddings), `anchors`, `citations`, `definitions`, `thresholds`, `meta` (corpus version/build metadata).

**User / auth tables** (RLS-protected, per-user):
- `users`, `user_facts` (the 25-field tax profile), `bearer_tokens` (sha256 token hashes — the table API auth reads, written by the web `issueToken` action), `usage_events` (coarse analytics; never query text/results), `mcp_connections` (drives the install-page "connected" indicator via `last_seen_at`), `onboard_sessions` (vestigial — the CLI onboard-poll flow was removed).

**Migrations** (`packages/backend/migrations/`): `0001_corpus_schema`, `0002_user_schema`, `0003_rpc_functions`, `0004_rls`, `0005_citations_natural_key`, `0006_bulk_update_chunk_embeddings_rpc`, `0007_drop_dead_mode_columns` (dropped the dead `mode` columns after local mode was removed).

## Release & publish

- **Software releases:** cut a `v*` GitHub release → `npm-publish.yml` builds, tests, and publishes **`ato-mcp`** to npm via OIDC Trusted Publishing (no token), gated by `vars.NPM_PUBLISH_ENABLED == 'true'`. The package's Trusted Publisher is configured on npmjs.com (GitHub Actions → `william-laverty/ato-mcp` → `npm-publish.yml`). `@ato-mcp/shared` is not published.
- **Corpus releases:** none public — the corpus is served only from Supabase. Refreshes happen in the private engine repo.
- CI (`ci.yml`): node-only (build + typecheck + test) on PRs and pushes to `main`.

## Implementation status

- v0.1–v0.4: monorepo, ATO/ITAA/rulings corpus, the 9 retrieval tools, UserFactsSchema + `get_user_facts`, web app + onboarding, Vercel/Supabase backend, the 4 workflow tools.
- v1.0: public launch — backend dispatcher consolidation, citation graph (23,267 edges), authenticated production smoke green.
- 2026-06: website redesigned to the "Clinical" design system (Switzer + Geist Mono, zinc + vermillion, fully light).
- **v1.1 (current): hosted-only.** Local mode removed; `ato-mcp` is a pure `ATO_MCP_TOKEN` forwarder (no SQLite/ONNX runtime), published unscoped via OIDC Trusted Publishing. Corpus gated (no public download). Pipeline + importer split to the private `ato-mcp-engine` repo (auto-imports to Supabase). Backend reduced to 3 functions; `mode` removed from schema + DB (migration 0007). Pre-existing bugs fixed: token persistence (`issueToken` → `bearer_tokens`), `/api/poll` → `last_seen_at`.

### Not yet implemented

- Edited PBR ingest (~120k more docs from law.ato.gov.au — would 5× the corpus).
- AAT/Federal Court case summaries; state revenue offices (8 jurisdictions).
- WordNet ordinary-meaning fallback for `get_definition`.
- Per-ANZSIC/occupation numeric benchmarking (needs a `benchmarks` table).
- **A better embedding model than MiniLM-L6-v2.** Granite r2 / ModernBERT was reverted — the only transformers.js release with ModernBERT support bundles too many onnxruntime platform binaries to fit Vercel's 250MB function limit. Options: external embedding API; bundle slimming to the linux/x64 binary only; or move inference off Vercel.

## Gotchas

- **Vercel Node runtime ≠ Web Standard handlers.** Vercel auto-dispatches `(req, res)` Node-legacy; to write `(req: Request) => Response` you MUST go through `api/_adapter.ts`. Edge runtime would allow native Web Standard but breaks on `onnxruntime-node`/`sharp` (the backend's embedder chain).
- **Sharp native binary** is patched via `pnpm.patchedDependencies` in `pnpm-workspace.yaml` (`patches/sharp@0.32.6.patch`). Don't `pnpm install --force` without the patch — the `@xenova/transformers` import chain fails when sharp can't load on Node 23+.
- **pnpm filter on Vercel build.** Both `vercel.json` files use `pnpm install --filter "@ato-mcp/<x>..."` so deploys don't compile `better-sqlite3` (it's only the mcp test-fixture devDep, not needed by web/backend). Don't drop the filter.
- **Tests that use `SqliteStore` need native bindings.** If `pnpm install` skipped postinstalls, run `pnpm rebuild better-sqlite3` once (the `onlyBuiltDependencies` whitelist is configured).
- **Embedding model must match** between the engine (corpus vectors) and the backend (query vectors). Don't change one without the other + a re-embed.
- **The importer lives in the private engine repo.** To refresh the corpus, `workflow_dispatch` the engine's `corpus-build` workflow (do not look for `import-corpus.ts` here).
- **`astral-sh/setup-uv` has no moving major tag** — pin it to an exact version (`@v8.2.0`) in the engine workflows.
- **Web fonts are self-hosted.** Switzer woff2/otf live in `packages/web/app/fonts/` (Fontshare ITF FFL, see `FFL.txt`); the OTFs are only for the OG-image renderer.
