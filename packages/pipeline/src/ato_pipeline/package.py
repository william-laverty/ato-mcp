from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Iterable

import numpy as np
import sqlite_vec

from .schema import Chunk, Doc


_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS docs (
  doc_id          TEXT PRIMARY KEY,
  source          TEXT NOT NULL,
  url             TEXT NOT NULL,
  title           TEXT NOT NULL,
  jurisdiction    TEXT NOT NULL DEFAULT 'AU',
  doc_type        TEXT NOT NULL,
  effective_from  TEXT,
  effective_to    TEXT,
  published_at    TEXT,
  retrieved_at    TEXT NOT NULL,
  metadata_json   TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_docs_source ON docs(source);
CREATE INDEX IF NOT EXISTS idx_docs_type   ON docs(doc_type);

CREATE TABLE IF NOT EXISTS chunks (
  chunk_id        TEXT PRIMARY KEY,
  doc_id          TEXT NOT NULL REFERENCES docs(doc_id) ON DELETE CASCADE,
  ord             INTEGER NOT NULL,
  text            TEXT NOT NULL,
  heading_path    TEXT NOT NULL DEFAULT '[]',
  effective_from  TEXT,
  effective_to    TEXT,
  char_start      INTEGER NOT NULL DEFAULT 0,
  char_end        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id);

CREATE TABLE IF NOT EXISTS anchors (
  anchor_id    TEXT PRIMARY KEY,
  doc_id       TEXT NOT NULL,
  anchor_name  TEXT NOT NULL,
  chunk_id     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_anchors_doc ON anchors(doc_id);

CREATE TABLE IF NOT EXISTS citations (
  from_chunk_id  TEXT NOT NULL,
  to_doc_id      TEXT NOT NULL,
  to_anchor      TEXT,
  citation_kind  TEXT NOT NULL,
  PRIMARY KEY (from_chunk_id, to_doc_id, to_anchor, citation_kind)
);
CREATE INDEX IF NOT EXISTS idx_citations_from ON citations(from_chunk_id);
CREATE INDEX IF NOT EXISTS idx_citations_to   ON citations(to_doc_id);

CREATE TABLE IF NOT EXISTS definitions (
  term            TEXT NOT NULL,
  doc_id          TEXT NOT NULL,
  anchor_id       TEXT,
  body            TEXT NOT NULL,
  effective_from  TEXT,
  effective_to    TEXT,
  PRIMARY KEY (term, doc_id, effective_from)
);
CREATE INDEX IF NOT EXISTS idx_definitions_term ON definitions(term);

CREATE TABLE IF NOT EXISTS thresholds (
  name            TEXT NOT NULL,
  value           REAL NOT NULL,
  unit            TEXT NOT NULL,
  effective_from  TEXT,
  effective_to    TEXT,
  source_doc_id   TEXT,
  source_anchor   TEXT,
  PRIMARY KEY (name, effective_from)
);
CREATE INDEX IF NOT EXISTS idx_thresholds_name ON thresholds(name);
"""


def _build_vec_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0("
        "chunk_id TEXT PRIMARY KEY, embedding FLOAT[384]"
        ")"
    )


def _build_fts_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS fts_chunks USING fts5("
        "chunk_id UNINDEXED, text, "
        "tokenize='porter unicode61'"
        ")"
    )


def build_sqlite(
    db_path: Path,
    *,
    docs: Iterable[Doc],
    chunks: Iterable[Chunk],
    embeddings: np.ndarray,
    schema_version: str,
    anchors: list[dict] | None = None,
    citations: list[dict] | None = None,
    definitions: list[dict] | None = None,
    thresholds: list[dict] | None = None,
) -> None:
    """Build the SQLite corpus file at db_path.

    embeddings: float32 array of shape (n_chunks, 384), aligned with chunks order.
    """
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        db_path.unlink()
    conn = sqlite3.connect(db_path)
    try:
        conn.enable_load_extension(True)
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)

        conn.executescript(_SCHEMA_SQL)
        _build_vec_table(conn)
        _build_fts_table(conn)

        conn.execute(
            "INSERT INTO meta(key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            ("schema_version", schema_version),
        )

        doc_rows = [
            (
                d.doc_id,
                d.source,
                str(d.url),
                d.title,
                d.jurisdiction,
                d.doc_type,
                d.effective_from,
                d.effective_to,
                d.published_at,
                d.retrieved_at,
                json.dumps(d.metadata),
            )
            for d in docs
        ]
        conn.executemany(
            "INSERT OR REPLACE INTO docs VALUES (?,?,?,?,?,?,?,?,?,?,?)", doc_rows
        )

        chunk_list = list(chunks)
        if len(chunk_list) != embeddings.shape[0]:
            raise ValueError(
                f"chunks ({len(chunk_list)}) and embeddings ({embeddings.shape[0]}) length mismatch"
            )

        chunk_rows = [
            (
                c.chunk_id,
                c.doc_id,
                c.ord,
                c.text,
                json.dumps(c.heading_path),
                c.effective_from,
                c.effective_to,
                c.char_start,
                c.char_end,
            )
            for c in chunk_list
        ]
        conn.executemany(
            "INSERT OR REPLACE INTO chunks VALUES (?,?,?,?,?,?,?,?,?)", chunk_rows
        )

        # FTS5
        fts_rows = [(c.chunk_id, c.text) for c in chunk_list]
        conn.executemany("INSERT INTO fts_chunks(chunk_id, text) VALUES (?,?)", fts_rows)

        # Vectors. sqlite-vec accepts a packed bytes blob.
        vec_rows = [
            (c.chunk_id, embeddings[i].astype(np.float32).tobytes())
            for i, c in enumerate(chunk_list)
        ]
        conn.executemany(
            "INSERT INTO vec_chunks(chunk_id, embedding) VALUES (?, ?)", vec_rows
        )

        # Anchors
        if anchors:
            conn.executemany(
                "INSERT OR REPLACE INTO anchors(anchor_id, doc_id, anchor_name, chunk_id) VALUES (?,?,?,?)",
                [(a["anchor_id"], a["doc_id"], a["anchor_name"], a["chunk_id"]) for a in anchors],
            )

        # Citations
        if citations:
            conn.executemany(
                "INSERT OR REPLACE INTO citations(from_chunk_id, to_doc_id, to_anchor, citation_kind) VALUES (?,?,?,?)",
                [(c["from_chunk_id"], c["to_doc_id"], c.get("to_anchor"), c["citation_kind"]) for c in citations],
            )

        # Definitions
        if definitions:
            conn.executemany(
                "INSERT OR REPLACE INTO definitions(term, doc_id, anchor_id, body, effective_from, effective_to) VALUES (?,?,?,?,?,?)",
                [(d["term"], d["doc_id"], d.get("anchor_id"), d["body"], d.get("effective_from"), d.get("effective_to")) for d in definitions],
            )

        # Thresholds
        if thresholds:
            conn.executemany(
                "INSERT OR REPLACE INTO thresholds(name, value, unit, effective_from, effective_to, source_doc_id, source_anchor) VALUES (?,?,?,?,?,?,?)",
                [(t["name"], t["value"], t["unit"], t.get("effective_from"), t.get("effective_to"), t.get("source_doc_id"), t.get("source_anchor")) for t in thresholds],
            )

        conn.commit()
    finally:
        conn.close()
