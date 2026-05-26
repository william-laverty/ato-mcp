"""reembed_corpus — re-encode all chunks with a new embedding model and
push the new vectors to Supabase + local SQLite.

Used when swapping embedding models (e.g. MiniLM → Granite r2). The
schema dim stays 384, so the chunks/embedding column needs no migration —
just the values get overwritten.

The encode (GPU) and Supabase upload (network) are overlapped via
asyncio: while the GPU encodes batch N+1, batch N uploads in the
background. Up to 3 uploads can be in flight at once.

Before running, drop the ivfflat index on chunks.embedding for ~3x
upload throughput — otherwise every UPDATE rewrites index entries.
Rebuild the index after with `post_reembed.sh`.

Usage:
    SUPABASE_URL=https://<ref>.supabase.co \\
    SUPABASE_SECRET_KEY=sb_secret_... \\
        uv run python -m scripts.reembed_corpus \\
            [--model ibm-granite/granite-embedding-small-english-r2] \\
            [--sqlite ~/Library/Application\\ Support/ato-mcp/live/ato.sqlite] \\
            [--batch 2000] [--encode-batch 32] [--device mps] \\
            [--max-concurrent-uploads 3]
"""
from __future__ import annotations

import argparse
import asyncio
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


async def _post_batch_async(
    client: httpx.AsyncClient,
    base_url: str,
    headers: dict,
    batch: list[dict],
    retries: int = 3,
) -> None:
    last_exc: Exception | None = None
    for attempt in range(retries):
        try:
            resp = await client.post(
                f"{base_url}/rest/v1/rpc/bulk_update_chunk_embeddings",
                headers={**headers, "Prefer": "return=minimal"},
                json={"payload": batch},
                timeout=180,
            )
            if resp.status_code < 300:
                return
            if 400 <= resp.status_code < 500:
                raise RuntimeError(
                    f"Supabase RPC {resp.status_code}: {resp.text[:500]}"
                )
            last_exc = RuntimeError(
                f"Supabase RPC {resp.status_code}: {resp.text[:200]}"
            )
        except httpx.HTTPError as e:
            last_exc = e
        await asyncio.sleep(2 ** attempt)
    assert last_exc is not None
    raise last_exc


def _encode_batch(model, texts: list[str], batch_size: int) -> np.ndarray:
    """Run synchronous embedding encode — invoked via asyncio.to_thread."""
    return model.encode(
        texts,
        batch_size=batch_size,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    ).astype(np.float32, copy=False)


async def _process(
    args,
    model,
    conn: sqlite3.Connection,
    total: int,
    supabase_url: str | None,
    supabase_key: str | None,
) -> int:
    """Iterate chunks, encode in threads, upload concurrently."""
    headers = {
        "apikey": supabase_key or "",
        "Authorization": f"Bearer {supabase_key or ''}",
        "Content-Type": "application/json",
    }

    cursor = conn.execute(
        f"SELECT chunk_id, text FROM chunks ORDER BY chunk_id "
        f"{f'LIMIT {args.limit}' if args.limit else ''}"
    )

    encode_buf: list[tuple[str, str]] = []
    pending: set[asyncio.Task] = set()
    processed = 0
    t0 = time.time()

    async with httpx.AsyncClient(http2=True) as client:

        async def drain_one() -> None:
            """Await at least one pending upload, surfacing exceptions."""
            done, _ = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
            for t in done:
                pending.discard(t)
                t.result()

        async def flush(rows: list[tuple[str, str]]) -> None:
            nonlocal processed
            if not rows:
                return
            ids = [r[0] for r in rows]
            texts = [r[1] for r in rows]

            # Encode in a worker thread so the event loop is free for uploads.
            embs = await asyncio.to_thread(
                _encode_batch, model, texts, args.encode_batch
            )

            # Local SQLite write — fast, do it synchronously.
            if not args.skip_local:
                vec_rows = [(emb.tobytes(), cid) for cid, emb in zip(ids, embs)]
                conn.executemany(
                    "UPDATE vec_chunks SET embedding = ? WHERE chunk_id = ?",
                    vec_rows,
                )
                conn.commit()

            # Schedule async upload(s) to Supabase.
            if not args.skip_supabase:
                payload = [
                    {"chunk_id": cid, "embedding": _pgvector_literal(emb)}
                    for cid, emb in zip(ids, embs)
                ]
                for i in range(0, len(payload), args.batch):
                    while len(pending) >= args.max_concurrent_uploads:
                        await drain_one()
                    task = asyncio.create_task(
                        _post_batch_async(
                            client, supabase_url, headers, payload[i : i + args.batch]
                        )
                    )
                    pending.add(task)

            processed += len(rows)
            pct = processed / total * 100
            print(
                f"  {processed}/{total} ({pct:.1f}%)  "
                f"in-flight={len(pending)}  "
                f"elapsed={time.time() - t0:.1f}s",
                flush=True,
            )

        FLUSH_EVERY = 2000
        for row in cursor:
            encode_buf.append(row)
            if len(encode_buf) >= FLUSH_EVERY:
                await flush(encode_buf)
                encode_buf = []
        await flush(encode_buf)

        # Drain any remaining uploads.
        while pending:
            await drain_one()

    return processed


async def amain(args) -> int:
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
    # Cap context so MPS doesn't OOM on the long-tail 6000-char chunks.
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

    if not args.skip_local:
        import sqlite_vec
        conn.enable_load_extension(True)
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)

    t0 = time.time()
    processed = await _process(args, model, conn, total, supabase_url, supabase_key)

    # Record the new model name in the local SQLite meta.
    if not args.skip_local:
        conn.execute(
            "INSERT INTO meta(key, value) VALUES ('embedding_model', ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (args.model,),
        )
        conn.commit()

    print(f"\nDone in {time.time() - t0:.1f}s. Updated {processed} chunks.")
    conn.close()
    return 0


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--model",
        default="ibm-granite/granite-embedding-small-english-r2",
    )
    p.add_argument(
        "--sqlite",
        type=Path,
        default=Path.home() / "Library/Application Support/ato-mcp/live/ato.sqlite",
    )
    p.add_argument("--batch", type=int, default=2000)
    p.add_argument("--encode-batch", type=int, default=32)
    p.add_argument("--device", default="mps", choices=["cpu", "mps", "cuda"])
    p.add_argument("--skip-supabase", action="store_true")
    p.add_argument("--skip-local", action="store_true")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument(
        "--max-concurrent-uploads",
        type=int,
        default=3,
        help="Cap on in-flight Supabase RPC calls",
    )
    args = p.parse_args()
    return asyncio.run(amain(args))


if __name__ == "__main__":
    raise SystemExit(main())
