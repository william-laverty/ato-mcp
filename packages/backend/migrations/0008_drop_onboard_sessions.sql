-- 0008_drop_onboard_sessions.sql
-- The CLI onboard-poll handshake was removed (v1.1.0): the CLI no longer
-- generates a code, and nothing reads or writes onboard_sessions. The web
-- onboarding flow uses magic-link auth + /api/poll → mcp_connections.last_seen_at
-- instead. Migration 0007 already dropped the dead `mode` column; this drops
-- the now-fully-orphaned table.
--
-- CASCADE removes the dependent index (onboard_sessions_user_id_idx) and RLS
-- policy (onboard_deny_all). IF EXISTS keeps this idempotent and safe to re-run.

DROP TABLE IF EXISTS onboard_sessions CASCADE;
