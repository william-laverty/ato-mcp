# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`ato-mcp` is a hosted MCP server for the Australian Taxation Office corpus. The client forwards every tool call to `api.ato-mcp.com.au` using a bearer token; the backend queries Supabase Postgres + pgvector. The corpus-building pipeline lives in the private `william-laverty/ato-mcp-engine` repo and auto-imports to Supabase monthly.

The MCP client is published as the unscoped `ato-mcp` npm package; the shared library is `@ato-mcp/shared`. Public-facing domain is **ato-mcp.com.au** (canonical) / **ato-mcp.com** (301 redirect).

## Monorepo layout (pnpm workspaces, pnpm@10.28.2)

```
packages/
├── shared/      TypeScript types + Zod schemas + Store/Embedder interfaces +
│                shared tool implementations (search, get_chunks, fetch, stats,
│                get_definition, get_doc, get_doc_anchors, get_threshold,
│                get_user_facts) + ANZSIC code list + UserFactsSchema.
│                Consumed by mcp, backend, and web.
├── mcp/         Hosted MCP client (Node 22+). RemoteToolForwarder forwards every
│                tool call to api.ato-mcp.com.au using ATO_MCP_TOKEN.
│                Published as unscoped `ato-mcp`. SqliteStore lives in
│                test/helpers/ as a test-only fixture.
├── backend/     Vercel functions (api/*.ts) over Supabase Postgres. Each
│                handler is `Web Standard Request → Response`, wrapped by
│                api/_adapter.ts to expose Node-style (req, res) defaults.
│                Migrations live under migrations/ as raw SQL.
└── web/         Next.js 15 App Router. /onboard wizard, /account dashboard,
                 schema-driven /privacy + /terms. Magic-link auth via
                 @supabase/ssr.
```

The Python corpus-building pipeline (`packages/pipeline` in the v1.0 tree) now lives in the
private `william-laverty/ato-mcp-engine` repo. It builds the corpus and imports it to Supabase
via a monthly GitHub Actions workflow.

## Toolchain and versions

- **Node 22+** (Vercel deploys on 24; better-sqlite3 lacks prebuilts → see Gotchas)
- **pnpm 10.28.2** (pinned via `packageManager`; CI/Vercel auto-pick this version)
- **TypeScript 5.6.3** (root devDep, inherited by workspaces)

Python/uv is used only in the private `ato-mcp-engine` repo (corpus pipeline).

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
pnpm --filter ato-mcp build                      # mcp tsc + emit dist/

# MCP client CLI (after building mcp)
node packages/mcp/bin/ato-mcp.js mcp         # start stdio server (requires ATO_MCP_TOKEN)
node packages/mcp/bin/ato-mcp.js help        # usage

# Corpus refreshes happen in the private ato-mcp-engine repo, not here.
```

## Architecture: how the pieces fit

```
┌────────────────────────────────────────────────────────────────┐
│  Claude Code / any MCP host                                    │
└────────────┬───────────────────────────────────────────────────┘
             │ stdio MCP protocol
             ▼
┌────────────────────────────────────────────────────────────────┐
│  packages/mcp (Node CLI: ato-mcp)                              │
│                                                                │
│  reads ATO_MCP_TOKEN from env                                  │
│                                                                │
│  RemoteToolForwarder(api.ato-mcp.com.au, bearer_token)         │
│  forwards each tool call by name to the backend dispatcher     │
└────────────────────────────────────────────────────────────────┘

Hosted path:

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

Every retrieval tool (search/get_chunks/stats/get_definition/get_doc/get_doc_anchors/get_threshold/fetch) lives in `packages/shared/src/tools/`. Each is a pure function `(deps: { store, embedder }, args) => result`. The hosted backend uses these tools directly. The `Store` and `Embedder` interfaces (`packages/shared/src/store/types.ts`, `embed/types.ts`) are the contract — implement them and the tools work.

Adapters:

- `packages/mcp/src/lib/remote-tools.ts` — HTTP tool forwarder (the shipped client)
- `packages/mcp/test/helpers/sqlite-store.ts` — SqliteStore (test-only fixture for retrieval-tool integration tests)
- `packages/backend/src/supabase-store.ts` — Supabase RPC calls

### Backend handler convention

All 13 tool endpoints are served by **one dynamic dispatcher**: `packages/backend/api/[tool].ts`.
It mirrors `packages/mcp/src/server.ts` dispatch — a `TOOLS` map of `name → runner`, with a
module-level `SupabaseStore`, a lazy `WasmEmbedder` (loaded only for tools that embed), and a
single `lookupUserFacts(userId)` for facts-dependent tools. Unknown tool → 404; tool errors → 400
`{kind:"error", message}`. To add a tool: schema in shared, entry in the dispatcher's map — do NOT
create a new `api/*.ts` file (function-count and bundle-size both regress).

Only non-tool endpoints have their own files: `facts.ts` (PUT), `usage_event.ts`.
All handlers are written Web-Standard `(req: Request) => Response` and wrapped by `api/_adapter.ts`
for Vercel's Node runtime. Do not use the Edge runtime — sharp/onnxruntime-node aren't compatible.

### URLs (Vercel `rewrites` in `packages/backend/vercel.json`)

Public URLs strip the `/api` prefix:

- `api.ato-mcp.com.au/<tool>` → `api/[tool].ts` (all 13 tools)
- `api.ato-mcp.com.au/facts|usage_event` → their own handlers

There is **no `/v1/` versioning** — don't reintroduce versioned paths.

## Implementation status

- v0.1: monorepo, ATO sitemap scrape, sqlite-vec corpus, MCP `search`/`get_chunks`/`fetch`/`stats`
- v0.2: ITAA 1997 EPUB ingest (4,638 sections + 1,929 statutory definitions), 8 threshold extractors, law.ato.gov.au public rulings (2,127 docs across 10 ruling series), GitHub release flow
- v0.3: shared-core refactor, UserFactsSchema (25 fields, ABN checksum, ANZSIC validation) + `get_user_facts`, Next.js web app + onboarding, Vercel functions + SupabaseStore + 4 SQL migrations, live deployment
- v0.4: four workflow tools — `deduction_discovery` (59-category cited taxonomy), `depreciation_helper` (deterministic PC/DV/IAWO/SBE-pool/Div 43 schedules), `bas_prep_checklist` (tiered, cited), `audit_risk_check` (~13 red-flag rules with risk bands). All reuse the `resolveCitations()` spine (`packages/shared/src/lib/citations.ts`) and are registered in `packages/mcp/src/server.ts` + the backend dispatcher.
- v1.0: public launch — backend consolidated to 4 serverless functions, citation graph populated (23,267 edges), authenticated production smoke green
- 2026-06: website redesigned to the "Clinical" design system (Switzer + Geist Mono, zinc + vermillion accent, fully light)
- v1.1: hosted-only client — dropped SQLite/ONNX runtime, `ato-mcp` now a pure `ATO_MCP_TOKEN` forwarder; corpus gated (no public download); pipeline + importer split to private `ato-mcp-engine` repo; backend reduced to 3 serverless functions

### Not yet implemented (v0.5 and beyond)

- Edited PBR ingest (~120k more docs from law.ato.gov.au — would 5× the corpus)
- AAT/Federal Court case summaries
- State revenue offices (8 jurisdictions)
- WordNet ordinary-meaning fallback for `get_definition`
- Per-ANZSIC/occupation numeric benchmarking (needs a `benchmarks` table)
- **Better embedding model than MiniLM-L6-v2.** Granite r2 small (ModernBERT) was attempted and reverted — the only transformers.js release with ModernBERT support (`@huggingface/transformers` v3+) bundles onnxruntime-node with too many platform binaries to fit under Vercel's 250MB function size limit. Architectural options: (a) external embedding API so the function bundle stays small, (b) bundle slimming via tight excludeFiles + only the linux/x64 onnxruntime binary, (c) move inference off Vercel functions to a host with a larger size budget.

## Gotchas

- **Sharp native binary** is patched via `pnpm.patchedDependencies` in `pnpm-workspace.yaml`. Don't `pnpm install --force` without the patch applied — the @xenova/transformers import chain fails when sharp's native binding can't load on Node 23+. The patch is `patches/sharp@0.32.6.patch`.
- **Vercel Node runtime ≠ Web Standard handlers.** Vercel auto-dispatches `(req, res)` Node-legacy. To write `(req: Request) => Response`, you MUST go through `api/_adapter.ts`. Edge runtime would allow native Web Standard but transitively breaks on sharp/onnxruntime-node.
- **pnpm filter on Vercel build.** Both `vercel.json` files use `pnpm install --filter "@ato-mcp/<x>..."` so deploys don't compile better-sqlite3 (it lives in `ato-mcp`'s devDeps as a test fixture, isn't needed by web/backend). Don't drop the filter.
- **Tests must run with native bindings built.** If `pnpm install` skipped postinstalls, tests that use `SqliteStore` fail with "Could not locate the bindings file". Run `pnpm rebuild better-sqlite3` once (the `onlyBuiltDependencies` whitelist is already configured).
- **Supabase Edge / Web Runtime conflicts.** The `@xenova/transformers` 2.x release used in the backend transitively pulls `onnxruntime-node` and `sharp`. Neither is Edge-compatible. Stay on Node runtime via `_adapter.ts`.
- **Corpus importer lives in the private engine repo.** The one-shot `import-corpus.ts` script (previously at `packages/mcp/scripts/import-corpus.ts`) is now maintained in `william-laverty/ato-mcp-engine`. To trigger a corpus refresh, use `workflow_dispatch` on the engine repo's `corpus-build` workflow.
- **Web fonts are self-hosted.** Switzer woff2/otf files live in `packages/web/app/fonts/` (Fontshare ITF Free Font License, see `FFL.txt`); the OTFs exist only for the OG-image renderer.
