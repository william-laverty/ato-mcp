# Self-hosting the hosted mode

Local mode needs no infrastructure — this guide is for running your own *hosted* stack
(your own Supabase + Vercel) instead of api.ato-mcp.com.au.

## You need
- A Supabase project (pgvector enabled) — free tier works for one user
- A Vercel account (the backend ships 4 serverless functions)
- A built corpus (`ato.sqlite`) — `ato-mcp update` then use `~/Library/Application
  Support/ato-mcp/live/ato.sqlite`, or build via `packages/pipeline`

## Steps

1. **Migrations** — run `packages/backend/migrations/0001..0004` in order against your
   Supabase database (SQL editor or psql). 0001 creates the corpus schema, 0002 users,
   0003 the search RPCs, 0004 row-level security.
2. **Import the corpus**:
   ```bash
   SUPABASE_URL='https://<ref>.supabase.co' \
   SUPABASE_SECRET_KEY='sb_secret_...' \
     pnpm --filter @ato-mcp/mcp exec tsx scripts/import-corpus.ts
   ```
3. **Deploy `packages/backend` to Vercel** — root directory `packages/backend`, env vars
   `SUPABASE_URL` + `SUPABASE_SECRET_KEY`. The repo's `vercel.json` handles install/build
   and URL rewrites.
4. **Deploy `packages/web`** similarly (root `packages/web`) if you want the onboarding UI —
   env vars are listed in `packages/web/.env.local.example` (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`). Otherwise insert a user +
   sha256 token hash into `users`/`bearer_tokens` directly.
5. **Point the client at your stack** — in `~/.ato-mcp/config.json` set `mode: "hosted"`,
   `api_endpoint: "https://your-api.example.com"`, `bearer_token: "..."`.
