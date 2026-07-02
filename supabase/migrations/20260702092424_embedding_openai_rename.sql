-- B4: consolidate on the OpenAI embedding column. Drops the dead MiniLM
-- (384) path and renames embedding_openai -> embedding. The *_openai
-- function names are kept as identical twins so the currently-deployed
-- backend keeps serving through this deploy; a follow-up migration drops
-- them once the backend switches to the canonical names.

-- 1. Dead MiniLM path (dropping the column also drops the ivfflat
--    chunks_embedding_idx, freeing the name for the hnsw index rename).
alter table chunks drop column if exists embedding;
drop function if exists public.ato_vector_search(vector, integer, date);
drop function if exists public.bulk_update_chunk_embeddings(jsonb);

-- 2. Rename the live column + index.
alter table chunks rename column embedding_openai to embedding;
alter index chunks_embedding_openai_idx rename to chunks_embedding_idx;

-- 3. Canonical RPCs over the renamed column.
create or replace function public.ato_vector_search(
  q_embedding vector(3072), k integer, pit_date date default null
)
returns table(
  chunk_id text, doc_id text, ord integer, text text, heading_path text[],
  score real, title text, url text, doc_type text, snippet text
)
language sql stable as $function$
  select
    c.chunk_id, c.doc_id, c.ord, c.text, c.heading_path,
    (1 - (c.embedding <=> q_embedding::halfvec))::real as score,
    d.title, d.url, d.doc_type,
    left(c.text, 280) as snippet
  from chunks c
  join docs d using (doc_id)
  where c.embedding is not null
    and (
      pit_date is null
      or (
        (c.effective_from is null or c.effective_from <= pit_date)
        and (c.effective_to is null or c.effective_to > pit_date)
      )
    )
  order by c.embedding <=> q_embedding::halfvec
  limit k;
$function$;

create or replace function public.bulk_update_chunk_embeddings(payload jsonb)
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
     set embedding = u.embedding
    from updates u
   where c.chunk_id = u.chunk_id;
  get diagnostics n = row_count;
  return n;
end;
$function$;

-- 4. Compat twins (same results) for the in-flight backend + engine script.
create or replace function public.ato_vector_search_openai(
  q_embedding vector(3072), k integer, pit_date date default null
)
returns table(
  chunk_id text, doc_id text, ord integer, text text, heading_path text[],
  score real, title text, url text, doc_type text, snippet text
)
language sql stable as $function$
  select * from public.ato_vector_search(q_embedding, k, pit_date);
$function$;

create or replace function public.bulk_update_chunk_embeddings_openai(payload jsonb)
returns integer
language sql
as $function$
  select public.bulk_update_chunk_embeddings(payload);
$function$;

-- 5. Grants (ato_vector_search / bulk_update_chunk_embeddings were dropped
--    and recreated, losing their grants; be explicit for all four).
grant execute on function public.ato_vector_search(vector, integer, date) to anon, authenticated, service_role;
grant execute on function public.ato_vector_search_openai(vector, integer, date) to anon, authenticated, service_role;
revoke all on function public.bulk_update_chunk_embeddings(jsonb) from public;
grant execute on function public.bulk_update_chunk_embeddings(jsonb) to service_role;
revoke all on function public.bulk_update_chunk_embeddings_openai(jsonb) from public;
grant execute on function public.bulk_update_chunk_embeddings_openai(jsonb) to service_role;
