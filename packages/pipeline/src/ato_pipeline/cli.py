from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import typer
from tqdm import tqdm

from .chunk import chunk_html
from .clean import clean_html, extract_title
from .config import PipelineConfig
from .embed import Embedder
from .package import CORPUS_SCHEMA_VERSION, build_sqlite
from .schema import Chunk, Doc
from .scrape import canonical_doc_id, crawl, crawl_from_sitemap
from . import manifest as _manifest_mod


app = typer.Typer(help="ato-mcp corpus pipeline")


@app.command()
def build(
    out_dir: Path = typer.Option(Path("corpus-out"), help="Output directory"),
    max_total_pages: int = typer.Option(
        0, help="Override max_total_pages for ato_website (0 = config default)"
    ),
    mode: str = typer.Option(
        "sitemap", help="ATO crawl mode: 'sitemap' (default, broad) or 'bfs' (legacy seeds)"
    ),
    sources: str = typer.Option(
        "ato_website",
        help=(
            "Comma-separated list of content sources to include. "
            "Options: ato_website, legislation, thresholds, law_ato. "
            "Default: ato_website"
        ),
    ),
) -> None:
    """Run the full pipeline: scrape -> clean -> chunk -> embed -> package."""
    cfg = PipelineConfig(out_dir=out_dir)
    if max_total_pages:
        cfg = PipelineConfig(out_dir=out_dir, max_total_pages=max_total_pages)

    out_dir.mkdir(parents=True, exist_ok=True)

    enabled = [s.strip() for s in sources.split(",") if s.strip()]

    all_docs: list[Doc] = []
    all_chunks: list[Chunk] = []
    all_anchors: list[dict[str, Any]] = []
    all_citations: list[dict[str, Any]] = []
    all_definitions: list[dict[str, Any]] = []
    all_thresholds: list[dict[str, Any]] = []
    seen_doc_ids: set[str] = set()

    # ------------------------------------------------------------------
    # Source: ato_website — scrape the ATO public website
    # ------------------------------------------------------------------
    if "ato_website" in enabled:
        if mode == "sitemap":
            typer.echo(
                f"[ato_website] Crawling ATO via sitemap "
                f"(max {cfg.max_total_pages or 'unlimited'} pages)..."
            )
            pbar: tqdm | None = None

            def progress(fetched: int, total: int) -> None:
                nonlocal pbar
                if pbar is None:
                    pbar = tqdm(total=total, desc="      scrape", mininterval=1.0)
                pbar.update(fetched - pbar.n)
                if fetched == total:
                    pbar.close()

            pages = asyncio.run(crawl_from_sitemap(cfg, progress_cb=progress))
        elif mode == "bfs":
            typer.echo(
                f"[ato_website] BFS crawl from seeds "
                f"(max {cfg.max_total_pages} pages)..."
            )
            pages = asyncio.run(crawl(cfg))
        else:
            typer.echo(f"Unknown mode: {mode!r}. Use 'sitemap' or 'bfs'.", err=True)
            raise typer.Exit(code=2)

        typer.echo(f"      Crawled {len(pages)} pages")

        raw_pages_path = out_dir / "pages.jsonl"
        with raw_pages_path.open("w") as f:
            for url, html in pages:
                f.write(json.dumps({"url": url, "html": html}) + "\n")

        typer.echo("[ato_website] Cleaning + chunking...")
        now = datetime.now(timezone.utc).isoformat()
        for url, html in tqdm(pages):
            doc_id = canonical_doc_id(url)
            if doc_id in seen_doc_ids:
                continue
            cleaned = clean_html(html)
            if not cleaned:
                continue
            title = extract_title(html) or url
            seen_doc_ids.add(doc_id)
            all_docs.append(
                Doc(
                    doc_id=doc_id,
                    source="ato",
                    url=url,
                    title=title,
                    doc_type="ATO_GUIDE",
                    retrieved_at=now,
                )
            )
            for raw_chunk in chunk_html(
                cleaned,
                max_chars=cfg.chunk_max_chars,
                overlap_chars=cfg.chunk_overlap_chars,
            ):
                all_chunks.append(
                    Chunk(
                        chunk_id=f"{doc_id}#{raw_chunk.ord}",
                        doc_id=doc_id,
                        ord=raw_chunk.ord,
                        text=raw_chunk.text,
                        heading_path=raw_chunk.heading_path,
                        char_start=raw_chunk.char_start,
                        char_end=raw_chunk.char_end,
                    )
                )
        typer.echo(f"      {len(all_docs)} docs, {len(all_chunks)} chunks")

    # ------------------------------------------------------------------
    # Source: legislation — Federal Register of Legislation
    # ------------------------------------------------------------------
    if "legislation" in enabled:
        from .sources.legislation import LegislationSource

        typer.echo("[legislation] Fetching Federal Register compilations...")
        src = LegislationSource(cfg)
        leg_out = asyncio.run(src.fetch())

        # Deduplicate by doc_id.
        new_docs = 0
        for doc in leg_out.docs:
            if doc.doc_id not in seen_doc_ids:
                seen_doc_ids.add(doc.doc_id)
                all_docs.append(doc)
                new_docs += 1
        for chunk in leg_out.chunks:
            if chunk.doc_id in seen_doc_ids:
                all_chunks.append(chunk)
        all_anchors.extend(leg_out.anchors)
        all_citations.extend(leg_out.citations)
        all_definitions.extend(leg_out.definitions)
        all_thresholds.extend(leg_out.thresholds)

        typer.echo(
            f"      {new_docs} legislation docs, "
            f"{len(leg_out.chunks)} chunks, "
            f"{len(leg_out.definitions)} definitions"
        )

    # ------------------------------------------------------------------
    # Source: thresholds — regex-based threshold extractors
    # ------------------------------------------------------------------
    if "thresholds" in enabled:
        import httpx as _httpx

        from .extractors.thresholds import extract_all

        typer.echo("[thresholds] Extracting tax thresholds from ATO...")
        try:
            headers = {"User-Agent": cfg.user_agent}
            thresh_rows = asyncio.run(
                _fetch_thresholds(headers, cfg.request_timeout_s)
            )
            all_thresholds.extend(thresh_rows)
            typer.echo(f"      {len(thresh_rows)} threshold rows extracted")
        except Exception as exc:
            typer.echo(f"      WARNING: threshold extraction failed: {exc}", err=True)

    # ------------------------------------------------------------------
    # Source: law_ato — ATO Legal Database public rulings
    # ------------------------------------------------------------------
    if "law_ato" in enabled:
        from .sources.law_ato import LawAtoSource

        typer.echo("[law_ato] Fetching ATO public rulings from law.ato.gov.au...")
        src_law = LawAtoSource(cfg)
        law_out = asyncio.run(src_law.fetch())

        new_docs = 0
        for doc in law_out.docs:
            if doc.doc_id not in seen_doc_ids:
                seen_doc_ids.add(doc.doc_id)
                all_docs.append(doc)
                new_docs += 1
        for chunk in law_out.chunks:
            if chunk.doc_id in seen_doc_ids:
                all_chunks.append(chunk)
        all_anchors.extend(law_out.anchors)
        all_citations.extend(law_out.citations)
        all_definitions.extend(law_out.definitions)
        all_thresholds.extend(law_out.thresholds)

        typer.echo(
            f"      {new_docs} ruling docs, "
            f"{len(law_out.chunks)} chunks"
        )

    # ------------------------------------------------------------------
    # Guard: need at least some chunks to embed
    # ------------------------------------------------------------------
    if not all_chunks:
        typer.echo("No chunks produced; nothing to embed.", err=True)
        raise typer.Exit(code=1)

    typer.echo(
        f"\nTotal: {len(all_docs)} docs, {len(all_chunks)} chunks, "
        f"{len(all_definitions)} definitions, {len(all_thresholds)} thresholds"
    )

    # Dedupe chunks by chunk_id (safety net).
    seen_chunk_ids: set[str] = set()
    deduped_chunks: list[Chunk] = []
    for c in all_chunks:
        if c.chunk_id not in seen_chunk_ids:
            seen_chunk_ids.add(c.chunk_id)
            deduped_chunks.append(c)
    all_chunks = deduped_chunks

    typer.echo(f"[3/4] Embedding {len(all_chunks)} chunks with {cfg.embedding_model}...")
    embedder = Embedder(cfg.embedding_model)
    texts = [c.text for c in all_chunks]
    embeddings = embedder.encode(texts, batch_size=64)

    db_path = out_dir / "ato.sqlite"
    typer.echo(f"[4/4] Building SQLite -> {db_path}")
    build_sqlite(
        db_path,
        docs=all_docs,
        chunks=all_chunks,
        embeddings=embeddings,
        schema_version=CORPUS_SCHEMA_VERSION,
        anchors=all_anchors or None,
        citations=all_citations or None,
        definitions=all_definitions or None,
        thresholds=all_thresholds or None,
    )

    typer.echo(
        f"\nDone. DB: {db_path} ({db_path.stat().st_size / 1024 / 1024:.1f} MB)"
    )


async def _fetch_thresholds(headers: dict, timeout: float) -> list[dict]:
    import httpx

    from .extractors.thresholds import extract_all

    async with httpx.AsyncClient(
        timeout=timeout, headers=headers, follow_redirects=True, http2=True
    ) as client:
        return await extract_all(client)


@app.command()
def package(
    db: Path = typer.Option(..., help="Path to built ato.sqlite"),
    out: Path = typer.Option(..., help="Path to write manifest.json"),
    zst: Path = typer.Option(..., help="Path to write compressed .sqlite.zst"),
    model: str = typer.Option(
        _manifest_mod.EMBEDDING_MODEL, help="Embedding model name recorded in manifest"
    ),
) -> None:
    """Build a release manifest + zstd-compressed corpus file from a completed ato.sqlite."""
    if not db.exists():
        typer.echo(f"Error: database not found: {db}", err=True)
        raise typer.Exit(code=1)
    typer.echo(f"Packaging {db} ...")
    manifest = _manifest_mod.package(db, out, zst, embedding_model=model)
    typer.echo(f"  corpus_sha256:     {manifest['corpus_sha256']}")
    typer.echo(f"  uncompressed_size: {manifest['uncompressed_size']:,} bytes")
    typer.echo(f"  compressed_size:   {manifest['compressed_size']:,} bytes")
    typer.echo(f"Wrote manifest -> {out}")
    typer.echo(f"Wrote corpus   -> {zst}")


if __name__ == "__main__":
    app()
