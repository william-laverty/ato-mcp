-- 0005 — citations table hardening (natural-key uniqueness).
--
-- The citations table (created in 0001) has a synthetic BIGSERIAL `id`
-- as its primary key, but without a unique constraint on the natural
-- key (from_chunk_id, to_doc_id, to_anchor, citation_kind) the table
-- accepts duplicate rows. This bites the populate_citations script,
-- which is otherwise idempotent.
--
-- Also makes to_anchor NOT NULL DEFAULT '' so PostgreSQL's unique
-- semantics (which treat NULL as distinct) don't undermine the
-- constraint, and so PostgREST's on_conflict can target the index.

ALTER TABLE public.citations
  ALTER COLUMN to_anchor SET DEFAULT '';

UPDATE public.citations
   SET to_anchor = ''
 WHERE to_anchor IS NULL;

ALTER TABLE public.citations
  ALTER COLUMN to_anchor SET NOT NULL;

ALTER TABLE public.citations
  ADD CONSTRAINT IF NOT EXISTS uq_citations_natural
  UNIQUE (from_chunk_id, to_doc_id, to_anchor, citation_kind);
