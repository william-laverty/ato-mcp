from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import typer
from tqdm import tqdm

from .chunk import chunk_html
from .clean import clean_html, extract_title
from .config import PipelineConfig
from .embed import Embedder
from .package import build_sqlite
from .schema import Chunk, Doc
from .scrape import canonical_doc_id, crawl


app = typer.Typer(help="ato-pro corpus pipeline")


@app.command()
def build(
    out_dir: Path = typer.Option(Path("corpus-out"), help="Output directory"),
    max_total_pages: int = typer.Option(0, help="Override max_total_pages (0 = config default)"),
) -> None:
    """Run the full pipeline: scrape -> clean -> chunk -> embed -> package."""
    cfg = PipelineConfig(out_dir=out_dir)
    if max_total_pages:
        cfg = PipelineConfig(out_dir=out_dir, max_total_pages=max_total_pages)

    out_dir.mkdir(parents=True, exist_ok=True)

    typer.echo(f"[1/4] Crawling ATO (max {cfg.max_total_pages} pages)...")
    pages = asyncio.run(crawl(cfg))
    typer.echo(f"      Crawled {len(pages)} pages")

    raw_pages_path = out_dir / "pages.jsonl"
    with raw_pages_path.open("w") as f:
        for url, html in pages:
            f.write(json.dumps({"url": url, "html": html}) + "\n")

    typer.echo("[2/4] Cleaning + chunking...")
    docs: list[Doc] = []
    all_chunks: list[Chunk] = []
    seen_doc_ids: set[str] = set()
    now = datetime.now(timezone.utc).isoformat()
    for url, html in tqdm(pages):
        doc_id = canonical_doc_id(url)
        if doc_id in seen_doc_ids:
            # Two URLs canonicalised to the same doc_id (e.g. trailing-slash variants).
            # Keep the first; skip duplicates rather than producing duplicate chunk_ids.
            continue
        cleaned = clean_html(html)
        if not cleaned:
            continue
        title = extract_title(html) or url
        seen_doc_ids.add(doc_id)
        docs.append(Doc(
            doc_id=doc_id,
            source="ato",
            url=url,
            title=title,
            doc_type="ATO_GUIDE",
            retrieved_at=now,
        ))
        for raw_chunk in chunk_html(cleaned, max_chars=cfg.chunk_max_chars, overlap_chars=cfg.chunk_overlap_chars):
            all_chunks.append(Chunk(
                chunk_id=f"{doc_id}#{raw_chunk.ord}",
                doc_id=doc_id,
                ord=raw_chunk.ord,
                text=raw_chunk.text,
                heading_path=raw_chunk.heading_path,
                char_start=raw_chunk.char_start,
                char_end=raw_chunk.char_end,
            ))

    typer.echo(f"      {len(docs)} docs, {len(all_chunks)} chunks")
    if not all_chunks:
        typer.echo("No chunks produced; nothing to embed.")
        raise typer.Exit(code=1)

    typer.echo(f"[3/4] Embedding with {cfg.embedding_model}...")
    embedder = Embedder(cfg.embedding_model)
    texts = [c.text for c in all_chunks]
    embeddings = embedder.encode(texts, batch_size=64)

    db_path = out_dir / "ato.sqlite"
    typer.echo(f"[4/4] Building SQLite -> {db_path}")
    build_sqlite(db_path, docs=docs, chunks=all_chunks, embeddings=embeddings, schema_version="0.1.0")

    typer.echo(f"\nDone. DB: {db_path} ({db_path.stat().st_size / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    app()
