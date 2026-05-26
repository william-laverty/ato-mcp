# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`ato-mcp` is a local-first MCP server for the Australian Taxation Office corpus. It scrapes ATO website + ITAA 1997 legislation + ATO public rulings, embeds + indexes them, and exposes search/retrieval tools to AI agents over the MCP stdio protocol. The hosted variant runs the same tool code on Vercel functions against Supabase Postgres + pgvector.

Working name in the repo is `@ato-mcp/*` for npm package scopes. Public-facing domain is **ato-mcp.com.au** (canonical) / **ato-mcp.com** (301 redirect). The two are wired up in the Vercel `ato-mcp-web` project.

Always read these before making structural decisions:

- `HANDOFF.md` — running log of what's done, what's broken, what's deferred. Update it when finishing a phase.
- `RUNBOOK.md` — deployment steps for the user (Supabase / Vercel setup).
- `docs/superpowers/specs/` — design docs per phase (v0.1, v0.2, v0.3). The v0.2/v0.3 specs are the source of truth for non-goals as well as goals.
- `docs/superpowers/plans/` — implementation plans per phase.

## Monorepo layout (pnpm workspaces, pnpm@10.28.2)

```
packages/
├── shared/      TypeScript types + Zod schemas + Store/Embedder interfaces +
│                shared tool implementations (search, get_chunks, fetch, stats,
│                get_definition, get_doc, get_doc_anchors, get_threshold,
│                get_user_facts) + ANZSIC code list + UserFactsSchema.
│                Consumed by mcp, backend, and web.
├── mcp/         Local MCP server (Node 22+). SqliteStore + OnnxEmbedder for
│                local mode, RemoteStore for hosted mode. CLI dispatcher
│                (`ato-mcp <subcommand>`). Hosts the import-corpus script
│                under scripts/import-corpus.ts.
├── pipeline/    Python (uv-managed) corpus builder. Sources: ato.gov.au
│                sitemap, legislation.gov.au EPUB compilations, law.ato.gov.au
│                public rulings via the browse API. Produces SQLite + FTS5 +
│                sqlite-vec. Tested with pytest; `uv run pytest` from
│                packages/pipeline/.
├── backend/     Vercel functions (api/*.ts) over Supabase Postgres. Each
│                handler is `Web Standard Request → Response`, wrapped by
│                api/_adapter.ts to expose Node-style (req, res) defaults.
│                Migrations live under migrations/ as raw SQL.
└── web/         Next.js 15 App Router. /onboard wizard, /account dashboard,
                 schema-driven /privacy + /terms. Magic-link auth via
                 @supabase/ssr.
```

## Toolchain and versions

- **Node 22+** (Vercel deploys on 24; better-sqlite3 lacks prebuilts → see "Native deps")
- **pnpm 10.28.2** (pinned via `packageManager`; CI/Vercel auto-pick this version)
- **Python 3.12+** with **uv** for the pipeline package
- **TypeScript 5.6.3** (root devDep, inherited by workspaces)

`pnpm.onlyBuiltDependencies` in root package.json whitelists `better-sqlite3`, `esbuild`, `onnxruntime-node`, `sharp` — pnpm 10 ignores postinstall scripts by default; this list opts them back in. Don't remove these entries without checking each consumer.

## Common commands

```bash
# From repo root
pnpm install                                    # workspaces
pnpm -r build                                    # all packages
pnpm -r typecheck                                # all packages
pnpm -r test                                     # all TS tests
pnpm test:smoke                                  # end-to-end smoke (scripts/smoke.sh)

# Per-workspace
pnpm --filter @ato-mcp/shared test               # shared tests only
pnpm --filter @ato-mcp/web dev                   # Next.js dev on :3001
pnpm --filter @ato-mcp/backend build             # backend tsc
pnpm --filter @ato-mcp/mcp build                 # mcp tsc + emit dist/

# Python pipeline
cd packages/pipeline
uv sync                                          # install deps
uv run pytest -k "not slow"                      # fast tests
uv run ato-pipeline build --out-dir corpus-out --sources ato_website,legislation,thresholds,law_ato

# MCP local CLI (after building mcp)
node packages/mcp/bin/ato-mcp.js stats       # current installed corpus
node packages/mcp/bin/ato-mcp.js update <path-to-ato.sqlite>
node packages/mcp/bin/ato-mcp.js mcp         # start stdio server (Claude Code uses this)

# One-shot corpus import to Supabase (requires env vars)
SUPABASE_URL='https://<ref>.supabase.co' \
SUPABASE_SECRET_KEY='sb_secret_...' \
  pnpm --filter @ato-mcp/mcp exec tsx scripts/import-corpus.ts
```

## Current deployment state

| Where | What | Status |
|---|---|---|
| GitHub | `william-laverty/ato-mcp` (private) | live |
| Supabase | project `ato-mcp` (`pznbngklxhkyigmlvruk`), ap-southeast-2 | live; 4 migrations applied; pgvector enabled |
| Vercel `ato-mcp-web` | Next.js app, root `packages/web` | live at `ato-mcp.com.au` (canonical) |
| Vercel `ato-mcp-backend` | Functions, root `packages/backend` | live at `api.ato-mcp.com.au` |
| Local corpus | `~/Library/Application Support/ato-mcp/live/ato.sqlite` | 29,180 docs / 224k chunks |
| Supabase corpus | `docs` + `chunks` + `anchors` + `definitions` + `thresholds` tables | 29k docs / chunks ongoing (import script) |

The Supabase team ID for the Vercel MCP is `team_UWCodSopgUHNhnJCAGNsJ1uA`. Project IDs: `prj_xREEymkcKg1VwkgvoTXbQjYJIjHt` (web), `prj_ok6AxQ6e1iH8NtV33zpgGoNiYh1t` (backend).

## MCP servers available

Both Supabase and Vercel MCPs are connected to this Claude Code session. Use them directly instead of asking the user to run dashboards.

- **Supabase MCP** (`mcp__plugin_supabase_supabase__*`): `list_projects`, `list_tables`, `list_extensions`, `execute_sql` (DML — for iteration), `apply_migration` (DDL — writes migration history), `get_advisors`, `get_publishable_keys`, `get_project_url`. Project ID: `pznbngklxhkyigmlvruk`. Service role / secret key is NOT exposed via MCP; the user must paste it or run the import locally.
- **Vercel MCP** (`mcp__plugin_vercel_vercel__*`): `list_projects`, `list_deployments`, `get_deployment`, `get_deployment_build_logs`, `get_runtime_logs`, `get_project`. Use `get_runtime_logs` with `level=["error","fatal"]` to debug live function crashes.

## Architecture: how the pieces fit

```
┌────────────────────────────────────────────────────────────────┐
│  Claude Code / any MCP host                                    │
└────────────┬───────────────────────────────────────────────────┘
             │ stdio MCP protocol
             ▼
┌────────────────────────────────────────────────────────────────┐
│  packages/mcp (Node CLI: ato-mcp)                          │
│                                                                │
│  reads ~/.ato-mcp/config.json → { mode, ... }                  │
│                                                                │
│  if mode === "local":                                          │
│    SqliteStore(~/.ato-mcp/live/ato.sqlite)                     │
│    + OnnxEmbedder (Granite/MiniLM via @xenova/transformers)    │
│    + tools from @ato-mcp/shared/tools                          │
│                                                                │
│  if mode === "hosted":                                         │
│    RemoteStore(api.ato-mcp.com.au, bearer_token)               │
│    forwards each Store call to backend (CURRENTLY BROKEN —     │
│    path/name mismatch; see KNOWN ISSUES)                       │
└────────────────────────────────────────────────────────────────┘

Hosted path (the path RemoteStore should be talking to):

  ato-mcp.com.au         api.ato-mcp.com.au               Supabase
       (Next.js)              (Vercel functions)          (Postgres+pgvector)
        │                      │                              │
        │ magic-link auth      │ Bearer tokens                │
        ▼                      ▼                              ▼
  /onboard wizard       /search /stats /get_chunks /...  docs, chunks,
  /account dashboard    Each handler is Web Standard      user_facts,
  /privacy /terms       (req: Request) wrapped by         bearer_tokens,
                        api/_adapter.ts for Vercel        usage_events
                        Node runtime.                     (RLS-protected
                                                          per-user tables)
```

### Shared tool core

Every retrieval tool (search/get_chunks/stats/get_definition/get_doc/get_doc_anchors/get_threshold/fetch) lives in `packages/shared/src/tools/`. Each is a pure function `(deps: { store, embedder }, args) => result`. Both the local MCP and the hosted backend use the same code. The `Store` and `Embedder` interfaces (`packages/shared/src/store/types.ts`, `embed/types.ts`) are the contract — implement them and the tools work.

Adapters:

- `packages/mcp/src/store/sqlite.ts` — local SQLite + sqlite-vec
- `packages/mcp/src/store/remote.ts` — HTTP forwarder for hosted mode (needs refactor; see KNOWN ISSUES)
- `packages/backend/src/supabase-store.ts` — Supabase RPC calls

### Backend handler convention

Every `packages/backend/api/*.ts` follows this shape:

```ts
import { adapt } from "./_adapter.js";
import { authMiddleware } from "./_middleware.js";
import { someTool } from "@ato-mcp/shared/tools/some_tool";
import { SupabaseStore } from "../src/supabase-store.js";

const store = new SupabaseStore();

async function handler(req: Request): Promise<Response> {
  const auth = await authMiddleware(req);
  if (auth instanceof Response) return auth;
  try {
    const args = SomeInputSchema.parse(await req.json());
    return Response.json(await someTool({ store }, args));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ kind: "error", message: msg }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}

export default adapt(handler);
```

The `adapt()` wrapper exists because Vercel's Node runtime defaults to legacy `(req, res)` style; the adapter converts to/from Web Standard. Do not try to use `export const config = { runtime: 'edge' }` — Edge can't bundle our transitive sharp/onnxruntime-node deps.

### URLs (Vercel `rewrites` in `packages/backend/vercel.json`)

Public URLs strip the `/api` prefix:

- `api.ato-mcp.com.au/stats` → `api/stats.ts`
- `api.ato-mcp.com.au/search` → `api/search.ts`
- etc.

There is **no `/v1/` versioning** — the spec was updated to drop it. Don't reintroduce versioned paths.

## Implementation status

### Done (v0.1 → v0.3 Phases A–D)

- v0.1 scaffolding: monorepo, ATO sitemap scrape, sqlite-vec corpus, MCP `search`/`get_chunks`/`fetch`/`stats`
- v0.2 wider corpus: ITAA 1997 EPUB ingest (4638 sections + 1929 statutory definitions), 8 threshold extractors, law.ato.gov.au public rulings (2127 docs across 10 ruling types), GitHub release flow scaffolding
- v0.3 Phase A: shared-core refactor (tools moved out of mcp into shared, Store/Embedder interfaces)
- v0.3 Phase B: UserFactsSchema (25 fields, ABN checksum, ANZSIC validation), `get_user_facts` tool, bundled ANZSIC list
- v0.3 Phase C: Next.js web app, 5-step onboarding flow, schema-driven privacy page, `ato-mcp onboard` CLI
- v0.3 Phase D: Vercel functions (12 handlers), SupabaseStore, 4 SQL migrations (corpus, users, RPC functions, RLS), Web→Node adapter
- Live deployment: web + backend on Vercel, Supabase project with corpus + RLS, real bearer-token auth works end-to-end (verified via `curl /stats`)

### Known issues — fix these before claiming v0.3 done

1. ~~RemoteStore endpoint name mismatch~~ — fixed. `packages/mcp/src/lib/remote-tools.ts` (RemoteToolForwarder) now forwards tool calls (not Store calls) to backend endpoints. Verified end-to-end.
2. ~~Vector / hybrid search on the backend is untested~~ — fixed. WasmEmbedder writes to `/tmp/transformers-cache` (Vercel's only writable dir) so the model download succeeds, and the silent `!SUPABASE_URL` mock fallback was removed (only `MOCK_SUPABASE=1` triggers the stub now). Pure-vector mode returns ~0.99 cosine matches in production.
3. ~~Definitions reference non-existent dictionary doc~~ — fixed. `_extract_definitions` in the legislation pipeline now emits a synthetic parent Doc for `legis:{series}/dictionary`, and a regression test asserts every definition references an emitted doc. A one-off SQL insert handled the in-flight Supabase corpus.
4. ~~Backend handler unit tests reference old `api/v1/` paths~~ — fixed. URL paths stripped of `/v1/` prefix in `packages/backend/test/handlers.test.ts`; 40/40 tests pass.
5. **Schema-version label in Supabase `meta` table is `0.3.0`; local SQLite says `0.1.0`.** Cosmetic; the migration sets it on Supabase but the pipeline CLI hard-codes the old value when packaging.
6. **3 of 8 threshold extractors fail against live ATO pages.** Pattern adjustments needed; deferred.

### Not yet implemented (v0.4 and beyond)

- Hero workflow tools: `deduction_discovery`, `bas_prep_checklist`, `audit_risk_check`, `depreciation_helper` (the product differentiator from `gunba/ato-mcp`)
- Edited PBR ingest (~120k more docs from law.ato.gov.au — would 5× the corpus)
- Granite embedding swap (still on MiniLM-L6-v2; quality is acceptable but Granite likely better for legal-domain queries)
- AAT/Federal Court case summaries
- State revenue offices (8 jurisdictions)
- Citation graph extraction (`citations` table is created but unpopulated)
- WordNet ordinary-meaning fallback for `get_definition`
- Real RLS verification test in CI

## Gotchas

- **Sharp native binary** is patched via `pnpm.patchedDependencies` in `pnpm-workspace.yaml`. Don't `pnpm install --force` without the patch applied — the @xenova/transformers import chain fails when sharp's native binding can't load on Node 23+. The patch is `patches/sharp@0.32.6.patch`.
- **Vercel Node runtime ≠ Web Standard handlers.** Vercel auto-dispatches `(req, res)` Node-legacy. To write `(req: Request) => Response`, you MUST go through `api/_adapter.ts`. Edge runtime would allow native Web Standard but transitively breaks on sharp/onnxruntime-node.
- **pnpm filter on Vercel build.** Both `vercel.json` files use `pnpm install --filter "@ato-mcp/<x>..."` so deploys don't compile better-sqlite3 (it lives in @ato-mcp/mcp's deps, isn't needed by web/backend). Don't drop the filter.
- **Typer CLI quirk in the Python pipeline.** A single-command Typer app accepts options directly: `uv run ato-pipeline build --out-dir ...` works, but multi-command apps (after Phase E added `package` subcommand) require the subcommand name. The current CLI requires `build` as the first arg.
- **The corpus is large.** Building locally takes ~45 min (scrape + embed + package) and produces a ~1 GB SQLite. Don't try to commit it; `*.sqlite` and `*.jsonl` are gitignored.
- **Tests must run with native bindings built.** If `pnpm install` skipped postinstalls (e.g. dry-run mode), tests that use `SqliteStore` will fail with "Could not locate the bindings file". Run `pnpm rebuild better-sqlite3` once or use the `onlyBuiltDependencies` whitelist (already configured).
- **Supabase Edge / Web Runtime conflicts.** The `@xenova/transformers` 2.x release used in the backend transitively pulls `onnxruntime-node` and `sharp`. Neither is Edge-compatible. Stay on Node runtime via `_adapter.ts`.

## When debugging deploys

1. `mcp__plugin_vercel_vercel__list_deployments` for the project — get the latest `id`
2. `get_deployment` to confirm `state` (BUILDING → READY → ERROR)
3. `get_deployment_build_logs` if ERROR
4. `get_runtime_logs` with `level=["error","fatal"]` and a recent `since` window if the function is deployed but crashing at runtime
5. The build logs are huge; use `limit: 20` first and scan for `##[error]` markers
