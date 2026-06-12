"""Export the hosted Supabase corpus into a local SQLite corpus file.

The reverse of packages/mcp/scripts/import-corpus.ts. Used to cut a local-mode
corpus release that is byte-identical in content to what hosted mode serves —
useful when the source sites can't be re-scraped from the release machine
(ato.gov.au applies aggressive bot filtering).

Reads only the public-read corpus tables via PostgREST (publishable key — the
same data any onboarded client can read), pages with keyset pagination, and
writes the standard SQLite layout via the pipeline's own DDL so SqliteStore,
FTS5 and sqlite-vec behave exactly as a pipeline-built corpus.

Usage:
    uv run python scripts/export_from_supabase.py \
        --url https://<ref>.supabase.co \
        --key sb_publishable_... \
        --out corpus-out/ato.sqlite
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import time
from pathlib import Path

import httpx
import numpy as np
import sqlite_vec

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from ato_pipeline.package import (  # noqa: E402
    CORPUS_SCHEMA_VERSION,
    _SCHEMA_SQL,
    _build_fts_table,
    _build_vec_table,
)

PAGE = 1000


def rest_page(client: httpx.Client, table: str, params: dict) -> list[dict]:
    for attempt in range(5):
        try:
            r = client.get(f"/rest/v1/{table}", params=params)
            r.raise_for_status()
            return r.json()
        except (httpx.HTTPError, json.JSONDecodeError) as e:
            if attempt == 4:
                raise
            wait = 2**attempt
            print(f"  retry {table} in {wait}s ({e})", flush=True)
            time.sleep(wait)
    return []


def fetch_all(client: httpx.Client, table: str, order_col: str, select: str = "*") -> list[dict]:
    """Offset pagination — fine for the small tables."""
    rows: list[dict] = []
    offset = 0
    while True:
        batch = rest_page(
            client,
            table,
            {"select": select, "order": order_col, "limit": PAGE, "offset": offset},
        )
        rows.extend(batch)
        if len(batch) < PAGE:
            return rows
        offset += PAGE


def parse_vec(s: str | None) -> bytes | None:
    if not s:
        return None
    return np.asarray(json.loads(s), dtype=np.float32).tobytes()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--key", required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    client = httpx.Client(
        base_url=args.url,
        headers={"apikey": args.key, "Authorization": f"Bearer {args.key}"},
        timeout=120,
    )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    if args.out.exists():
        args.out.unlink()
    conn = sqlite3.connect(args.out)
    conn.enable_load_extension(True)
    sqlite_vec.load(conn)
    conn.enable_load_extension(False)
    conn.executescript(_SCHEMA_SQL)
    _build_vec_table(conn)
    _build_fts_table(conn)
    conn.execute(
        "INSERT INTO meta(key, value) VALUES ('schema_version', ?)", (CORPUS_SCHEMA_VERSION,)
    )

    print("docs ...", flush=True)
    docs = fetch_all(client, "docs", "doc_id")
    conn.executemany(
        "INSERT OR REPLACE INTO docs VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [
            (
                d["doc_id"], d["source"], d["url"], d["title"], d["jurisdiction"],
                d["doc_type"], d["effective_from"], d["effective_to"], d["published_at"],
                d["retrieved_at"], json.dumps(d.get("metadata") or {}),
            )
            for d in docs
        ],
    )
    conn.commit()
    print(f"  {len(docs)} docs", flush=True)

    print("chunks (keyset paging) ...", flush=True)
    n_chunks = 0
    last_id = ""
    while True:
        params = {
            "select": "chunk_id,doc_id,ord,text,heading_path,effective_from,effective_to,char_start,char_end,embedding",
            "order": "chunk_id",
            "limit": PAGE,
        }
        if last_id:
            params["chunk_id"] = f"gt.{last_id}"
        batch = rest_page(client, "chunks", params)
        if not batch:
            break
        conn.executemany(
            "INSERT OR REPLACE INTO chunks VALUES (?,?,?,?,?,?,?,?,?)",
            [
                (
                    c["chunk_id"], c["doc_id"], c["ord"], c["text"],
                    json.dumps(c.get("heading_path") or []),
                    c["effective_from"], c["effective_to"],
                    c["char_start"], c["char_end"],
                )
                for c in batch
            ],
        )
        conn.executemany(
            "INSERT INTO fts_chunks(chunk_id, text) VALUES (?,?)",
            [(c["chunk_id"], c["text"]) for c in batch],
        )
        vec_rows = [
            (c["chunk_id"], parse_vec(c.get("embedding")))
            for c in batch
            if c.get("embedding")
        ]
        conn.executemany("INSERT INTO vec_chunks(chunk_id, embedding) VALUES (?,?)", vec_rows)
        conn.commit()
        n_chunks += len(batch)
        last_id = batch[-1]["chunk_id"]
        if n_chunks % 10000 < PAGE:
            print(f"  {n_chunks} chunks ...", flush=True)
        if len(batch) < PAGE:
            break
    print(f"  {n_chunks} chunks total", flush=True)

    print("anchors / citations / definitions / thresholds ...", flush=True)
    anchors = fetch_all(client, "anchors", "anchor_id")
    conn.executemany(
        "INSERT OR REPLACE INTO anchors VALUES (?,?,?,?)",
        [(a["anchor_id"], a["doc_id"], a["anchor_name"], a["chunk_id"]) for a in anchors],
    )
    citations = fetch_all(
        client, "citations", "id", select="from_chunk_id,to_doc_id,to_anchor,citation_kind"
    )
    conn.executemany(
        "INSERT OR REPLACE INTO citations VALUES (?,?,?,?)",
        [
            (c["from_chunk_id"], c["to_doc_id"], c.get("to_anchor") or "", c["citation_kind"])
            for c in citations
        ],
    )
    definitions = fetch_all(
        client, "definitions", "id",
        select="term,doc_id,anchor_id,body,effective_from,effective_to",
    )
    conn.executemany(
        "INSERT OR REPLACE INTO definitions VALUES (?,?,?,?,?,?)",
        [
            (d["term"], d["doc_id"], d.get("anchor_id"), d["body"], d["effective_from"], d["effective_to"])
            for d in definitions
        ],
    )
    thresholds = fetch_all(
        client, "thresholds", "id",
        select="name,value,unit,effective_from,effective_to,source_doc_id,source_anchor",
    )
    conn.executemany(
        "INSERT OR REPLACE INTO thresholds VALUES (?,?,?,?,?,?,?)",
        [
            (t["name"], t["value"], t["unit"], t["effective_from"], t["effective_to"],
             t.get("source_doc_id"), t.get("source_anchor"))
            for t in thresholds
        ],
    )
    conn.commit()
    print(
        f"  {len(anchors)} anchors, {len(citations)} citations, "
        f"{len(definitions)} definitions, {len(thresholds)} thresholds",
        flush=True,
    )

    # Sanity gates — refuse to produce a corpus that is obviously incomplete.
    assert len(docs) > 29000, f"docs too low: {len(docs)}"
    assert n_chunks > 220000, f"chunks too low: {n_chunks}"
    assert len(thresholds) == 8, f"thresholds != 8: {len(thresholds)}"
    assert len(citations) > 23000, f"citations too low: {len(citations)}"

    conn.execute("VACUUM")
    conn.close()
    print(f"OK -> {args.out}", flush=True)


if __name__ == "__main__":
    main()
