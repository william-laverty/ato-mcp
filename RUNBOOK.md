# Runbook — getting v0.3 deployed

GitHub repo is live at **https://github.com/william-laverty/ato-mcp** (private). Code is pushed, CI workflows in place. Follow the steps in order; **stop at the "Hand back to Claude" line** and let me take over the second half.

Estimated time: 30–45 minutes of your time.

---

## Part 1 — your hands (≈30 min)

### 1. Confirm the GitHub repo

Visit https://github.com/william-laverty/ato-mcp. Confirm it's private and the latest commit is the v0.3 HANDOFF.

CI should already be running on the most recent push — check the **Actions** tab. The first run will fail (pnpm version mismatch); the **second** run after the CI bump should pass. I'll verify this myself in a moment, but it'll be visible to you too.

### 2. Create the Supabase project (≈5 min)

1. Go to https://supabase.com/dashboard → **New project**
2. **Name**: `ato-mcp`
3. **Database password**: generate one and save it in your password manager. You'll need it for the migrations.
4. **Region**: `Australia (Sydney) — ap-southeast-2` (closest to the audience)
5. **Pricing plan**: Free is fine for v0.3 (500 MB database is enough for facts + ~30k chunks of metadata, though we'll need to be conservative about embedding storage)
6. Click **Create new project** and wait ~2 minutes for provisioning

### 3. Capture the Supabase credentials

Supabase has moved off the legacy `anon` / `service_role` JWT keys to a new key system. We use the **new** keys:

Once the project is provisioned, go to **Project Settings → API Keys**:

- **Project URL** — `https://<ref>.supabase.co` (Settings → Data API)
- **Publishable key** — starts with `sb_publishable_...`. Safe to expose to the browser; replaces the legacy `anon` key.
- **Secret key** — starts with `sb_secret_...`. Server-side only; bypasses RLS; replaces the legacy `service_role` key. Treat like a password.

Save all three somewhere temporary. You'll paste them into Vercel env vars in step 5.

(Optional — only if you'd rather run migrations locally: **Project Settings → Database → Connection string → URI**. We don't need this; I'll run migrations via the Supabase MCP from this Claude session.)

### 4. Connect the Supabase MCP to this session

I see you have the Vercel MCP connected (just confirmed). For Supabase:

1. Go to https://supabase.com/dashboard/account/tokens → **Generate new token**, name it "Claude Code MCP"
2. In Claude Code: `/mcp` → **Add MCP server** → pick **Supabase** from the menu
3. Paste the token + project ref when prompted
4. You should see "Authentication successful. Connected to plugin:supabase:supabase" in the chat

Once connected, **I can run the SQL migrations for you** in the next phase. You don't need to install psql or run them yourself.

### 5. Create the two Vercel projects

**Both projects import the same GitHub repo** (`william-laverty/ato-mcp`). Vercel supports this monorepo pattern natively — what makes them different is the **Root Directory** setting. Do NOT create blank projects.

1. Go to https://vercel.com/new
2. Click **Import Git Repository** and pick `william-laverty/ato-mcp`
3. **First project — the web app**:
   - **Project name**: `ato-mcp-web`
   - **Root directory**: `packages/web` (this is the key setting — Vercel will only watch this subtree)
   - **Framework preset**: Next.js (auto-detected once root dir is set)
   - **Build command**: `cd ../.. && pnpm install && pnpm --filter @ato-pro/web build`
   - **Output directory**: `.next` (default)
   - **Install command**: leave blank (the build command handles it)
   - **Environment variables** — add these from step 3:
     - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
     - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = your publishable key (starts with `sb_publishable_`)
     - `SUPABASE_URL` = same as `NEXT_PUBLIC_SUPABASE_URL`
     - `SUPABASE_SECRET_KEY` = your secret key (starts with `sb_secret_`)
     - `NEXT_PUBLIC_WEB_URL` = leave blank for now; we'll set after domain wiring
     - `NEXT_PUBLIC_API_URL` = leave blank for now
   - Click **Deploy**. First deploy will succeed using mocked data; we'll switch over to real Supabase after migrations.

4. **Second project — the backend**:
   - Go to https://vercel.com/new again and import the **same** repo (`william-laverty/ato-mcp`)
   - **Project name**: `ato-mcp-backend`
   - **Root directory**: `packages/backend`
   - **Framework preset**: Other (no framework — just functions)
   - **Build command**: `cd ../.. && pnpm install && pnpm --filter @ato-pro/backend build`
   - **Environment variables** (same as above except no `NEXT_PUBLIC_*`):
     - `SUPABASE_URL` = your Project URL
     - `SUPABASE_SECRET_KEY` = your secret key
   - Click **Deploy**.

Vercel will now auto-deploy both projects on every push to `main`. Pushes that only touch `packages/web/` won't redeploy the backend (and vice versa) — Vercel's Ignored Build Step detects per-root changes.

### 6. Connect your domains (≈3 min)

You own `ato-mcp.com.au` (canonical) and `ato-mcp.com` (alias). The canonical site lives at `ato-mcp.com.au`; `.com` 301-redirects to `.com.au`.

In Vercel:

1. `ato-mcp-web` project → **Settings → Domains** → add `ato-mcp.com.au` and `www.ato-mcp.com.au` as the primary. Add `ato-mcp.com` and `www.ato-mcp.com` as **redirect domains** pointing to `https://ato-mcp.com.au`. Vercel will show DNS records to add at each registrar.
2. `ato-mcp-backend` project → **Settings → Domains** → add `api.ato-mcp.com.au`.
3. At your domain registrar(s), point the records as Vercel instructs. Apex A record + www CNAME for both main sites; CNAME for api.

DNS propagation takes 5–60 minutes. Don't wait — proceed to step 7 in parallel.

### 7. Hand back to Claude

In Claude Code, paste:

> Supabase MCP is connected. Vercel projects are created at ato-mcp-web and ato-mcp-backend. Domains are wired up (or in progress). Take over from here.

Include the four credentials from step 3 in your message so I can verify connectivity if needed (or trust that the MCP can read them from the connected Supabase session).

---

## Part 2 — what I'll do once you hand back

Don't read this section while you're doing Part 1 — it'll be in the next conversation turn. Listed here so you know what to expect:

1. Run the four SQL migrations against your Supabase database via the Supabase MCP:
   - `0001_corpus_schema.sql` — corpus tables (docs, chunks with pgvector, anchors, citations, definitions, thresholds)
   - `0002_user_schema.sql` — users, user_facts, bearer_tokens, usage_events, onboard_sessions, mcp_connections
   - `0003_rpc_functions.sql` — hybrid search RPCs
   - `0004_rls.sql` — row-level security policies
2. Enable the `pgvector` extension (one SQL command).
3. Write the `packages/backend/scripts/import-corpus.ts` script that reads the local `ato.sqlite` and bulk-inserts into Supabase. Run it.
4. Verify both Vercel deployments succeed by reading the Vercel build logs through the MCP.
5. Trigger a fresh deploy after the env vars are in place.
6. Run the RLS verification tests against the real Postgres.
7. Wire the hosted-mode `get_user_facts` fetch (currently a stub).
8. Smoke-test end-to-end: visit `ato-mcp.com.au/onboard` in the browser, complete the magic-link flow, get the bearer token, configure Claude Code in hosted mode, verify the MCP works.
9. Update HANDOFF.md with the actual deployed state.

Total time for me: probably 1–2 hours of mostly automated work.

---

## Quick reference

| What | URL / Where |
|---|---|
| GitHub repo | https://github.com/william-laverty/ato-mcp |
| CI status | https://github.com/william-laverty/ato-mcp/actions |
| Supabase dashboard | https://supabase.com/dashboard |
| Vercel dashboard | https://vercel.com/dashboard |
| Local repo | `/Users/williamlaverty/Projects/Websites/ato-pro` |
| Current corpus | `~/Library/Application Support/ato-pro/live/ato.sqlite` (29,180 docs) |
| Spec | `docs/superpowers/specs/2026-05-26-v0.3-personal-context-design.md` |
| Plan | `docs/superpowers/plans/2026-05-26-v0.3-personal-context.md` |
| HANDOFF | `HANDOFF.md` |

## Common gotchas

- **Vercel build fails because pnpm can't find the workspace** — make sure the build command in each project is `cd ../.. && pnpm install && pnpm --filter @ato-pro/<package> build`. Vercel must install from the repo root to wire workspaces correctly.
- **Magic-link email doesn't arrive** — Supabase Auth uses a default sender in dev; check the spam folder. For production, add a custom sender domain in Supabase Auth → URL Configuration.
- **`pgvector` extension missing** — I'll handle this via the Supabase MCP, but if you want to do it manually: `CREATE EXTENSION IF NOT EXISTS vector;` in the SQL editor.
- **DNS doesn't propagate** — give it an hour. Vercel will show a green checkmark when it's ready.

If any of this is unclear, paste the question into Claude Code and I'll clarify.
