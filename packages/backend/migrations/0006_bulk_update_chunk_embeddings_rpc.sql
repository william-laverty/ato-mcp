-- 0006 — bulk_update_chunk_embeddings RPC.
--
-- Used by the reembed_corpus script to push freshly-computed embeddings
-- back to Supabase in one round-trip per batch. Input is a JSONB array
-- of {chunk_id, embedding}; embedding is a pgvector text literal
-- (e.g. "[0.1,0.2,...]") which the cast to vector(384) parses.
--
-- SECURITY: INVOKER (default). EXECUTE is revoked from PUBLIC so the
-- anon and authenticated roles can't call it through PostgREST. The
-- secret/service_role key is required.

CREATE OR REPLACE FUNCTION public.bulk_update_chunk_embeddings(payload JSONB)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  n INT;
BEGIN
  WITH updates AS (
    SELECT
      (elem->>'chunk_id')::TEXT  AS chunk_id,
      (elem->>'embedding')::vector(384) AS embedding
    FROM jsonb_array_elements(payload) AS elem
  )
  UPDATE chunks c
     SET embedding = u.embedding
    FROM updates u
   WHERE c.chunk_id = u.chunk_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bulk_update_chunk_embeddings(JSONB) FROM PUBLIC;
