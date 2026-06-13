-- 0007_drop_dead_mode_columns.sql
-- Local mode removed (v1.1.0): the `mode` columns are now dead.
--
-- usage_events.mode was NOT NULL with no default, which broke the new
-- mode-less usage_event insert in the v1.1.0 backend. users.mode and
-- onboard_sessions.mode are likewise unused after local mode + the
-- onboard-poll flow were removed.
--
-- ORDERING: apply this AFTER the v1.1.0 backend is deployed. The prior backend
-- still writes usage_events.mode, so dropping the column before the new
-- backend is live would break the old backend's inserts during the deploy
-- window. Drop columns are idempotent (IF EXISTS) and safe to re-run.

ALTER TABLE usage_events DROP COLUMN IF EXISTS mode;
ALTER TABLE users DROP COLUMN IF EXISTS mode;
ALTER TABLE onboard_sessions DROP COLUMN IF EXISTS mode;
