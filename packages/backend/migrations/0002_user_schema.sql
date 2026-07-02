-- Migration 0002: User schema (users, user_facts, bearer_tokens, usage_events,
--                              onboard_sessions, mcp_connections)
-- Apply with: psql <connection_string> < 0002_user_schema.sql
-- Depends on: 0001_corpus_schema.sql (for extension + connection)
-- Note: Supabase Auth manages the auth.users table separately. user_id here
--       is the UUID string from auth.users.id.

-- ---------------------------------------------------------------------------
-- users — one row per registered user (mirrors auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id         TEXT        PRIMARY KEY,   -- auth.users.id cast to text
  email           TEXT        NOT NULL UNIQUE,
  mode            TEXT        NOT NULL DEFAULT 'local'
                              CHECK (mode IN ('local', 'hosted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- user_facts — personal context facts submitted during onboarding
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_facts (
  user_id         TEXT        PRIMARY KEY REFERENCES users (user_id) ON DELETE CASCADE,
  facts           JSONB       NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- bearer_tokens — API tokens issued to hosted-mode users
-- Only the SHA-256 hash is stored; the plaintext is never persisted.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bearer_tokens (
  id              BIGSERIAL   PRIMARY KEY,
  user_id         TEXT        NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  -- SHA-256 hash of the raw token bytes, hex-encoded
  token_hash      TEXT        NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS bearer_tokens_user_id_idx   ON bearer_tokens (user_id);
CREATE INDEX IF NOT EXISTS bearer_tokens_token_hash_idx ON bearer_tokens (token_hash);

-- ---------------------------------------------------------------------------
-- usage_events — privacy-safe analytics (no query text, no results)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_events (
  id              BIGSERIAL   PRIMARY KEY,
  user_id         TEXT        NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  event_type      TEXT        NOT NULL
                              CHECK (event_type IN (
                                'mcp_started','heartbeat','update_check',
                                'update_applied','facts_pulled'
                              )),
  mode            TEXT        NOT NULL CHECK (mode IN ('local','hosted')),
  event_time      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_events_user_id_idx  ON usage_events (user_id);
CREATE INDEX IF NOT EXISTS usage_events_type_idx     ON usage_events (event_type);
CREATE INDEX IF NOT EXISTS usage_events_time_idx     ON usage_events (event_time);

-- ---------------------------------------------------------------------------
-- onboard_sessions — short-lived codes used by the CLI onboard handshake
-- The CLI generates a random code, opens a browser to /onboard?cli=<code>,
-- and polls /v1/onboard/poll?code=<code> until ready=true.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onboard_sessions (
  code            TEXT        PRIMARY KEY,   -- 8 hex chars
  user_id         TEXT        REFERENCES users (user_id) ON DELETE CASCADE,
  mode            TEXT        CHECK (mode IN ('local','hosted')),
  bearer_token    TEXT,                      -- plaintext token (one-time, deleted after poll)
  facts_snapshot  JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  -- Sessions expire after 15 minutes
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 minutes')
);

CREATE INDEX IF NOT EXISTS onboard_sessions_user_id_idx ON onboard_sessions (user_id);

-- ---------------------------------------------------------------------------
-- mcp_connections — tracks which MCP clients have connected (for the install
-- confirmation screen). Populated by the /v1/usage_event endpoint on first
-- mcp_started event.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mcp_connections (
  id              BIGSERIAL   PRIMARY KEY,
  user_id         TEXT        NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_version  TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS mcp_connections_user_id_uidx ON mcp_connections (user_id);
