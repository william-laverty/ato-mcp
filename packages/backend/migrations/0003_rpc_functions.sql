-- Migration 0003: RPC functions called by SupabaseStore
-- Apply with: psql <connection_string> < 0003_rpc_functions.sql
-- Depends on: 0001_corpus_schema.sql (tables must exist)

-- ---------------------------------------------------------------------------
-- ato_keyword_search — full-text search using pg tsv + websearch_to_tsquery
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ato_keyword_search(
  q        TEXT,
  k        INT,
  pit_date DATE DEFAULT NULL
)
RETURNS TABLE(
  chunk_id      TEXT,
  doc_id        TEXT,
  ord           INT,
  text          TEXT,
  heading_path  TEXT[],
  score         REAL,
  title         TEXT,
  url           TEXT,
  doc_type      TEXT,
  snippet       TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.chunk_id,
    c.doc_id,
    c.ord,
    c.text,
    c.heading_path,
    ts_rank(c.tsv, websearch_to_tsquery('english', q))::REAL AS score,
    d.title,
    d.url,
    d.doc_type,
    left(c.text, 280) AS snippet
  FROM chunks c
  JOIN docs d USING (doc_id)
  WHERE c.tsv @@ websearch_to_tsquery('english', q)
    AND (
      pit_date IS NULL
      OR (
        (c.effective_from IS NULL OR c.effective_from <= pit_date)
        AND (c.effective_to IS NULL OR c.effective_to > pit_date)
      )
    )
  ORDER BY score DESC
  LIMIT k;
$$;

-- ---------------------------------------------------------------------------
-- ato_vector_search — approximate nearest-neighbour via pgvector cosine
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ato_vector_search(
  q_embedding  VECTOR(384),
  k            INT,
  pit_date     DATE DEFAULT NULL
)
RETURNS TABLE(
  chunk_id      TEXT,
  doc_id        TEXT,
  ord           INT,
  text          TEXT,
  heading_path  TEXT[],
  score         REAL,
  title         TEXT,
  url           TEXT,
  doc_type      TEXT,
  snippet       TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.chunk_id,
    c.doc_id,
    c.ord,
    c.text,
    c.heading_path,
    (1 - (c.embedding <=> q_embedding))::REAL AS score,
    d.title,
    d.url,
    d.doc_type,
    left(c.text, 280) AS snippet
  FROM chunks c
  JOIN docs d USING (doc_id)
  WHERE c.embedding IS NOT NULL
    AND (
      pit_date IS NULL
      OR (
        (c.effective_from IS NULL OR c.effective_from <= pit_date)
        AND (c.effective_to IS NULL OR c.effective_to > pit_date)
      )
    )
  ORDER BY c.embedding <=> q_embedding
  LIMIT k;
$$;

-- ---------------------------------------------------------------------------
-- ato_get_chunks — fetch specific chunks (with optional neighbours)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ato_get_chunks(
  chunk_ids  TEXT[],
  neighbours INT DEFAULT 0,
  pit_date   DATE DEFAULT NULL
)
RETURNS TABLE(
  chunk_id      TEXT,
  doc_id        TEXT,
  ord           INT,
  text          TEXT,
  heading_path  TEXT[],
  score         REAL,
  title         TEXT,
  url           TEXT,
  doc_type      TEXT,
  snippet       TEXT
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  wanted TEXT[];
  target RECORD;
  n      INT;
BEGIN
  -- Build expanded set of chunk_ids including neighbours
  wanted := chunk_ids;
  FOR target IN
    SELECT c.chunk_id, c.doc_id, c.ord
    FROM chunks c
    WHERE c.chunk_id = ANY(chunk_ids)
  LOOP
    FOR n IN 1..neighbours LOOP
      wanted := array_append(wanted, (target.doc_id || '#' || (target.ord - n)::TEXT));
      wanted := array_append(wanted, (target.doc_id || '#' || (target.ord + n)::TEXT));
    END LOOP;
  END LOOP;

  RETURN QUERY
    SELECT
      c.chunk_id,
      c.doc_id,
      c.ord,
      c.text,
      c.heading_path,
      0.0::REAL AS score,
      d.title,
      d.url,
      d.doc_type,
      left(c.text, 280) AS snippet
    FROM chunks c
    JOIN docs d USING (doc_id)
    WHERE c.chunk_id = ANY(wanted)
      AND (
        pit_date IS NULL
        OR (
          (c.effective_from IS NULL OR c.effective_from <= pit_date)
          AND (c.effective_to IS NULL OR c.effective_to > pit_date)
        )
      )
    ORDER BY c.doc_id, c.ord;
END;
$$;

-- ---------------------------------------------------------------------------
-- ato_get_doc — return doc metadata + cleaned_html + anchors as a JSON object
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ato_get_doc(doc_id TEXT)
RETURNS JSONB
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_build_object(
    'doc',          row_to_json(d)::JSONB,
    'cleaned_html', NULL,
    'anchors',      COALESCE(
                      (SELECT jsonb_agg(row_to_json(a))
                       FROM anchors a WHERE a.doc_id = d.doc_id),
                      '[]'::JSONB
                    )
  )
  FROM docs d
  WHERE d.doc_id = ato_get_doc.doc_id;
$$;

-- ---------------------------------------------------------------------------
-- ato_get_doc_anchors — return anchor graph (anchors + inbound + outbound)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ato_get_doc_anchors(doc_id TEXT)
RETURNS JSONB
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_build_object(
    'anchors',  COALESCE(
                  (SELECT jsonb_agg(row_to_json(a))
                   FROM anchors a WHERE a.doc_id = ato_get_doc_anchors.doc_id),
                  '[]'::JSONB
                ),
    'inbound',  COALESCE(
                  (SELECT jsonb_agg(row_to_json(ci))
                   FROM citations ci WHERE ci.to_doc_id = ato_get_doc_anchors.doc_id),
                  '[]'::JSONB
                ),
    'outbound', COALESCE(
                  (SELECT jsonb_agg(row_to_json(co))
                   FROM citations co
                   JOIN chunks ck ON ck.chunk_id = co.from_chunk_id
                   WHERE ck.doc_id = ato_get_doc_anchors.doc_id),
                  '[]'::JSONB
                )
  );
$$;

-- ---------------------------------------------------------------------------
-- ato_get_definition — return matching definition rows for a term
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ato_get_definition(
  p_term   TEXT,
  pit_date DATE DEFAULT NULL
)
RETURNS TABLE(
  term           TEXT,
  doc_id         TEXT,
  anchor_id      TEXT,
  body           TEXT,
  effective_from DATE,
  effective_to   DATE
)
LANGUAGE sql STABLE
AS $$
  SELECT
    def.term,
    def.doc_id,
    def.anchor_id,
    def.body,
    def.effective_from,
    def.effective_to
  FROM definitions def
  WHERE lower(def.term) = lower(p_term)
    AND (
      pit_date IS NULL
      OR (
        (def.effective_from IS NULL OR def.effective_from <= pit_date)
        AND (def.effective_to IS NULL OR def.effective_to > pit_date)
      )
    )
  ORDER BY def.effective_from DESC NULLS LAST;
$$;

-- ---------------------------------------------------------------------------
-- ato_get_threshold — return the most recent matching threshold row
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ato_get_threshold(
  p_name   TEXT,
  pit_date DATE DEFAULT NULL
)
RETURNS TABLE(
  name           TEXT,
  value          NUMERIC,
  unit           TEXT,
  effective_from DATE,
  effective_to   DATE,
  source_doc_id  TEXT,
  source_anchor  TEXT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    t.name,
    t.value,
    t.unit,
    t.effective_from,
    t.effective_to,
    t.source_doc_id,
    t.source_anchor
  FROM thresholds t
  WHERE t.name = p_name
    AND (
      pit_date IS NULL
      OR (
        (t.effective_from IS NULL OR t.effective_from <= pit_date)
        AND (t.effective_to IS NULL OR t.effective_to > pit_date)
      )
    )
  ORDER BY t.effective_from DESC NULLS LAST
  LIMIT 1;
$$;
