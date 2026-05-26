"""reembed_corpus — re-encode all chunks with a new embedding model and
push the new vectors to Supabase + local SQLite.

Used when swapping embedding models (e.g. MiniLM → Granite r2). The
schema dim stays 384, so the chunks/embedding column needs no migration —
just the values get overwritten.

Usage:
    SUPABASE_URL=https://<ref>.supabase.co \\
    SUPABASE_SECRET_KEY=sb_secret_... \\
        uv run python -m scripts.reembed_corpus \\
            [--model ibm-granite/granite-embedding-small-english-r2] \\
            [--sqlite ~/Library/Application\\ Support/ato-mcp/live/ato.sqlite] \\
            [--batch 200] [--encode-batch 64] [--device mps]

Updates Supabase chunks.embedding in batches via PostgREST upsert
(on_conflict=chunk_id with resolution=merge-duplicates so only the
embedding column is overwritten). Also writes the new vectors back
into the local SQLite vec_chunks table.
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import sys
import time
from pathlib import Path

import httpx
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))


def _pgvector_literal(vec: np.ndarray) -> str:
    """Format a 1-D float vector for pgvector text encoding."""
    return "[" + ",".join(f"{x:.6f}" for x in vec) + "]"


def _post_batch(
    client: httpx.Client,
    base_url: str,
    headers: dict,
    batch: list[dict],
    retries: int = 3,
) -> None:
    """Bulk-update chunk embeddings via the bulk_update_chunk_embeddings RPC.

    Sending only {chunk_id, embedding} pairs as a JSONB payload — the
    function casts the embedding string to vector(384) server-side and
    runs a single UPDATE … FROM jsonb_array_elements join. Retries on
    transient 5xx / connection errors.
    """
    last_exc: Exception | None = None
    for attempt in range(retries):
        try:
            resp = client.post(
                f"{base_url}/rest/v1/rpc/bulk_update_chunk_embeddings",
                headers={**headers, "Prefer": "return=minimal"},
                json={"payload": batch},
                timeout=180,
            )
            if resp.status_code < 300:
                return
            # 4xx are deterministic; don't retry.
            if 400 <= resp.status_code < 500:
                raise RuntimeError(
                    f"Supabase RPC {resp.status_code}: {resp.text[:500]}"
                )
            last_exc = RuntimeError(
                f"Supabase RPC {resp.status_code}: {resp.text[:200]}"
            )
        except httpx.HTTPError as e:
            last_exc = e
        time.sleep(2 ** attempt)
    assert last_exc is not None
    raise last_exc


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--model",
        default="ibm-granite/granite-embedding-small-english-r2",
        help="HuggingFace sentence-transformers model name",
    )
    p.add_argument(
        "--sqlite",
        type=Path,
        default=Path.home() / "Library/Application Support/ato-mcp/live/ato.sqlite",
    )
    p.add_argument(
        "--batch",
        type=int,
        default=200,
        help="Supabase upsert batch size",
    )
    p.add_argument(
        "--encode-batch",
        type=int,
        default=64,
        help="Embedder encode batch size",
    )
    p.add_argument(
        "--device",
        default="mps",
        choices=["cpu", "mps", "cuda"],
        help="Torch device for the embedder",
    )
    p.add_argument(
        "--skip-supabase",
        action="store_true",
        help="Only update local SQLite vec_chunks, skip Supabase upload",
    )
    p.add_argument(
        "--skip-local",
        action="store_true",
        help="Only update Supabase, skip local SQLite vec_chunks rewrite",
    )
    p.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Limit number of chunks (0 = all). For smoke testing.",
    )
    args = p.parse_args()

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SECRET_KEY")
    if not args.skip_supabase and (not supabase_url or not supabase_key):
        print("Missing SUPABASE_URL or SUPABASE_SECRET_KEY", file=sys.stderr)
        return 2
    if not args.sqlite.exists():
        print(f"SQLite not found: {args.sqlite}", file=sys.stderr)
        return 2

    print(f"Loading model: {args.model} on {args.device}")
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(args.model, device=args.device)
    # ModernBERT-based Granite supports very long context; cap to 512 tokens
    # to keep MPS memory bounded and roughly match MiniLM's 256-token window
    # (slightly longer to take advantage of Granite's better long-text quality).
    model.max_seq_length = 512
    dim = getattr(
        model,
        "get_embedding_dimension",
        model.get_sentence_embedding_dimension,
    )() or 0
    if dim != 384:
        print(f"FATAL: model dim {dim} != 384", file=sys.stderr)
        return 3
    print(f"  dim={dim}, max_seq_length={model.max_seq_length}")

    conn = sqlite3.connect(args.sqlite)
    total = conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
    if args.limit:
        total = min(total, args.limit)
    print(f"Re-embedding {total} chunks")

    # Load sqlite-vec extension for local writes.
    if not args.skip_local:
        import sqlite_vec
        conn.enable_load_extension(True)
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)

    headers = {
        "apikey": supabase_key or "",
        "Authorization": f"Bearer {supabase_key or ''}",
        "Content-Type": "application/json",
    }

    t0 = time.time()
    processed = 0
    cursor = conn.execute(
        f"SELECT chunk_id, text FROM chunks ORDER BY chunk_id "
        f"{f'LIMIT {args.limit}' if args.limit else ''}"
    )
    encode_buf: list[tuple[str, str]] = []

    with httpx.Client() as client:
        def flush_encoded(rows: list[tuple[str, str]]) -> None:
            nonlocal processed
            if not rows:
                return
            ids = [r[0] for r in rows]
            texts = [r[1] for r in rows]
            embs = model.encode(
                texts,
                batch_size=args.encode_batch,
                normalize_embeddings=True,
                convert_to_numpy=True,
                show_progress_bar=False,
            ).astype(np.float32, copy=False)

            # Supabase upsert
            if not args.skip_supabase:
                payload = [
                    {"chunk_id": cid, "embedding": _pgvector_literal(emb)}
                    for cid, emb in zip(ids, embs)
                ]
                for i in range(0, len(payload), args.batch):
                    _post_batch(
                        client, supabase_url, headers, payload[i : i + args.batch]
                    )

            # Local SQLite vec_chunks rewrite — vec0 virtual tables don't
            # support INSERT OR REPLACE; do an UPDATE WHERE chunk_id=? and
            # fall back to INSERT for any rows that didn't exist.
            if not args.skip_local:
                vec_rows = [(emb.tobytes(), cid) for cid, emb in zip(ids, embs)]
                cur = conn.executemany(
                    "UPDATE vec_chunks SET embedding = ? WHERE chunk_id = ?",
                    vec_rows,
                )
                conn.commit()

            processed += len(rows)
            pct = processed / total * 100
            print(
                f"  {processed}/{total} ({pct:.1f}%)  "
                f"elapsed={time.time() - t0:.1f}s"
            )

        # Group SQLite rows into encode-sized chunks; flush every 2000 rows
        # (to bound memory and give incremental progress).
        FLUSH_EVERY = 2000
        for row in cursor:
            encode_buf.append(row)
            if len(encode_buf) >= FLUSH_EVERY:
                flush_encoded(encode_buf)
                encode_buf = []
        flush_encoded(encode_buf)

    print(f"\nDone in {time.time() - t0:.1f}s. Updated {processed} chunks.")
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
