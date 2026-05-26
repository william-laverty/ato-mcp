-- Migration 0004: Row-Level Security policies
-- Apply with: psql <connection_string> < 0004_rls.sql
-- Depends on: 0002_user_schema.sql (tables must exist)
--
-- Security model:
--   - All user-data tables use RLS so that the anon/authenticated Supabase
--     role cannot access other users' rows.
--   - Corpus tables (docs, chunks, anchors, citations, definitions, thresholds)
--     are read-only public data — no RLS needed on those.
--   - bearer_tokens: DENY to all non-service-role access (only the service
--     role key used by Vercel functions can read/write this table).
--   - usage_events: users can read their own events; only service-role inserts.
--   - onboard_sessions: only service-role access (never exposed directly to users).

-- ---------------------------------------------------------------------------
-- Enable RLS on user tables
-- ---------------------------------------------------------------------------
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_facts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bearer_tokens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboard_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_connections  ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- users — each user can only see/edit their own row
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS users_self_select ON users;
CREATE POLICY users_self_select
  ON users FOR SELECT
  USING (user_id = (auth.uid())::TEXT);

DROP POLICY IF EXISTS users_self_update ON users;
CREATE POLICY users_self_update
  ON users FOR UPDATE
  USING (user_id = (auth.uid())::TEXT);

-- ---------------------------------------------------------------------------
-- user_facts — each user can see/edit only their own facts row
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS facts_self_all ON user_facts;
CREATE POLICY facts_self_all
  ON user_facts FOR ALL
  USING (user_id = (auth.uid())::TEXT);

-- ---------------------------------------------------------------------------
-- bearer_tokens — deny ALL non-service-role access
-- Service-role bypasses RLS automatically in Supabase.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tokens_deny_all ON bearer_tokens;
CREATE POLICY tokens_deny_all
  ON bearer_tokens FOR ALL
  USING (false);

-- ---------------------------------------------------------------------------
-- usage_events — users can read their own events; inserts only via service-role
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS events_self_select ON usage_events;
CREATE POLICY events_self_select
  ON usage_events FOR SELECT
  USING (user_id = (auth.uid())::TEXT);

-- ---------------------------------------------------------------------------
-- onboard_sessions — deny ALL non-service-role access
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS onboard_deny_all ON onboard_sessions;
CREATE POLICY onboard_deny_all
  ON onboard_sessions FOR ALL
  USING (false);

-- ---------------------------------------------------------------------------
-- mcp_connections — users can read their own connection record
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS mcp_conn_self_select ON mcp_connections;
CREATE POLICY mcp_conn_self_select
  ON mcp_connections FOR SELECT
  USING (user_id = (auth.uid())::TEXT);

-- ---------------------------------------------------------------------------
-- Corpus tables — public read, no write from any role except service-role
-- (These policies allow the anon and authenticated roles to SELECT freely,
--  which is appropriate for public ATO corpus data.)
-- ---------------------------------------------------------------------------
ALTER TABLE docs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE anchors      ENABLE ROW LEVEL SECURITY;
ALTER TABLE citations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE definitions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE thresholds   ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS corpus_public_read ON docs;
CREATE POLICY corpus_public_read ON docs         FOR SELECT USING (true);
DROP POLICY IF EXISTS corpus_public_read ON chunks;
CREATE POLICY corpus_public_read ON chunks       FOR SELECT USING (true);
DROP POLICY IF EXISTS corpus_public_read ON anchors;
CREATE POLICY corpus_public_read ON anchors      FOR SELECT USING (true);
DROP POLICY IF EXISTS corpus_public_read ON citations;
CREATE POLICY corpus_public_read ON citations    FOR SELECT USING (true);
DROP POLICY IF EXISTS corpus_public_read ON definitions;
CREATE POLICY corpus_public_read ON definitions  FOR SELECT USING (true);
DROP POLICY IF EXISTS corpus_public_read ON thresholds;
CREATE POLICY corpus_public_read ON thresholds   FOR SELECT USING (true);
DROP POLICY IF EXISTS corpus_public_read ON meta;
CREATE POLICY corpus_public_read ON meta         FOR SELECT USING (true);
