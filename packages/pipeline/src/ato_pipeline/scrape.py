from __future__ import annotations

import asyncio
import re
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


_LOC_RE = re.compile(r"<loc>(.*?)</loc>", re.IGNORECASE | re.DOTALL)


async def fetch_sitemap_urls(config: PipelineConfig) -> list[str]:
    """Fetch the ATO XML sitemap and return URLs matching the include prefixes."""
    headers = {"User-Agent": config.user_agent}
    async with httpx.AsyncClient(
        timeout=config.request_timeout_s, headers=headers, http2=True
    ) as client:
        resp = await client.get(config.sitemap_url, follow_redirects=True)
        resp.raise_for_status()
        text = resp.text

    raw_urls = [m.strip() for m in _LOC_RE.findall(text)]
    prefixes = tuple(p for p in config.sitemap_include_prefixes if p)
    if not prefixes:
        return raw_urls
    seen: set[str] = set()
    filtered: list[str] = []
    for url in raw_urls:
        if not url.startswith(prefixes):
            continue
        canon = _strip_url(url)
        if canon in seen:
            continue
        seen.add(canon)
        filtered.append(canon)
    return filtered


async def crawl_from_sitemap(
    config: PipelineConfig,
    progress_cb=None,
) -> list[tuple[str, str]]:
    """Fetch the ATO sitemap, filter to relevant sections, and download each URL.

    progress_cb: optional callable invoked with (fetched, total) after each page.
    """
    urls = await fetch_sitemap_urls(config)
    if config.max_total_pages and config.max_total_pages > 0:
        urls = urls[: config.max_total_pages]
    total = len(urls)

    out: list[tuple[str, str]] = []
    semaphore = asyncio.Semaphore(config.request_concurrency)
    headers = {"User-Agent": config.user_agent}
    fetched = 0
    lock = asyncio.Lock()

    async with httpx.AsyncClient(
        timeout=config.request_timeout_s, headers=headers, http2=True
    ) as client:
        async def worker(url: str) -> None:
            nonlocal fetched
            async with semaphore:
                html, status = await fetch_page(client, url)
                await asyncio.sleep(config.request_per_host_delay_s)
            async with lock:
                fetched += 1
                if progress_cb:
                    progress_cb(fetched, total)
                if status == 200 and html:
                    out.append((url, html))

        await asyncio.gather(*(worker(u) for u in urls))

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
