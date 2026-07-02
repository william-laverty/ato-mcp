# Legacy migrations (provenance only)

These numbered SQL files (`0001_*.sql` … `0008_*.sql`) are the historical,
hand-applied migrations from before the Supabase GitHub integration was adopted.

**They are no longer the source of truth and are not applied by any tooling.**
The canonical, deployed migrations now live in
[`/supabase/migrations/`](../../../supabase/migrations/), which the Supabase
GitHub integration deploys (a preview branch per PR, production on merge to
`main`). The current production schema was captured there as a squashed baseline
(`<timestamp>_remote_schema.sql`) via `supabase db dump`, and production's
migration history was consolidated to that single applied baseline.

These files are retained for history. Do not edit them and do not add new files
here — create new migrations under `/supabase/migrations/` with
`supabase migration new <name>`.
