"""Federal Register of Legislation scraper.

Fetches the ITAA 1997 (and other Acts) via the publicly-accessible EPUB HTML
documents served from legislation.gov.au.

URL discovery path:
    1. Query the OData API for the latest registered compilation registerId.
    2. Scrape the Act's text page to discover the EPUB document HTML URLs
       (pattern: /{titleId}/{regDate}/{compilDate}/text/original/epub/OEBPS/
        document_{N}/document_{N}.html).
    3. Download and parse each EPUB HTML document:
       - Sections are <p class="ActHead5"> elements.
       - Section body: all <p> elements between consecutive ActHead5 headers.
       - Dictionary definitions: <p class="Definition"> in section 995-1.
       - Heading hierarchy: CharChapText, CharPartText, CharDivText,
         CharSubdText classes identify the ancestor structure.
    4. Emit Doc + Chunk per section, Definition rows, and Anchor rows.
"""
from __future__ import annotations

import asyncio
import gzip
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator
from urllib.parse import urljoin

import httpx
from selectolax.parser import HTMLParser

from ..config import PipelineConfig
from ..schema import Chunk, Doc
from .base import Source, SourceOutput


# ---------------------------------------------------------------------------
# Act registry
# ---------------------------------------------------------------------------

ACT_CONFIG: dict[str, dict] = {
    "itaa1997": {
        "title": "Income Tax Assessment Act 1997",
        "series_id": "C2004A05138",
        "doc_type": "LEGISLATION_ITAA1997",
        "has_dictionary": True,
        "dictionary_section": "995-1",
    },
    "itaa1936": {
        "title": "Income Tax Assessment Act 1936",
        "series_id": "C2004A04903",
        "doc_type": "LEGISLATION_ITAA1936",
        "has_dictionary": False,
        "dictionary_section": None,
    },
    "gst_act": {
        "title": "A New Tax System (Goods and Services Tax) Act 1999",
        "series_id": "C2004A00446",
        "doc_type": "LEGISLATION_GST_ACT",
        "has_dictionary": True,
        "dictionary_section": "195-1",
    },
}

# The OData API for legislative metadata.
VERSIONS_API = "https://api.prod.legislation.gov.au/v1/Versions"
# Text page URL — used to scrape EPUB document links.
TEXT_PAGE_URL = "https://www.legislation.gov.au/{title_id}/latest/text"
# EPUB document base URL pattern.
EPUB_DOC_URL = (
    "https://www.legislation.gov.au/{title_id}/{reg_date}/{comp_date}"
    "/text/original/epub/OEBPS/document_{n}/document_{n}.html"
)

# CSS classes used in the EPUB HTML documents.
SECTION_CLASS = "ActHead5"
DEFINITION_CLASS = "Definition"
BODY_CLASSES = {
    "subsection", "paragraph", "paragraphsub", "notetext", "SOText",
    "subsection2", "Tabletext", "tableText0", "tableIndentText",
    "parabullet", "TLPNotebullet",
}
HEADING_CLASSES = {
    "CharChapText": "Chapter",
    "CharPartText": "Part",
    "CharDivText": "Division",
    "CharSubdText": "Subdivision",
    "SubsectionHead": "Subsection",
}


# ---------------------------------------------------------------------------
# Helper: section number extraction
# ---------------------------------------------------------------------------

def _parse_section_number(segment: str) -> str:
    """Extract a section number like '8-1' from a raw HTML segment."""
    nums = re.findall(r'class="CharSectno"[^>]*>([^<]*)<', segment)
    clean = [
        n for n in nums
        if n and n not in ("&#x2011;", "&#x2013;", "\xa0", "&#xa0;", "‑", "–")
    ]
    if len(clean) >= 2:
        return f"{clean[0]}-{clean[1]}"
    return "".join(clean)


def _clean_text(html_fragment: str) -> str:
    """Strip HTML tags and normalise whitespace + Unicode."""
    text = re.sub(r"<[^>]+>", " ", html_fragment)
    text = text.replace("&#xa0;", " ").replace("&#x2011;", "-").replace("&#x2013;", "-")
    text = text.replace("‑", "-").replace("–", "-").replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


# ---------------------------------------------------------------------------
# Source implementation
# ---------------------------------------------------------------------------

class LegislationSource(Source):
    """Fetch and parse Acts from the Federal Register of Legislation."""

    name = "legislation"

    def __init__(
        self,
        config: PipelineConfig,
        acts: list[str] | None = None,
        max_docs_per_act: int = 0,  # 0 = unlimited
    ) -> None:
        self.config = config
        self.acts = acts or ["itaa1997"]
        self.max_docs_per_act = max_docs_per_act

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    async def fetch(self) -> SourceOutput:
        out = SourceOutput(docs=[], chunks=[])
        headers = {
            "User-Agent": self.config.user_agent,
            "Accept": "text/html,application/xhtml+xml,*/*",
        }
        async with httpx.AsyncClient(
            timeout=self.config.request_timeout_s,
            headers=headers,
            follow_redirects=True,
            http2=True,
        ) as client:
            for act_key in self.acts:
                cfg = ACT_CONFIG.get(act_key)
                if not cfg:
                    continue
                await self._ingest_act(client, act_key, cfg, out)
        return out

    # ------------------------------------------------------------------
    # Per-act pipeline
    # ------------------------------------------------------------------

    async def _ingest_act(
        self,
        client: httpx.AsyncClient,
        act_key: str,
        cfg: dict,
        out: SourceOutput,
    ) -> None:
        title_id = cfg["series_id"]

        # 1. Discover compilation dates from OData API.
        reg_date, comp_date = await self._fetch_compilation_dates(client, title_id)
        if not reg_date or not comp_date:
            return

        # 2. Discover EPUB document URLs.
        epub_urls = await self._discover_epub_urls(client, title_id, reg_date, comp_date)
        if not epub_urls:
            return

        if self.max_docs_per_act:
            epub_urls = epub_urls[: self.max_docs_per_act]

        # 3. Parse each EPUB document.
        now = datetime.now(timezone.utc).isoformat()
        for epub_url in epub_urls:
            html = await self._fetch_html(client, epub_url)
            if html:
                self._parse_epub_doc(html, cfg, act_key, now, out)
                await asyncio.sleep(self.config.request_per_host_delay_s)

    # ------------------------------------------------------------------
    # Compilation date discovery
    # ------------------------------------------------------------------

    async def _fetch_compilation_dates(
        self, client: httpx.AsyncClient, title_id: str
    ) -> tuple[str | None, str | None]:
        """Return (registration_date, compilation_date) for the latest registered compilation."""
        url = (
            f"{VERSIONS_API}?%24filter=titleId+eq+'{title_id}'"
            f"&%24orderby=start+desc&%24top=20"
        )
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            versions = data.get("value", [])
            # Find the most recent version that has a registerId.
            for v in versions:
                if v.get("registerId"):
                    reg_date = v["registeredAt"][:10] if v.get("registeredAt") else None
                    comp_date = v["start"][:10] if v.get("start") else None
                    return reg_date, comp_date
        except (httpx.HTTPError, ValueError):
            pass
        return None, None

    # ------------------------------------------------------------------
    # EPUB URL discovery
    # ------------------------------------------------------------------

    async def _discover_epub_urls(
        self,
        client: httpx.AsyncClient,
        title_id: str,
        reg_date: str,
        comp_date: str,
    ) -> list[str]:
        """Scrape the text page to find EPUB document HTML URLs."""
        text_page = TEXT_PAGE_URL.format(title_id=title_id)
        html = await self._fetch_html(client, text_page)
        if not html:
            return []

        # The text page is mostly SSR-rendered HTML that includes the EPUB
        # document links in its pre-rendered output.
        pattern = re.compile(
            rf"https://www\.legislation\.gov\.au/{re.escape(title_id)}"
            r"/(\d{4}-\d{2}-\d{2})/(\d{4}-\d{2}-\d{2})"
            r"/text/original/epub/OEBPS/document_(\d+)/document_\d+\.html"
        )
        matches = pattern.findall(html)
        if not matches:
            return []

        # Use the first match's dates (all matches should have the same dates).
        found_reg, found_comp, _ = matches[0]
        seen: set[int] = set()
        urls: list[str] = []
        for _, _, n in sorted(matches, key=lambda m: int(m[2])):
            n_int = int(n)
            if n_int not in seen:
                seen.add(n_int)
                urls.append(
                    EPUB_DOC_URL.format(
                        title_id=title_id,
                        reg_date=found_reg,
                        comp_date=found_comp,
                        n=n_int,
                    )
                )
        return urls

    # ------------------------------------------------------------------
    # HTTP fetch
    # ------------------------------------------------------------------

    async def _fetch_html(self, client: httpx.AsyncClient, url: str) -> str | None:
        try:
            resp = await client.get(url)
            return resp.text if resp.status_code == 200 else None
        except httpx.HTTPError:
            return None

    # ------------------------------------------------------------------
    # EPUB HTML parsing
    # ------------------------------------------------------------------

    def _parse_epub_doc(
        self,
        html: str,
        cfg: dict,
        act_key: str,
        now: str,
        out: SourceOutput,
    ) -> None:
        """Parse one EPUB HTML document and append rows to out."""
        section_matches = list(re.finditer(r'<p[^>]+class="ActHead5"[^>]*>', html))
        if not section_matches:
            return

        title_id = cfg["series_id"]
        doc_type = cfg["doc_type"]
        act_title = cfg["title"]

        # Build heading-hierarchy state by scanning the full document.
        heading_map = _build_heading_map(html)

        for i, m in enumerate(section_matches):
            start = m.start()
            end = section_matches[i + 1].start() if i + 1 < len(section_matches) else len(html)

            section_html = html[start:end]
            section_num = _parse_section_number(section_html)
            if not section_num:
                continue

            # Heading text.
            heading_line = re.match(r"<p[^>]*>(.*?)</p>", section_html, re.DOTALL)
            heading = _clean_text(heading_line.group(1)) if heading_line else section_num

            # Body text: concatenate paragraphs after the heading.
            body = _extract_body_text(section_html)
            if not body:
                body = heading  # fallback: at least the heading

            # heading_path from the pre-built map.
            heading_path = heading_map.get(start, [])

            doc_id = (
                f"legis:{title_id.lower()}/{section_num.replace(' ', '')}"
            )
            url = (
                f"https://www.legislation.gov.au/{title_id}/latest/text"
            )

            sec_label = _section_heading(heading, section_num)
            out.docs.append(
                Doc(
                    doc_id=doc_id,
                    source="legislation",
                    url=url,  # type: ignore[arg-type]
                    title=f"{act_title} — s {section_num} — {sec_label}",
                    jurisdiction="AU",
                    doc_type=doc_type,  # type: ignore[arg-type]
                    retrieved_at=now,
                    metadata={"section": section_num, "act_key": act_key},
                )
            )
            chunk_id = f"{doc_id}#0"
            out.chunks.append(
                Chunk(
                    chunk_id=chunk_id,
                    doc_id=doc_id,
                    ord=0,
                    text=body[:6000],
                    heading_path=heading_path,
                    char_start=0,
                    char_end=min(len(body), 6000),
                )
            )
            # Anchor row: one per section.
            out.anchors.append(
                {
                    "anchor_id": f"{doc_id}#{section_num}",
                    "doc_id": doc_id,
                    "anchor_name": heading,
                    "chunk_id": chunk_id,
                }
            )

            # Dictionary extraction for the designated dictionary section.
            if cfg.get("has_dictionary") and section_num == cfg.get("dictionary_section"):
                _extract_definitions(
                    section_html,
                    title_id.lower(),
                    out,
                    act_title=act_title,
                    doc_type=doc_type,
                    now=now,
                )

    # ------------------------------------------------------------------
    # Class-based fixture parsing (for tests)
    # ------------------------------------------------------------------

    def parse_fixture(self, html: str, act_key: str = "itaa1997") -> SourceOutput:
        """Parse an EPUB HTML fixture without network access."""
        cfg = ACT_CONFIG[act_key]
        now = datetime.now(timezone.utc).isoformat()
        out = SourceOutput(docs=[], chunks=[])
        self._parse_epub_doc(html, cfg, act_key, now, out)
        return out


# ---------------------------------------------------------------------------
# Heading hierarchy builder
# ---------------------------------------------------------------------------

def _build_heading_map(html: str) -> dict[int, list[str]]:
    """Map each ActHead5 section position to its ancestor heading path.

    The EPUB HTML uses ActHead1-4 for Chapter/Part/Division/Subdivision
    structure, and ActHead5 for individual sections.  We scan in document
    order and maintain a running breadcrumb path.
    """
    # ActHead class → structural level label.
    LEVEL_CLS = {
        "ActHead1": "Chapter",
        "ActHead2": "Part",
        "ActHead3": "Division",
        "ActHead4": "Subdivision",
    }
    # Track the current breadcrumb for each level.
    # Using an ordered dict keyed by level depth ensures proper nesting.
    state: dict[str, str] = {}
    LEVEL_ORDER = ["Chapter", "Part", "Division", "Subdivision"]

    result: dict[int, list[str]] = {}

    for m in re.finditer(r'<p[^>]+class="([^"]+)"[^>]*>(.*?)</p>', html, re.DOTALL):
        cls = m.group(1)
        content_html = m.group(2)
        pos = m.start()

        if "ActHead5" in cls:
            result[pos] = [state[lv] for lv in LEVEL_ORDER if lv in state]
        else:
            for head_cls, label in LEVEL_CLS.items():
                if head_cls in cls:
                    text = _clean_text(content_html)
                    if text:
                        state[label] = f"{label} — {text}"
                        # Clear child levels when a parent heading changes.
                        idx = LEVEL_ORDER.index(label)
                        for child_label in LEVEL_ORDER[idx + 1:]:
                            state.pop(child_label, None)
                    break

    return result


# ---------------------------------------------------------------------------
# Body text extraction
# ---------------------------------------------------------------------------

def _extract_body_text(section_html: str) -> str:
    """Extract plain text from the body paragraphs of a section."""
    # Skip the first <p> (the ActHead5 heading).
    first_end = section_html.find("</p>")
    if first_end < 0:
        return ""
    body_html = section_html[first_end + 4:]

    parts: list[str] = []
    for pm in re.finditer(r"<p[^>]*class=\"([^\"]+)\"[^>]*>(.*?)</p>", body_html, re.DOTALL):
        cls = pm.group(1)
        content = pm.group(2)
        # Include if the class looks like a body class.
        if any(bc in cls for bc in BODY_CLASSES):
            text = _clean_text(content)
            if text:
                parts.append(text)

    if not parts:
        # Fallback: just strip all tags.
        parts.append(_clean_text(body_html))

    return "\n\n".join(parts)


def _section_heading(heading: str, section_num: str) -> str:
    """Return just the heading text after the section number.

    The heading text from _clean_text may include whitespace-padded section
    numbers like "8 - 1  General deductions". We strip those out.
    """
    # Remove the section number with possible whitespace around the hyphen.
    # e.g. "8 - 1" or "8-1"
    parts = section_num.split("-")
    if len(parts) == 2:
        a, b = parts
        # Match "8 - 1" or "8-1" at start of heading.
        pattern = rf"^{re.escape(a)}\s*-\s*{re.escape(b)}\s*"
        cleaned = re.sub(pattern, "", heading).strip()
    else:
        cleaned = heading.replace(section_num, "", 1).strip()
    return cleaned or heading


# ---------------------------------------------------------------------------
# Dictionary definitions extraction
# ---------------------------------------------------------------------------

def _extract_definitions(
    section_html: str,
    series_id_lower: str,
    out: SourceOutput,
    *,
    act_title: str | None = None,
    doc_type: str | None = None,
    now: str | None = None,
) -> None:
    """Extract defined terms from the Dictionary section HTML.

    Emits a synthetic parent Doc row for the dictionary so foreign-key
    constraints in downstream stores (Supabase) are satisfied: every
    definition row references `legis:{series}/dictionary` as its source.
    """
    dict_doc_id = f"legis:{series_id_lower}/dictionary"

    if act_title and doc_type and now and not any(d.doc_id == dict_doc_id for d in out.docs):
        out.docs.append(
            Doc(
                doc_id=dict_doc_id,
                source="legislation",
                url=f"https://www.legislation.gov.au/{series_id_lower.upper()}/latest/text",  # type: ignore[arg-type]
                title=f"{act_title} — Dictionary",
                jurisdiction="AU",
                doc_type=doc_type,  # type: ignore[arg-type]
                retrieved_at=now,
                metadata={"synthetic": True, "kind": "dictionary"},
            )
        )

    # Each definition is a <p class="Definition"> element.
    # The term is in a bold-italic span; the body follows.
    for dm in re.finditer(
        r'<p[^>]+class="Definition"[^>]*>(.*?)</p>', section_html, re.DOTALL
    ):
        def_html = dm.group(1)
        # Term: first bold-italic run (may span multiple spans).
        term_parts = re.findall(r'font-weight:bold[^>]*>([^<]*)<', def_html)
        term = _clean_text(" ".join(term_parts)).strip()
        if not term:
            # Try alternate pattern.
            term = _clean_text(re.sub(r"<[^>]+>", " ", def_html).split(".")[0])
        if not term:
            continue
        body = _clean_text(def_html)
        if not body:
            continue
        out.definitions.append(
            {
                "term": term.lower(),
                "doc_id": dict_doc_id,
                "anchor_id": None,
                "body": body[:4000],
                "effective_from": None,
                "effective_to": None,
            }
        )
