-- Migration 0001: Corpus schema (docs, chunks, anchors, citations, definitions, thresholds)
-- Apply with: psql <connection_string> < 0001_corpus_schema.sql
-- Requires: pgvector extension enabled (CREATE EXTENSION IF NOT EXISTS vector;)

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- docs — one row per ATO document / legislation page
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS docs (
  doc_id          TEXT        PRIMARY KEY,
  source          TEXT        NOT NULL CHECK (source IN ('ato','legislation','austlii','state_revenue')),
  url             TEXT        NOT NULL,
  title           TEXT        NOT NULL DEFAULT '',
  jurisdiction    TEXT        NOT NULL DEFAULT 'AU',
  doc_type        TEXT        NOT NULL DEFAULT '',
  effective_from  DATE,
  effective_to    DATE,
  published_at    DATE,
  retrieved_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata        JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS docs_source_idx      ON docs (source);
CREATE INDEX IF NOT EXISTS docs_doc_type_idx    ON docs (doc_type);
CREATE INDEX IF NOT EXISTS docs_effective_idx   ON docs (effective_from, effective_to);

-- ---------------------------------------------------------------------------
-- chunks — text segments derived from docs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chunks (
  chunk_id        TEXT        PRIMARY KEY,
  doc_id          TEXT        NOT NULL REFERENCES docs (doc_id) ON DELETE CASCADE,
  ord             INTEGER     NOT NULL,
  text            TEXT        NOT NULL,
  heading_path    TEXT[]      NOT NULL DEFAULT '{}',
  effective_from  DATE,
  effective_to    DATE,
  char_start      INTEGER     NOT NULL DEFAULT 0,
  char_end        INTEGER     NOT NULL DEFAULT 0,
  -- Full-text search vector — computed from text column
  tsv             TSVECTOR    GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
  -- Semantic embedding vector (384-dim, all-MiniLM-L6-v2 or Granite Small R2)
  embedding       VECTOR(384)
);

CREATE INDEX IF NOT EXISTS chunks_doc_id_ord_idx  ON chunks (doc_id, ord);
CREATE INDEX IF NOT EXISTS chunks_effective_idx   ON chunks (effective_from, effective_to);
CREATE INDEX IF NOT EXISTS chunks_tsv_idx         ON chunks USING GIN (tsv);
-- IVFFlat index for ANN search — tune lists= based on corpus size
-- (1 list per 1000 rows; minimum 1; 100 is a safe start for ~225k chunks)
CREATE INDEX IF NOT EXISTS chunks_embedding_idx   ON chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ---------------------------------------------------------------------------
-- anchors — named heading/section anchors within docs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS anchors (
  anchor_id       TEXT        PRIMARY KEY,
  doc_id          TEXT        NOT NULL REFERENCES docs (doc_id) ON DELETE CASCADE,
  anchor_name     TEXT        NOT NULL,
  chunk_id        TEXT        NOT NULL REFERENCES chunks (chunk_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS anchors_doc_id_idx ON anchors (doc_id);

-- ---------------------------------------------------------------------------
-- citations — cross-references between chunks and docs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS citations (
  id              BIGSERIAL   PRIMARY KEY,
  from_chunk_id   TEXT        NOT NULL REFERENCES chunks (chunk_id) ON DELETE CASCADE,
  to_doc_id       TEXT        NOT NULL REFERENCES docs (doc_id) ON DELETE CASCADE,
  to_anchor       TEXT,
  citation_kind   TEXT        NOT NULL DEFAULT 'reference'
);

CREATE INDEX IF NOT EXISTS citations_from_idx ON citations (from_chunk_id);
CREATE INDEX IF NOT EXISTS citations_to_idx   ON citations (to_doc_id);

-- ---------------------------------------------------------------------------
-- definitions — statutory definitions extracted from ATO docs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS definitions (
  id              BIGSERIAL   PRIMARY KEY,
  term            TEXT        NOT NULL,
  doc_id          TEXT        NOT NULL REFERENCES docs (doc_id) ON DELETE CASCADE,
  anchor_id       TEXT,
  body            TEXT        NOT NULL,
  effective_from  DATE,
  effective_to    DATE
);

CREATE INDEX IF NOT EXISTS definitions_term_idx ON definitions (lower(term));
CREATE INDEX IF NOT EXISTS definitions_doc_id_idx ON definitions (doc_id);

-- ---------------------------------------------------------------------------
-- thresholds — dollar/rate thresholds referenced in ATO documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS thresholds (
  id              BIGSERIAL   PRIMARY KEY,
  name            TEXT        NOT NULL,
  value           NUMERIC     NOT NULL,
  unit            TEXT        NOT NULL DEFAULT 'AUD',
  effective_from  DATE,
  effective_to    DATE,
  source_doc_id   TEXT        REFERENCES docs (doc_id) ON DELETE SET NULL,
  source_anchor   TEXT
);

CREATE INDEX IF NOT EXISTS thresholds_name_idx ON thresholds (name);
CREATE INDEX IF NOT EXISTS thresholds_effective_idx ON thresholds (effective_from, effective_to);

-- ---------------------------------------------------------------------------
-- meta — schema version + corpus manifest
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO meta (key, value) VALUES ('schema_version', '0.3.0')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
