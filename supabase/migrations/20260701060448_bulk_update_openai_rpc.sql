-- Bulk-writes OpenAI (halfvec 3072) vectors into chunks.embedding_openai.
-- Mirrors bulk_update_chunk_embeddings (which targets the 384 `embedding` column).
-- Used by the engine's OpenAI re-embed runner; additive, does not touch `embedding`.
create or replace function public.bulk_update_chunk_embeddings_openai(payload jsonb)
returns integer
language plpgsql
as $function$
declare
  n int;
begin
  with updates as (
    select
      (elem->>'chunk_id')::text as chunk_id,
      (elem->>'embedding')::halfvec(3072) as embedding
    from jsonb_array_elements(payload) as elem
  )
  update chunks c
     set embedding_openai = u.embedding
    from updates u
   where c.chunk_id = u.chunk_id;
  get diagnostics n = row_count;
  return n;
end;
$function$;
