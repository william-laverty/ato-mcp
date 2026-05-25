"""Tests for ato_pipeline.manifest — manifest builder and zstd compression.

The fixture SQLite is a 5-byte file (b"hello").  The tests pin the sha256 of
that content so regressions in the hash logic are immediately visible.
"""
from __future__ import annotations

import hashlib
import json
import sqlite3

import pyzstd
import pytest

from ato_pipeline.manifest import build_manifest, compress_corpus, package


# Precomputed sha256 of b"hello" (5 bytes)
_HELLO_SHA256 = hashlib.sha256(b"hello").hexdigest()


@pytest.fixture()
def tiny_db(tmp_path):
    """Return a path to a tiny SQLite file whose raw bytes start with b'hello'."""
    db_path = tmp_path / "tiny.sqlite"
    # Write a trivial SQLite so the file exists and has predictable raw content.
    # We actually write raw bytes for a deterministic hash fixture.
    db_path.write_bytes(b"hello")
    return db_path


# ---------------------------------------------------------------------------
# build_manifest
# ---------------------------------------------------------------------------

def test_build_manifest_sha256(tiny_db):
    manifest = build_manifest(tiny_db)
    assert manifest["corpus_sha256"] == _HELLO_SHA256


def test_build_manifest_uncompressed_size(tiny_db):
    manifest = build_manifest(tiny_db)
    assert manifest["uncompressed_size"] == 5


def test_build_manifest_required_keys(tiny_db):
    manifest = build_manifest(tiny_db)
    for key in ("schema_version", "generated_at", "embedding_model", "embedding_dim",
                "corpus_sha256", "uncompressed_size"):
        assert key in manifest, f"Missing key: {key}"


def test_build_manifest_embedding_model(tiny_db):
    manifest = build_manifest(tiny_db, embedding_model="test/model-v1")
    assert manifest["embedding_model"] == "test/model-v1"
    assert manifest["embedding_dim"] == 384


# ---------------------------------------------------------------------------
# compress_corpus
# ---------------------------------------------------------------------------

def test_compress_corpus_produces_valid_zst(tiny_db, tmp_path):
    zst_path = tmp_path / "tiny.sqlite.zst"
    size = compress_corpus(tiny_db, zst_path)
    assert zst_path.exists()
    assert size == zst_path.stat().st_size
    assert size > 0
    # Verify we can decompress back to original bytes
    recovered = pyzstd.decompress(zst_path.read_bytes())
    assert recovered == b"hello"


def test_compress_corpus_creates_parent_dirs(tiny_db, tmp_path):
    zst_path = tmp_path / "subdir" / "nested" / "tiny.sqlite.zst"
    compress_corpus(tiny_db, zst_path)
    assert zst_path.exists()


# ---------------------------------------------------------------------------
# package (integration — manifest + compress + write JSON)
# ---------------------------------------------------------------------------

def test_package_writes_manifest_json(tiny_db, tmp_path):
    manifest_path = tmp_path / "manifest.json"
    zst_path = tmp_path / "tiny.sqlite.zst"
    result = package(tiny_db, manifest_path, zst_path)
    assert manifest_path.exists()
    loaded = json.loads(manifest_path.read_text())
    assert loaded["corpus_sha256"] == _HELLO_SHA256
    assert loaded["compressed_size"] > 0
    assert loaded["compressed_size"] == result["compressed_size"]


def test_package_zst_roundtrips(tiny_db, tmp_path):
    manifest_path = tmp_path / "manifest.json"
    zst_path = tmp_path / "tiny.sqlite.zst"
    package(tiny_db, manifest_path, zst_path)
    recovered = pyzstd.decompress(zst_path.read_bytes())
    assert recovered == b"hello"


def test_package_compressed_size_in_manifest(tiny_db, tmp_path):
    manifest_path = tmp_path / "manifest.json"
    zst_path = tmp_path / "tiny.sqlite.zst"
    result = package(tiny_db, manifest_path, zst_path)
    assert "compressed_size" in result
    assert result["compressed_size"] == zst_path.stat().st_size


# ---------------------------------------------------------------------------
# Real SQLite fixture (has a meta table like the actual corpus)
# ---------------------------------------------------------------------------

@pytest.fixture()
def real_sqlite_db(tmp_path):
    db_path = tmp_path / "corpus.sqlite"
    conn = sqlite3.connect(db_path)
    conn.execute("CREATE TABLE meta(k TEXT, v TEXT)")
    conn.execute("INSERT INTO meta VALUES ('schema_version','0.2.0')")
    conn.commit()
    conn.close()
    return db_path


def test_build_manifest_on_real_sqlite(real_sqlite_db):
    manifest = build_manifest(real_sqlite_db)
    raw = real_sqlite_db.read_bytes()
    expected_sha = hashlib.sha256(raw).hexdigest()
    assert manifest["corpus_sha256"] == expected_sha
    assert manifest["uncompressed_size"] == len(raw)
    assert manifest["schema_version"] == "0.2.0"
