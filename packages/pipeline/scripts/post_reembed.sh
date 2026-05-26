#!/usr/bin/env bash
# post_reembed.sh — finalise the Granite swap once reembed_corpus.py
# finishes. Should be run from the pipeline package root with the
# Supabase env vars set.
#
# 1. Rebuild the ivfflat index on chunks.embedding (dropped before
#    re-embed for ~3-5x throughput).
# 2. Record the new embedding model in Supabase + local SQLite meta.
# 3. Smoke-test /search against the live backend.
#
# Usage:
#   SUPABASE_URL=... SUPABASE_SECRET_KEY=... BACKEND_BEARER=... \
#     bash scripts/post_reembed.sh

set -euo pipefail

MODEL="ibm-granite/granite-embedding-small-english-r2"
SQLITE="${SQLITE:-$HOME/Library/Application Support/ato-mcp/live/ato.sqlite}"

: "${SUPABASE_URL:?SUPABASE_URL required}"
: "${SUPABASE_SECRET_KEY:?SUPABASE_SECRET_KEY required}"

echo "==> 1/4 Rebuilding ivfflat index on chunks.embedding (lists=100)..."
curl -sS -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/exec" \
  -H "apikey: ${SUPABASE_SECRET_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SECRET_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"q": "CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists=100)"}' \
  || echo "  (curl/RPC failed — run the SQL manually via Supabase MCP execute_sql)"

echo
echo "==> 2/4 Recording embedding_model in Supabase meta..."
psql_payload=$(printf '{"key":"embedding_model","value":"%s"}' "$MODEL")
curl -sS -X POST \
  "${SUPABASE_URL}/rest/v1/meta" \
  -H "apikey: ${SUPABASE_SECRET_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SECRET_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates,return=minimal" \
  -d "$psql_payload" \
  || echo "  (failed — meta table may not have a key uniqueness constraint)"

echo
echo "==> 3/4 Recording embedding_model in local SQLite meta..."
if [ -f "$SQLITE" ]; then
  sqlite3 "$SQLITE" \
    "INSERT INTO meta(key, value) VALUES ('embedding_model', '$MODEL') \
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;"
  echo "  ok"
else
  echo "  (no local SQLite at $SQLITE; skipping)"
fi

echo
echo "==> 4/4 Smoke-testing live /search..."
if [ -z "${BACKEND_BEARER:-}" ]; then
  echo "  (BACKEND_BEARER unset; skipping smoke test)"
else
  uv run python -m scripts.search_smoke --mode vector --k 3
fi

echo
echo "Done. Next: commit + push the model default changes so Vercel"
echo "redeploys with Granite as the query embedder."
