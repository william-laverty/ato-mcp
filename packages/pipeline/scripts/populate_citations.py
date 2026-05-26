"""populate_citations — extract citations from the local corpus and upsert
to the Supabase citations table.

This is a one-shot script that fills in the citations table for an
already-imported corpus, without requiring a full rebuild. Future pipeline
runs (cli.py build) generate citations inline, so this script only needs
to be run once (or after manually fixing the live corpus).

Usage:
    SUPABASE_URL=https://<ref>.supabase.co \\
    SUPABASE_SECRET_KEY=sb_secret_... \\
        uv run python -m ato_pipeline.scripts.populate_citations \\
            [--sqlite ~/Library/Application\\ Support/ato-mcp/live/ato.sqlite] \\
            [--batch 500]

Idempotent — relies on the (from_chunk_id, to_doc_id, COALESCE(to_anchor,
''), citation_kind) unique index and uses on_conflict=ignore semantics.
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import sys
import time
from pathlib import Path

import httpx

# Make sibling extractors module importable when run as a script.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from ato_pipeline.extractors.citations import extract_for_chunks  # noqa: E402


def _load_valid_doc_ids(conn: sqlite3.Connection) -> set[str]:
    return {row[0] for row in conn.execute("SELECT doc_id FROM docs")}


def _iter_chunks(conn: sqlite3.Connection, page: int = 5000):
    """Stream (chunk_id, text) pairs from the chunks table."""
    cursor = conn.execute("SELECT chunk_id, text FROM chunks ORDER BY chunk_id")
    while True:
        rows = cursor.fetchmany(page)
        if not rows:
            return
        for row in rows:
            yield row[0], row[1]


def _upsert_batch(
    client: httpx.Client, base_url: str, headers: dict, batch: list[dict]
) -> None:
    """POST a batch to Supabase REST with on_conflict resolution.

    Normalises to_anchor=None to '' so it matches the NOT NULL DEFAULT ''
    column and is covered by the (from_chunk_id, to_doc_id, to_anchor,
    citation_kind) unique constraint.
    """
    normalised = [
        {**row, "to_anchor": row.get("to_anchor") or ""}
        for row in batch
    ]
    resp = client.post(
        f"{base_url}/rest/v1/citations",
        headers={
            **headers,
            "Prefer": "resolution=ignore-duplicates,return=minimal",
        },
        json=normalised,
        params={"on_conflict": "from_chunk_id,to_doc_id,to_anchor,citation_kind"},
        timeout=60,
    )
    if resp.status_code >= 300:
        # Surface the first part of the error so we can debug quickly.
        raise RuntimeError(
            f"Supabase POST {resp.status_code}: {resp.text[:500]}"
        )


def main() -> int:
    p = argparse.ArgumentParser()
    default_sqlite = (
        Path.home()
        / "Library/Application Support/ato-mcp/live/ato.sqlite"
    )
    p.add_argument("--sqlite", type=Path, default=default_sqlite)
    p.add_argument("--batch", type=int, default=500)
    args = p.parse_args()

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SECRET_KEY")
    if not supabase_url or not supabase_key:
        print("Missing SUPABASE_URL or SUPABASE_SECRET_KEY", file=sys.stderr)
        return 2

    if not args.sqlite.exists():
        print(f"SQLite not found: {args.sqlite}", file=sys.stderr)
        return 2

    print(f"Reading SQLite: {args.sqlite}")
    conn = sqlite3.connect(args.sqlite)
    valid_doc_ids = _load_valid_doc_ids(conn)
    print(f"  {len(valid_doc_ids)} local docs")

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
    }

    with httpx.Client() as client:
        total_chunks_row = conn.execute("SELECT COUNT(*) FROM chunks").fetchone()
        total_chunks = total_chunks_row[0]
        print(f"  {total_chunks} chunks to scan")

        t0 = time.time()
        scanned = 0
        emitted = 0
        pending: list[dict] = []
        skipped_orphans = 0

        for chunk_id, text in _iter_chunks(conn):
            rows = extract_for_chunks([(chunk_id, text)], valid_doc_ids)
            scanned += 1
            for row in rows:
                pending.append(row)
                emitted += 1
            # Flush in BATCH-sized groups.
            while len(pending) >= args.batch:
                _upsert_batch(client, supabase_url, headers, pending[: args.batch])
                pending = pending[args.batch :]
            if scanned % 10_000 == 0:
                pct = scanned / total_chunks * 100
                print(
                    f"  scanned={scanned}/{total_chunks} ({pct:.1f}%)  "
                    f"emitted={emitted}  pending={len(pending)}  "
                    f"elapsed={time.time() - t0:.1f}s"
                )

        # Final flush.
        if pending:
            _upsert_batch(client, supabase_url, headers, pending)

    print(
        f"\nDone in {time.time() - t0:.1f}s. "
        f"Scanned {scanned} chunks, emitted {emitted} citation rows, "
        f"skipped {skipped_orphans} orphans."
    )
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
