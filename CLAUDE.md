# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Infra IDs & secrets** (Supabase project ref, Vercel project/team IDs, MCP-session notes, deployment-state table) live in **`CLAUDE.local.md`** (gitignored). This file is checked into the **public** repo — keep credentials and internal operational detail out of it.

## What this is

`ato-mcp` gives AI agents cited, current retrieval over the Australian Taxation Office corpus — ATO website guidance, the Income Tax Assessment Act 1997, and ATO public rulings — plus personal tax context and four deterministic workflow tools, over the MCP stdio protocol.

It is **hosted-only** (as of v1.1.0). The shipped client is a thin forwarder: it reads `ATO_MCP_TOKEN` from the environment and forwards every tool call to `api.ato-mcp.com.au`, where the backend runs the shared tool code against Supabase Postgres + pgvector. There is no local corpus and no offline mode. The corpus is built and refreshed by a **private engine repository**; the hosted service is the only way to access it.

GitHub rulesets on this repo: `protect-main` (require PR + the `node` status check; block force-push/deletion on `main`; admin bypass), `protect-release-tags` (block deletion/update of `v*` tags).

## Product surfaces (the "listings")

- **npm:** **`ato-mcp`** (unscoped, public) — the MCP client. Install: `npx -y ato-mcp` with `ATO_MCP_TOKEN` in the AI client's MCP config `env`. `@ato-mcp/shared` is **not published** (dev-only dependency of the client, used by tests). Published from CI via **npm Trusted Publishing (OIDC)** — no stored token — on `v*` GitHub releases, gated by the `NPM_PUBLISH_ENABLED` repo variable. Provenance-signed.
- **Website:** `ato-mcp.com.au` (canonical) / `ato-mcp.com` (301 redirect) — Vercel project `ato-mcp-web`, root `packages/web`. Pages: `/` (landing), `/onboard` → `/onboard/verify` (magic link) → `/onboard/facts` (wizard) → `/onboard/install` (token + config snippet), `/account` (+ `/account/facts/edit`, `/account/delete`), `/docs`, `/privacy`, `/terms`. One Next.js API route: `/api/poll` (install-page connection detection).
- **Backend API:** `api.ato-mcp.com.au` — Vercel project `ato-mcp-backend`, root `packages/backend`. Bearer-token auth. Endpoints (the `/api` prefix is stripped by `vercel.json` rewrites): `api.ato-mcp.com.au/<tool>` for all 13 tools (one dispatcher), plus `/facts` (PUT) and `/usage_event` (POST). No `/v1/` versioning.
- **Database:** Supabase Postgres + pgvector, region `ap-southeast-2`. See "Database schema" below.
- **Vercel:** two projects (`ato-mcp-web`, `ato-mcp-backend`), both git-integrated (auto-deploy on push to `main`; PR previews). Node runtime only (not Edge — see Gotchas).

## The corpus

Sources: **ato.gov.au** website guidance, the **Income Tax Assessment Act 1997** (4,638 sections + 1,929 statutory definitions), and **ATO public rulings** (2,127 docs across 10 ruling series: TR, TD, GSTR, etc.). Roughly 29,861 docs / 209,588 chunks / 8 thresholds / 23,267 citation edges live in Supabase.

The corpus is **built, embedded, and refreshed by a private engine repository** — nothing in this repo builds or imports corpus data, and there is no public corpus download. Query-time embedding happens in the backend (`packages/backend/src/wasm-embedder.ts`); the query model is pinned to match the corpus embeddings — **do not change it in isolation**.

## The 13 MCP tools

Defined as schemas in `packages/mcp/src/server.ts` (`TOOLS`) and implemented in `packages/shared/src/tools/`. Same code runs server-side in the backend dispatcher.

**Retrieval (9):**
- `search` — hybrid BM25 + vector search; returns top-k chunks with `[doc:X]` citations.
- `get_chunks` — fetch chunk bodies by id, with optional neighbour context.
- `fetch` — live-fetch a document by URI. Schemes: `ato:`, `ato-law:`, `legis:`, `staterev-<juris>:`.
- `get_definition` — statutory definition, point-in-time aware.
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
│             No native runtime deps. Tests run against an in-memory Store fixture
│             (test/helpers/memory-store.ts).
├── backend/  @ato-mcp/backend — Vercel functions over Supabase. 3 serverless
│             functions; SupabaseStore + WasmEmbedder. Retrieval eval harness in eval/.
└── web/      @ato-mcp/web — Next.js 15 App Router site + onboarding + account.
              Magic-link auth via @supabase/ssr.
```

## Toolchain and versions

- **Node 22+** (Vercel deploys on 24).
- **pnpm 10.28.2** (pinned via `packageManager`; CI/Vercel auto-pick it).
- **TypeScript 5.6.3** (root devDep, inherited by workspaces).
- GitHub Actions are pinned to Node-24 majors: `actions/checkout@v6`, `actions/setup-node@v6`, `pnpm/action-setup@v6`.

`pnpm.onlyBuiltDependencies` (root `package.json`) whitelists `esbuild`, `onnxruntime-node`, `sharp` — pnpm 10 ignores postinstall builds by default; this opts them back in. `onnxruntime-node`/`sharp` are needed by the backend's transformers embedder + the web OG renderer. Don't remove entries without checking each consumer.

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
- `packages/backend/src/wasm-embedder.ts` — query embedding (lazy-loaded; mocked in tests via `MOCK_SUPABASE=1`).
- `packages/mcp/test/helpers/memory-store.ts` — MemoryStore, a **test-only** in-memory fixture for retrieval-tool integration tests (`packages/mcp/test/tools/*.test.ts`).

### Backend handler convention

All 13 tool endpoints are one dynamic dispatcher: `packages/backend/api/[tool].ts` — a `TOOLS` map of `name → runner`, a module-level `SupabaseStore`, a lazy `WasmEmbedder` (only for tools that embed), and a single `lookupUserFacts(userId)`. Unknown tool → 404; tool errors → 400 `{kind:"error", message}`. To add a tool: schema in shared, entry in the dispatcher map — do NOT add a new `api/*.ts` file (function count + bundle size regress).

Only non-tool endpoints get their own files: `facts.ts` (PUT user facts), `usage_event.ts` (POST analytics + connection ping). `_adapter.ts` wraps Web-Standard `(req: Request) => Response` handlers for Vercel's Node runtime; `_middleware.ts` does bearer-token auth (sha256 lookup in `bearer_tokens`) + rate limiting. Three serverless functions total.

## Database schema (Supabase)

**Corpus tables** (read-only at serve time):
- `docs`, `chunks` (with pgvector embeddings), `anchors`, `citations`, `definitions`, `thresholds`, `meta` (corpus version/build metadata).

**User / auth tables** (RLS-protected, per-user):
- `users`, `user_facts` (the 25-field tax profile), `bearer_tokens` (sha256 token hashes — the table API auth reads, written by the web `issueToken` action), `usage_events` (coarse analytics; never query text/results), `mcp_connections` (drives the install-page "connected" indicator via `last_seen_at`), `onboard_sessions` (vestigial — the CLI onboard-poll flow was removed).

**Migrations:** canonical migrations live in `/supabase/migrations/` (deployed by the Supabase GitHub integration — preview branch per PR, production on merge to `main`). `packages/backend/migrations/` holds the historical hand-applied files, retained for provenance only.

## Release & publish

- **Software releases:** cut a `v*` GitHub release → `npm-publish.yml` builds, tests, and publishes **`ato-mcp`** to npm via OIDC Trusted Publishing (no token), gated by `vars.NPM_PUBLISH_ENABLED == 'true'`. The package's Trusted Publisher is configured on npmjs.com (GitHub Actions → this repo → `npm-publish.yml`). `@ato-mcp/shared` is not published.
- **Corpus:** maintained privately; no public releases.
- CI (`ci.yml`): node-only (build + typecheck + test) on PRs and pushes to `main`.

## Gotchas

- **Vercel Node runtime ≠ Web Standard handlers.** Vercel auto-dispatches `(req, res)` Node-legacy; to write `(req: Request) => Response` you MUST go through `api/_adapter.ts`. Edge runtime would allow native Web Standard but breaks on `onnxruntime-node`/`sharp` (the backend's embedder chain).
- **Sharp native binary** is patched via `pnpm.patchedDependencies` in `pnpm-workspace.yaml` (`patches/sharp@0.32.6.patch`). Don't `pnpm install --force` without the patch — the `@xenova/transformers` import chain fails when sharp can't load on Node 23+.
- **pnpm filter on Vercel build.** Both `vercel.json` files use `pnpm install --filter "@ato-mcp/<x>..."` so deploys only install what each app needs. Don't drop the filter.
- **The query embedding model is pinned.** `wasm-embedder.ts` must embed queries with the same model family/dimensions as the corpus vectors in Supabase. Do not change the model here in isolation.
- **Web fonts are self-hosted.** Switzer woff2/otf live in `packages/web/app/fonts/` (Fontshare ITF FFL, see `FFL.txt`); the OTFs are only for the OG-image renderer.
