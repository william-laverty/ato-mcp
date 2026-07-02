# @ato-mcp/backend

Vercel serverless functions for the ato-mcp hosted backend (`api.ato-mcp.com.au`).

## Structure

```
packages/backend/
  api/
    _adapter.ts             # Wraps Web-Standard handlers for Vercel's Node runtime
    _middleware.ts          # Bearer-token auth + rate limiting
    [tool].ts               # Dynamic dispatcher for all 13 MCP tools
    facts.ts                # PUT — save user facts (web app)
    usage_event.ts          # POST — coarse analytics + connection ping
  src/
    supabase.ts             # makeServiceClient() with mock fallback
    supabase-store.ts       # SupabaseStore implementing the Store interface
    wasm-embedder.ts        # Query embedding for the Vercel runtime
  eval/                     # Retrieval eval harness (golden queries + metrics)
  test/                     # Unit + handler tests (mock mode)
```

All 13 tool endpoints are served by the single `api/[tool].ts` dispatcher — to add a
tool, add a dispatch entry there (do **not** add a new `api/*.ts` file).

## Local development

```bash
pnpm install
pnpm --filter @ato-mcp/backend test        # uses MOCK_SUPABASE=1 automatically
pnpm --filter @ato-mcp/backend typecheck
pnpm --filter @ato-mcp/backend build
```

## Mock mode

Set `MOCK_SUPABASE=1` (or leave `SUPABASE_URL` unset) to run in mock mode:

- `makeServiceClient()` returns a chainable mock that returns empty arrays / null
- Auth middleware accepts any token prefixed `atompro_v1_` as user `u_mock`
- All tests run in this mode by default

## Deployment

Deployed via the Vercel git integration (auto-deploy on push to `main`, PR previews).
Database migrations live under `/supabase/migrations/` and are deployed by the
Supabase GitHub integration.
