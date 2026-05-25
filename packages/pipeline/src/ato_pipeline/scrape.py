from __future__ import annotations

import asyncio
from collections import deque
from urllib.parse import urldefrag, urljoin, urlparse, urlunparse

import httpx
from selectolax.parser import HTMLParser

from .config import PipelineConfig


ATO_HOST = "www.ato.gov.au"


def canonical_doc_id(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path.strip("/")
    return f"ato:{path}"


def _strip_url(url: str) -> str:
    """Drop query and fragment for canonicalisation."""
    parsed = urlparse(url)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))


async def fetch_page(client: httpx.AsyncClient, url: str) -> tuple[str, int]:
    try:
        resp = await client.get(url, follow_redirects=True)
        return (resp.text if resp.status_code == 200 else "", resp.status_code)
    except httpx.HTTPError:
        return ("", 0)


def discover_links_from_page(html: str, base_url: str) -> list[str]:
    tree = HTMLParser(html)
    out: list[str] = []
    seen: set[str] = set()
    for a in tree.css("a[href]"):
        href = a.attributes.get("href") or ""
        if not href or href.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        absolute = urljoin(base_url, href)
        absolute, _ = urldefrag(absolute)
        parsed = urlparse(absolute)
        if parsed.netloc != ATO_HOST or parsed.scheme not in ("http", "https"):
            continue
        absolute = _strip_url(absolute)
        if absolute in seen:
            continue
        seen.add(absolute)
        out.append(absolute)
    return out


async def crawl(config: PipelineConfig) -> list[tuple[str, str]]:
    """BFS crawl from each seed, returning [(url, html), ...]."""
    visited: set[str] = set()
    out: list[tuple[str, str]] = []
    semaphore = asyncio.Semaphore(config.request_concurrency)
    headers = {"User-Agent": config.user_agent}

    async with httpx.AsyncClient(
        timeout=config.request_timeout_s, headers=headers, http2=True
    ) as client:
        for seed in config.ato_seeds:
            if len(out) >= config.max_total_pages:
                break
            seed_url = _strip_url(seed)
            queue: deque[str] = deque([seed_url])
            seed_count = 0
            while queue and seed_count < config.max_pages_per_seed and len(out) < config.max_total_pages:
                url = queue.popleft()
                if url in visited:
                    continue
                visited.add(url)

                async with semaphore:
                    html, status = await fetch_page(client, url)
                    await asyncio.sleep(config.request_per_host_delay_s)

                if status != 200 or not html:
                    continue
                out.append((url, html))
                seed_count += 1
                for link in discover_links_from_page(html, url):
                    if link not in visited:
                        queue.append(link)

    return out
