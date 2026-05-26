"""search_smoke — quick A/B smoke of corpus search quality.

Runs a small set of representative AU tax queries against the live
api.ato-mcp.com.au and prints the top-5 hits per query. Used after
swapping embedding models or making other corpus changes to spot
obvious regressions before believing the deploy is good.

Usage:
    export BACKEND_BEARER=atompro_v1_smoke_test_token
    uv run python -m scripts.search_smoke [--mode hybrid|vector|keyword]
"""
from __future__ import annotations

import argparse
import os
import sys
import time

import httpx


QUERIES = [
    "general deductions section 8-1 ordinary income",
    "small business CGT concessions 15-year exemption",
    "GST registration threshold sole trader",
    "instant asset write-off threshold 2024-25",
    "concessional superannuation contributions cap",
    "PAYG withholding obligations for contractors",
    "rental property repairs vs improvements deduction",
    "fringe benefits tax car parking exemption",
    "capital gains tax discount holding period",
    "work from home deduction methods fixed rate",
]


def search(client: httpx.Client, base: str, token: str, query: str, mode: str, k: int):
    resp = client.post(
        f"{base}/search",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={"query": query, "k": k, "mode": mode, "include_old": False},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--base", default="https://api.ato-mcp.com.au")
    p.add_argument("--mode", default="hybrid", choices=["hybrid", "vector", "keyword"])
    p.add_argument("--k", type=int, default=5)
    args = p.parse_args()

    token = os.environ.get("BACKEND_BEARER")
    if not token:
        print("Missing BACKEND_BEARER env var", file=sys.stderr)
        return 2

    with httpx.Client() as c:
        for q in QUERIES:
            t0 = time.time()
            try:
                result = search(c, args.base, token, q, args.mode, args.k)
            except httpx.HTTPError as e:
                print(f"\n## {q}\n  ERROR: {e}")
                continue
            elapsed = (time.time() - t0) * 1000
            hits = result.get("hits", [])
            print(f"\n## {q}  ({elapsed:.0f}ms, {len(hits)} hits)")
            for h in hits[: args.k]:
                title = (h.get("title") or "")[:55]
                cid = h.get("chunk_id", "")
                score = h.get("score", 0.0)
                print(f"  {score:.4f}  {cid:<50}  {title}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
