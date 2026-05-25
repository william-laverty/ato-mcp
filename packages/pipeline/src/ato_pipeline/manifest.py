"""manifest.py — build a release manifest and compress an ato.sqlite corpus with zstd.

Usage (as a module):
    python -m ato_pipeline.manifest \
        --db corpus-out/ato.sqlite \
        --out corpus-out/manifest.json \
        --zst corpus-out/ato-corpus-v2026.05.sqlite.zst
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path

import pyzstd
import typer

from .config import PipelineConfig

EMBEDDING_MODEL = PipelineConfig().embedding_model
EMBEDDING_DIM = 384
_COMPRESS_LEVEL = 19
_READ_CHUNK = 1024 * 1024  # 1 MiB


def build_manifest(db_path: Path, embedding_model: str = EMBEDDING_MODEL) -> dict:
    """Compute sha256 + sizes for *db_path* and return a manifest dict.

    The manifest is computed over the **uncompressed** SQLite file.
    """
    sha = hashlib.sha256()
    size = 0
    with db_path.open("rb") as fh:
        while True:
            chunk = fh.read(_READ_CHUNK)
            if not chunk:
                break
            sha.update(chunk)
            size += len(chunk)
    return {
        "schema_version": "0.2.0",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "embedding_model": embedding_model,
        "embedding_dim": EMBEDDING_DIM,
        "corpus_sha256": sha.hexdigest(),
        "uncompressed_size": size,
    }


def compress_corpus(db_path: Path, out_path: Path, level: int = _COMPRESS_LEVEL) -> int:
    """Compress *db_path* to *out_path* using zstd.  Returns compressed size in bytes."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with db_path.open("rb") as src, pyzstd.ZstdFile(
        out_path, mode="wb", level_or_option=level
    ) as dst:
        while True:
            data = src.read(_READ_CHUNK)
            if not data:
                break
            dst.write(data)
    return out_path.stat().st_size


def package(
    db_path: Path,
    manifest_path: Path,
    zst_path: Path,
    embedding_model: str = EMBEDDING_MODEL,
) -> dict:
    """Build manifest + zstd artefact for a completed ato.sqlite corpus.

    Returns the manifest dict with *compressed_size* added.
    """
    manifest = build_manifest(db_path, embedding_model=embedding_model)
    compressed_size = compress_corpus(db_path, zst_path)
    manifest["compressed_size"] = compressed_size
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


# ---------------------------------------------------------------------------
# CLI — invoked via `python -m ato_pipeline.manifest` or `ato-pipeline package`
# ---------------------------------------------------------------------------

app = typer.Typer(help="Build release manifest + zstd corpus artefact")


@app.command()
def main(
    db: Path = typer.Option(..., help="Path to built ato.sqlite"),
    out: Path = typer.Option(..., help="Path to write manifest.json"),
    zst: Path = typer.Option(..., help="Path to write compressed .sqlite.zst"),
    model: str = typer.Option(EMBEDDING_MODEL, help="Embedding model name"),
) -> None:
    """Build manifest + compressed corpus artefact from a completed ato.sqlite."""
    if not db.exists():
        typer.echo(f"Error: database not found: {db}", err=True)
        raise typer.Exit(code=1)
    typer.echo(f"Building manifest for {db} ...")
    manifest = package(db, out, zst, embedding_model=model)
    typer.echo(f"  corpus_sha256:     {manifest['corpus_sha256']}")
    typer.echo(f"  uncompressed_size: {manifest['uncompressed_size']:,} bytes")
    typer.echo(f"  compressed_size:   {manifest['compressed_size']:,} bytes")
    typer.echo(f"Wrote manifest -> {out}")
    typer.echo(f"Wrote corpus   -> {zst}")


if __name__ == "__main__":
    app()
