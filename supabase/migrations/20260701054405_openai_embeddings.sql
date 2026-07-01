-- Additive OpenAI embedding path. Does NOT touch the live `embedding` column or
-- `ato_vector_search` — serving continues on MiniLM until the EMBED_PROVIDER flag
-- flips. The engine repo populates embedding_openai; cutover happens via env.

alter table chunks add column if not exists embedding_openai halfvec(3072);

-- HNSW index (halfvec indexes up to 4000 dims). Built empty; maintained as the
-- engine re-embed populates the column.
create index if not exists chunks_embedding_openai_idx
  on chunks using hnsw (embedding_openai halfvec_cosine_ops);

create or replace function public.ato_vector_search_openai(
  q_embedding vector(3072), k integer, pit_date date default null
)
returns table(
  chunk_id text, doc_id text, ord integer, text text, heading_path text[],
  score real, title text, url text, doc_type text, snippet text
)
language sql stable as $function$
  select
    c.chunk_id, c.doc_id, c.ord, c.text, c.heading_path,
    (1 - (c.embedding_openai <=> q_embedding::halfvec))::real as score,
    d.title, d.url, d.doc_type,
    left(c.text, 280) as snippet
  from chunks c
  join docs d using (doc_id)
  where c.embedding_openai is not null
    and (
      pit_date is null
      or (
        (c.effective_from is null or c.effective_from <= pit_date)
        and (c.effective_to is null or c.effective_to > pit_date)
      )
    )
  order by c.embedding_openai <=> q_embedding::halfvec
  limit k;
$function$;
