# @ato-pro/backend

Vercel serverless functions for the ATO-Pro hosted backend (`api.ato-mcp.com`).

## Structure

```
packages/backend/
  api/
    _middleware.ts          # Auth + rate-limit
    v1/
      stats.ts
      search.ts
      get_chunks.ts
      fetch.ts
      get_definition.ts
      get_doc.ts
      get_doc_anchors.ts
      get_threshold.ts
      get_user_facts.ts
      facts.ts              # PUT — save user facts (web app)
      usage_event.ts        # POST — analytics ingest
    onboard/
      poll.ts               # GET — CLI onboard handshake
  src/
    supabase.ts             # makeServiceClient() with mock fallback
    supabase-store.ts       # SupabaseStore implementing Store interface
    wasm-embedder.ts        # WasmEmbedder for Vercel runtime
  migrations/
    0001_corpus_schema.sql  # docs, chunks, anchors, citations, definitions, thresholds
    0002_user_schema.sql    # users, user_facts, bearer_tokens, usage_events, onboard_sessions
    0003_rpc_functions.sql  # ato_keyword_search, ato_vector_search, etc.
    0004_rls.sql            # Row-Level Security policies
  test/
    supabase-store.test.ts  # unit tests against mock Supabase client
    middleware.test.ts      # auth middleware unit tests
    handlers.test.ts        # handler integration tests (mock mode)
```

## Local development

```bash
# Install dependencies
pnpm install

# Run tests (uses MOCK_SUPABASE=1 automatically — no real DB needed)
pnpm --filter @ato-pro/backend test

# Type-check
pnpm --filter @ato-pro/backend typecheck

# Build
pnpm --filter @ato-pro/backend build
```

## Deploying to Vercel

1. Create a Supabase project at supabase.com
2. Run migrations in order:
   ```bash
   psql "$SUPABASE_DB_URL" < packages/backend/migrations/0001_corpus_schema.sql
   psql "$SUPABASE_DB_URL" < packages/backend/migrations/0002_user_schema.sql
   psql "$SUPABASE_DB_URL" < packages/backend/migrations/0003_rpc_functions.sql
   psql "$SUPABASE_DB_URL" < packages/backend/migrations/0004_rls.sql
   ```
3. Import the corpus (run the pipeline and import script)
4. Set environment variables in Vercel:
   - `SUPABASE_URL` — your project URL (e.g. `https://xxxx.supabase.co`)
   - `SUPABASE_SECRET_KEY` — Supabase secret key (`sb_secret_...`, replaces legacy service_role; never expose to client)
   - `ATO_PRO_API_ENDPOINT` — this function's own URL (e.g. `https://api.ato-mcp.com`)
5. Deploy: `vercel --cwd packages/backend`

## Mock mode

Set `MOCK_SUPABASE=1` (or leave `SUPABASE_URL` unset) to run in mock mode.
- `makeServiceClient()` returns a chainable mock that returns empty arrays / null
- Auth middleware accepts any token prefixed `atompro_v1_` as user `u_mock`
- All tests run in this mode by default

## Rate limiting

Currently in-memory (per-function-instance). TODO: swap `checkRateLimit` in
`api/_middleware.ts` to use Vercel KV once credentials are available. The
in-memory version is fine for development and testing.
