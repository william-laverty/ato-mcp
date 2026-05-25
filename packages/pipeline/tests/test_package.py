import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pytest

from ato_pipeline.package import build_sqlite
from ato_pipeline.schema import Chunk, Doc


@pytest.fixture
def sample_corpus():
    docs = [
        Doc(
            doc_id="ato:test/a",
            source="ato",
            url="https://www.ato.gov.au/test/a",
            title="Doc A",
            doc_type="ATO_GUIDE",
            retrieved_at=datetime.now(timezone.utc).isoformat(),
        ),
        Doc(
            doc_id="ato:test/b",
            source="ato",
            url="https://www.ato.gov.au/test/b",
            title="Doc B",
            doc_type="ATO_GUIDE",
            retrieved_at=datetime.now(timezone.utc).isoformat(),
        ),
    ]
    chunks = [
        Chunk(chunk_id="ato:test/a#0", doc_id="ato:test/a", ord=0, text="apple banana", heading_path=["A"], char_start=0, char_end=12),
        Chunk(chunk_id="ato:test/a#1", doc_id="ato:test/a", ord=1, text="cherry date", heading_path=["A"], char_start=12, char_end=23),
        Chunk(chunk_id="ato:test/b#0", doc_id="ato:test/b", ord=0, text="eggplant fig", heading_path=["B"], char_start=0, char_end=12),
    ]
    rng = np.random.default_rng(42)
    embeddings = rng.standard_normal((3, 384), dtype=np.float32)
    embeddings /= np.linalg.norm(embeddings, axis=1, keepdims=True)
    return docs, chunks, embeddings


def test_build_sqlite_creates_expected_tables(tmp_path: Path, sample_corpus):
    docs, chunks, embeddings = sample_corpus
    db_path = tmp_path / "out.sqlite"
    build_sqlite(db_path, docs=docs, chunks=chunks, embeddings=embeddings, schema_version="0.1.0")
    conn = sqlite3.connect(db_path)
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert "docs" in tables
    assert "chunks" in tables
    # sqlite-vec virtual table for embeddings
    assert "vec_chunks" in tables
    # FTS5 virtual table for BM25
    assert "fts_chunks" in tables
    # meta table for schema version
    assert "meta" in tables


def test_build_sqlite_populates_docs_and_chunks(tmp_path: Path, sample_corpus):
    docs, chunks, embeddings = sample_corpus
    db_path = tmp_path / "out.sqlite"
    build_sqlite(db_path, docs=docs, chunks=chunks, embeddings=embeddings, schema_version="0.1.0")
    conn = sqlite3.connect(db_path)
    assert conn.execute("SELECT COUNT(*) FROM docs").fetchone()[0] == 2
    assert conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0] == 3


def test_build_sqlite_fts_search_finds_chunk(tmp_path: Path, sample_corpus):
    docs, chunks, embeddings = sample_corpus
    db_path = tmp_path / "out.sqlite"
    build_sqlite(db_path, docs=docs, chunks=chunks, embeddings=embeddings, schema_version="0.1.0")
    conn = sqlite3.connect(db_path)
    rows = conn.execute(
        "SELECT chunk_id FROM fts_chunks WHERE fts_chunks MATCH ? ORDER BY rank",
        ("apple",),
    ).fetchall()
    assert len(rows) == 1
    assert rows[0][0] == "ato:test/a#0"


def test_build_sqlite_records_schema_version(tmp_path: Path, sample_corpus):
    docs, chunks, embeddings = sample_corpus
    db_path = tmp_path / "out.sqlite"
    build_sqlite(db_path, docs=docs, chunks=chunks, embeddings=embeddings, schema_version="0.1.0")
    conn = sqlite3.connect(db_path)
    row = conn.execute("SELECT value FROM meta WHERE key='schema_version'").fetchone()
    assert row[0] == "0.1.0"


def test_build_sqlite_creates_v02_tables(tmp_path, sample_corpus):
    docs, chunks, embeddings = sample_corpus
    db_path = tmp_path / "out.sqlite"
    build_sqlite(db_path, docs=docs, chunks=chunks, embeddings=embeddings, schema_version="0.2.0")
    import sqlite3
    conn = sqlite3.connect(db_path)
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert "anchors" in tables
    assert "citations" in tables
    assert "definitions" in tables
    assert "thresholds" in tables
