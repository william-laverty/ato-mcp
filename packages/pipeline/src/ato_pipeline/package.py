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

        conn.commit()
    finally:
        conn.close()
