-- B4 cleanup: the backend now calls the canonical names; drop the twins that
-- existed only to carry the deployed backend through the rename migration.
drop function if exists public.ato_vector_search_openai(vector, integer, date);
drop function if exists public.bulk_update_chunk_embeddings_openai(jsonb);
