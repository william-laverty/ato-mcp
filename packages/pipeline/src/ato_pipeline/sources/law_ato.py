"""ATO Legal Database scraper for public rulings.

Fetches public rulings from the ATO Legal Database (www.ato.gov.au/law) via the
internal Teratext browse API, which serves SSR HTML fragments without requiring
JavaScript execution.

Discovery path:
    1. For each ruling type, fetch the parent TOC node via the browse API.
       URL: GET /API/v1/law/lawservices/browse?Mode=type&ImA=folder&Node={node}&TOC={toc}
    2. Parse the returned HTML to discover year/sub-nodes (``jstree-closed`` items).
    3. Expand each year/sub-node to get leaf document items (``rel="document"``).
    4. Extract DOCID from each leaf URL: DOCID=%22{raw_docid}%22
    5. Fetch each document at:
       https://www.ato.gov.au/law/view/view.htm?docid={raw_docid}
    6. Parse metadata from <meta> tags and body from #LawContent div.

DOCID patterns observed:
    TR:   TXR/TR{YEAR}{N}/NAT/ATO/00001
    TD:   TXD/TD{YEAR}{N}/NAT/ATO/00001
    GSTR: GST/GSTR{YEAR}{N}/NAT/ATO/00001
    GSTD: GST/GSTD{YEAR}{N}/NAT/ATO/00001
    CR:   CTR/CR{YEAR}{N}/NAT/ATO/00001
    PR:   PRR/PR{YEAR}{N}/NAT/ATO/00001
    LCR:  NYI/LCR{YEAR}{N}/NAT/ATO/00001   (Law companion guideline/ruling)
    PCG:  COG/PCG{YEAR}{N}/NAT/ATO/00001
    MT:   (varies, inferred from browse)
    FTR:  FTR/FTR{YEAR}{N}/NAT/ATO/00001
"""
from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import unquote, urlparse, parse_qs

import httpx
from selectolax.parser import HTMLParser

from ..chunk import chunk_html
from ..clean import clean_html
from ..config import PipelineConfig
from ..schema import Chunk, Doc
from .base import Source, SourceOutput


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://www.ato.gov.au"
BROWSE_API = BASE_URL + "/API/v1/law/lawservices/browse"
DOC_URL = BASE_URL + "/law/view/view.htm"

# Map from our ruling type code to TOC-tree configuration.
# ``node``:  the parent browse-tree node containing year/sub-nodes for this type.
# ``toc``:   the TOC parameter value for that parent node.
# ``doc_type``: the DocType literal value in schema.py.
# ``single_page``: True means the type has no year subfolders — items appear
#                  directly under the parent node (e.g. CR/PR/LCR use year nodes
#                  but MT/FTR may be very small and flat).
TYPE_CONFIG: dict[str, dict[str, Any]] = {
    "TXR": {
        "doc_type": "ATO_RULING_TR",
        "node": "1-0-1",
        "toc": "04:Public rulings:Rulings:Taxation",
        "open_nodes": "1,1-0",
        "has_year_nodes": True,
    },
    "TXD": {
        "doc_type": "ATO_RULING_TD",
        "node": "1-1-0",
        "toc": "04:Public rulings:Determinations:Taxation",
        "open_nodes": "1,1-1",
        "has_year_nodes": True,
    },
    "GST": {  # GSTR
        "doc_type": "ATO_RULING_GSTR",
        "node": "1-0-2",
        "toc": "04:Public rulings:Rulings:Goods and services tax",
        "open_nodes": "1,1-0",
        "has_year_nodes": True,
    },
    "GSTD": {  # GSTD
        "doc_type": "ATO_RULING_GSTD",
        "node": "1-1-1",
        "toc": "04:Public rulings:Determinations:Goods and services tax",
        "open_nodes": "1,1-1",
        "has_year_nodes": True,
    },
    "CTR": {  # Class Rulings
        "doc_type": "ATO_RULING_CR",
        "node": "1-0-10",
        "toc": "04:Public rulings:Rulings:Class",
        "open_nodes": "1,1-0",
        "has_year_nodes": True,
    },
    "PRR": {  # Product Rulings
        "doc_type": "ATO_RULING_PR",
        "node": "1-0-11",
        "toc": "04:Public rulings:Rulings:Product",
        "open_nodes": "1,1-0",
        "has_year_nodes": True,
    },
    "NYI": {  # Law Companion Rulings/Guidelines
        "doc_type": "ATO_RULING_LCR",
        "node": "1-0-0",
        "toc": "04:Public rulings:Rulings:Law companion",
        "open_nodes": "1,1-0",
        "has_year_nodes": True,
    },
    "COG": {  # Practical Compliance Guidelines
        "doc_type": "ATO_RULING_PCG",
        "node": "2",
        "toc": "02:Practical compliance guidelines",
        "open_nodes": "",
        "has_year_nodes": True,
    },
    "MXR": {  # Miscellaneous Tax Rulings
        "doc_type": "ATO_RULING_MT",
        "node": "1-0-3",
        "toc": "04:Public rulings:Rulings:Miscellaneous tax",
        "open_nodes": "1,1-0",
        "has_year_nodes": True,
    },
    "FTR": {  # Fuel Tax Rulings
        "doc_type": "ATO_RULING_FTR",
        "node": "1-0-6",
        "toc": "04:Public rulings:Rulings:Fuel tax",
        "open_nodes": "1,1-0",
        "has_year_nodes": True,
    },
}

# Human-readable doc type prefix -> internal type code (for DOCID extraction).
# The DOCID prefix is the first component before the first "/".
DOCID_PREFIX_TO_TYPE: dict[str, str] = {
    "TXR": "TXR",
    "TXD": "TXD",
    "GST": "GST",
    "CTR": "CTR",
    "PRR": "PRR",
    "NYI": "NYI",
    "COG": "COG",
    "MXR": "MXR",
    "FTR": "FTR",
}


# ---------------------------------------------------------------------------
# Source implementation
# ---------------------------------------------------------------------------

class LawAtoSource(Source):
    """Fetch and parse ATO public rulings from law.ato.gov.au."""

    name = "law_ato"

    def __init__(
        self,
        config: PipelineConfig,
        types: list[str] | None = None,
        max_per_type: int = 500,
    ) -> None:
        self.config = config
        # Accept either our internal type codes (TXR, TXD, ...) or the
        # doc_type values (ATO_RULING_TR, ...) for backwards compat.
        if types is None:
            self.types = list(TYPE_CONFIG.keys())
        else:
            # Normalise: if caller passes ATO_RULING_TR -> TXR etc.
            _rev = {cfg["doc_type"]: k for k, cfg in TYPE_CONFIG.items()}
            normalised: list[str] = []
            for t in types:
                if t in TYPE_CONFIG:
                    normalised.append(t)
                elif t in _rev:
                    normalised.append(_rev[t])
            self.types = normalised or list(TYPE_CONFIG.keys())
        self.max_per_type = max_per_type

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    async def fetch(self) -> SourceOutput:
        out = SourceOutput(docs=[], chunks=[])
        headers = {
            "User-Agent": self.config.user_agent,
            "Accept": "text/html,application/xhtml+xml,*/*",
        }
        limits = httpx.Limits(
            max_connections=4,
            max_keepalive_connections=4,
        )
        async with httpx.AsyncClient(
            timeout=self.config.request_timeout_s,
            headers=headers,
            follow_redirects=True,
            limits=limits,
        ) as client:
            for type_code in self.types:
                cfg = TYPE_CONFIG.get(type_code)
                if not cfg:
                    continue
                await self._ingest_type(client, type_code, cfg, out)
        return out

    # ------------------------------------------------------------------
    # Per-type pipeline
    # ------------------------------------------------------------------

    async def _ingest_type(
        self,
        client: httpx.AsyncClient,
        type_code: str,
        cfg: dict,
        out: SourceOutput,
    ) -> None:
        """Ingest all documents for one ruling type."""
        # Step 1: fetch the parent TOC node to discover year/sub-nodes.
        doc_ids = await self._discover_doc_ids(client, type_code, cfg)
        if not doc_ids:
            return

        # Apply the per-type cap.
        if self.max_per_type and len(doc_ids) > self.max_per_type:
            # Keep the most recent documents (last in the list = most recent).
            doc_ids = doc_ids[-self.max_per_type:]

        # Step 2: fetch and parse each document.
        now = datetime.now(timezone.utc).isoformat()
        for raw_docid in doc_ids:
            html = await self._fetch_doc(client, raw_docid)
            if html:
                self._parse_ruling(html, raw_docid, cfg["doc_type"], now, out)
            await asyncio.sleep(self.config.request_per_host_delay_s)

    # ------------------------------------------------------------------
    # Discovery: DOCID enumeration via browse API
    # ------------------------------------------------------------------

    async def _discover_doc_ids(
        self,
        client: httpx.AsyncClient,
        type_code: str,
        cfg: dict,
    ) -> list[str]:
        """Walk the browse-API tree and collect all raw DOCIDs for this type."""
        parent_node = cfg["node"]
        parent_toc = cfg["toc"]
        open_nodes = cfg["open_nodes"]

        # Fetch the parent node to discover year/sub-nodes.
        parent_html = await self._fetch_browse(client, parent_node, parent_toc, open_nodes)
        if not parent_html:
            return []

        # Extract sub-nodes (year folders) from the expanded parent.
        # We look for items inside the open (current) parent node.
        sub_nodes = _extract_sub_nodes(parent_html, parent_node)

        all_doc_ids: list[str] = []

        # First check if there are direct documents in the parent node itself.
        direct_ids = _extract_doc_ids(parent_html)
        all_doc_ids.extend(direct_ids)

        # Then expand each sub-node.
        for sub_node, sub_toc, sub_open in sub_nodes:
            # Skip "Draft", "Draft amendments", "Compendiums", "Archived", "By topic" etc.
            if any(
                skip in sub_toc
                for skip in ("Draft", "Compendium", "Archived", "By topic",
                             "industry issues", "advice", "Old series")
            ):
                continue

            sub_html = await self._fetch_browse(client, sub_node, sub_toc, sub_open)
            if not sub_html:
                continue

            ids = _extract_doc_ids(sub_html)
            all_doc_ids.extend(ids)
            await asyncio.sleep(self.config.request_per_host_delay_s)

            if self.max_per_type and len(all_doc_ids) >= self.max_per_type * 2:
                break  # Conservative safety valve

        return all_doc_ids

    async def _fetch_browse(
        self,
        client: httpx.AsyncClient,
        node: str,
        toc: str,
        open_nodes: str,
    ) -> str | None:
        """Fetch one browse-API response."""
        params: dict[str, str] = {
            "Mode": "type",
            "ImA": "folder",
            "Node": node,
            "TOC": toc,
        }
        if open_nodes:
            params["OpenNodes"] = open_nodes
        try:
            resp = await client.get(BROWSE_API, params=params)
            if resp.status_code == 200:
                text = resp.text
                # Ignore load-balancer probe responses.
                if "Found load balance" in text or len(text) < 50:
                    return None
                return text
        except httpx.HTTPError:
            pass
        return None

    # ------------------------------------------------------------------
    # Document fetch
    # ------------------------------------------------------------------

    async def _fetch_doc(self, client: httpx.AsyncClient, raw_docid: str) -> str | None:
        """Fetch the full document HTML for one DOCID."""
        try:
            resp = await client.get(DOC_URL, params={"docid": raw_docid})
            if resp.status_code == 200:
                return resp.text
        except httpx.HTTPError:
            pass
        return None

    # ------------------------------------------------------------------
    # Document parsing
    # ------------------------------------------------------------------

    def _parse_ruling(
        self,
        html: str,
        raw_docid: str,
        doc_type: str,
        now: str,
        out: SourceOutput,
    ) -> None:
        """Parse one ruling HTML page and append to out."""
        tree = HTMLParser(html)

        # Extract metadata from <meta> tags.
        meta: dict[str, str] = {}
        for m in tree.css("meta"):
            name = (
                m.attributes.get("name", "")
                or m.attributes.get("NAME", "")
                or ""
            )
            content = (
                m.attributes.get("content", "")
                or m.attributes.get("CONTENT", "")
                or ""
            )
            if name and content:
                meta[name.lower()] = content

        # Title: prefer DC.Title which has the full ruling label.
        title = meta.get("dc.title", "") or meta.get("dcterms_description", "")
        if not title:
            # Fall back to h2+h3 combo from LawFront.
            law_front = tree.css_first("#LawFront")
            if law_front:
                h2 = law_front.css_first("h2")
                h3 = law_front.css_first("h3")
                if h2 and h3:
                    title = f"{h2.text(strip=True)} - {h3.text(strip=True)}"
                elif h2:
                    title = h2.text(strip=True)
        if not title:
            page_title = tree.css_first("title")
            title = page_title.text(strip=True).split("|")[0].strip() if page_title else raw_docid

        # Dates from meta.
        effective_from = _parse_date(
            meta.get("dc.date.validfromf", "") or meta.get("dc.date.created", "")
        )
        valid_to_raw = meta.get("dc.date.validtof", "")
        effective_to = None if valid_to_raw.lower() in ("", "indefinite") else _parse_date(valid_to_raw)

        # Build doc_id in our canonical format.
        doc_id = f"ato-law:{_format_doc_id(raw_docid)}"
        url = f"{DOC_URL}?docid={raw_docid}"

        # Extract and clean body content from #LawContent.
        law_content = tree.css_first("#LawContent")
        if law_content is None:
            # Some pages use just the main area.
            law_content = tree.css_first("main")
        body_html = law_content.html if law_content else ""

        # Use the pipeline's clean_html to strip chrome.
        cleaned = clean_html(body_html) if body_html else ""
        if not cleaned:
            return

        out.docs.append(
            Doc(
                doc_id=doc_id,
                source="ato",
                url=url,  # type: ignore[arg-type]
                title=title.strip()[:500],
                jurisdiction="AU",
                doc_type=doc_type,  # type: ignore[arg-type]
                effective_from=effective_from,
                effective_to=effective_to,
                retrieved_at=now,
                metadata={"raw_docid": raw_docid},
            )
        )

        # Chunk the cleaned HTML.
        for raw_chunk in chunk_html(
            cleaned,
            max_chars=self.config.chunk_max_chars,
            overlap_chars=self.config.chunk_overlap_chars,
        ):
            out.chunks.append(
                Chunk(
                    chunk_id=f"{doc_id}#{raw_chunk.ord}",
                    doc_id=doc_id,
                    ord=raw_chunk.ord,
                    text=raw_chunk.text,
                    heading_path=raw_chunk.heading_path,
                    effective_from=effective_from,
                    effective_to=effective_to,
                    char_start=raw_chunk.char_start,
                    char_end=raw_chunk.char_end,
                )
            )

    # ------------------------------------------------------------------
    # Class-based fixture parsing (for tests)
    # ------------------------------------------------------------------

    def parse_fixture(self, html: str, raw_docid: str, doc_type: str) -> SourceOutput:
        """Parse an HTML fixture without network access."""
        now = datetime.now(timezone.utc).isoformat()
        out = SourceOutput(docs=[], chunks=[])
        self._parse_ruling(html, raw_docid, doc_type, now, out)
        return out

    def parse_browse_fixture(self, html: str) -> list[str]:
        """Parse a browse-API HTML fixture and return a list of DOCIDs."""
        return _extract_doc_ids(html)


# ---------------------------------------------------------------------------
# HTML parsing helpers
# ---------------------------------------------------------------------------

def _extract_sub_nodes(html: str, parent_node: str) -> list[tuple[str, str, str]]:
    """Extract (node, toc, open_nodes) tuples for sub-nodes of the expanded parent.

    Looks for ``<li class="jstree-closed"><a href="...Node={node}&...">`` items
    that are immediate children of the expanded (jstree-open) parent.
    We look for ``Node%3D{parent_node}-N`` patterns in the href.
    """
    results: list[tuple[str, str, str]] = []
    # Regex to find sub-node href attributes.
    # Pattern: Node=<parent>-<N> in the URL-encoded href
    # URL-encoded: Node%3D is "Node=", %26 is "&"
    parent_encoded = parent_node.replace("-", "-")
    pattern = re.compile(
        r'href="#Law/browse/([^"]+)"[^>]*title="([^"]+)\s+click to expand"'
    )
    for m in pattern.finditer(html):
        raw_hash = m.group(1)
        _label = m.group(2)
        # Decode the URL.
        decoded = unquote(raw_hash)
        # Extract Node, TOC, OpenNodes.
        node_m = re.search(r"Node=([^\s&]+)", decoded)
        toc_m = re.search(r"TOC=([^\s&]+)", decoded)
        open_m = re.search(r"OpenNodes=([^\s&]+)", decoded)
        if not (node_m and toc_m):
            continue
        node = node_m.group(1)
        toc = toc_m.group(1)
        open_nodes = open_m.group(1) if open_m else ""
        # Only keep sub-nodes of this parent (node starts with parent_node-).
        if node.startswith(parent_node + "-") or (
            parent_node == "2" and re.match(r"^2-\d+$", node)
        ):
            results.append((node, toc, open_nodes))
    return results


def _extract_doc_ids(html: str) -> list[str]:
    """Extract DOCID values from ``rel="document"`` list items.

    The browse API returns items like:
        <li rel="document"><a href="...&DOCID=%22TXR%2FTR20241%2FNAT%2FATO%2F00001%22">
    """
    # Find all href attributes on rel="document" items.
    pattern = re.compile(r'rel="document"[^>]*>.*?DOCID=%22([^"&%]+(?:%2F[^"&%]+)+)%22', re.DOTALL)
    ids: list[str] = []
    for m in pattern.finditer(html):
        raw = unquote(m.group(1))
        if raw:
            ids.append(raw)
    return ids


def _format_doc_id(raw_docid: str) -> str:
    """Convert a raw DOCID like TXR/TR20241/NAT/ATO/00001 to TR/2024/1.

    Examples:
        TXR/TR20241/NAT/ATO/00001   -> TR/2024/1
        GST/GSTR20251/NAT/ATO/00001 -> GSTR/2025/1
        COG/PCG20243/NAT/ATO/00001  -> PCG/2024/3
    """
    parts = raw_docid.split("/")
    if len(parts) < 2:
        return raw_docid
    # The second part like "TR20241" encodes the type abbreviation + year + number.
    segment = parts[1]  # e.g. TR20241, GSTR20251, PCG20243
    # Find the embedded doc code (letters at start) + year (4 digits) + number (rest).
    m = re.match(r"([A-Z]+)(\d{4})(\d+)$", segment)
    if m:
        abbrev, year, num = m.groups()
        return f"{abbrev}/{year}/{int(num)}"
    return raw_docid


def _parse_date(raw: str) -> str | None:
    """Normalise a date string to ISO-8601 (YYYY-MM-DD) or None."""
    if not raw or raw.lower() in ("indefinite", "n/a", ""):
        return None
    # Already ISO: 2024-01-31
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", raw)
    if m:
        return m.group(0)
    # Slash format: 2024/01/31
    m = re.match(r"(\d{4})/(\d{2})/(\d{2})", raw)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return None
