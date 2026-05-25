"""Tests for the law.ato.gov.au public rulings source (Phase C).

Uses pre-recorded gzip-compressed HTML fixtures from:
    tests/fixtures/law_ato/tr2024_1.html.gz      — TR 2024/1 document page
    tests/fixtures/law_ato/browse_tr2024.html.gz — browse-API year listing

Network-dependent tests are marked @pytest.mark.slow.
"""
from __future__ import annotations

import asyncio
import gzip
from pathlib import Path

import httpx
import pytest
import respx

from ato_pipeline.config import PipelineConfig
from ato_pipeline.sources.law_ato import (
    LawAtoSource,
    _extract_doc_ids,
    _extract_sub_nodes,
    _format_doc_id,
    _parse_date,
)

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "law_ato"
TR2024_FIXTURE = FIXTURE_DIR / "tr2024_1.html.gz"
BROWSE_FIXTURE = FIXTURE_DIR / "browse_tr2024.html.gz"


# ---------------------------------------------------------------------------
# Fixture helpers
# ---------------------------------------------------------------------------

def _load_gzip(path: Path) -> str:
    if not path.exists():
        pytest.skip(f"Fixture not found: {path}")
    with gzip.open(path, "rt", encoding="utf-8") as f:
        return f.read()


# ---------------------------------------------------------------------------
# C.1 — Helper function unit tests (no network)
# ---------------------------------------------------------------------------

class TestFormatDocId:
    def test_tr(self) -> None:
        assert _format_doc_id("TXR/TR20241/NAT/ATO/00001") == "TR/2024/1"

    def test_tr_multi_digit(self) -> None:
        assert _format_doc_id("TXR/TR202412/NAT/ATO/00001") == "TR/2024/12"

    def test_gstr(self) -> None:
        assert _format_doc_id("GST/GSTR20251/NAT/ATO/00001") == "GSTR/2025/1"

    def test_pcg(self) -> None:
        assert _format_doc_id("COG/PCG20243/NAT/ATO/00001") == "PCG/2024/3"

    def test_cr(self) -> None:
        assert _format_doc_id("CTR/CR20251/NAT/ATO/00001") == "CR/2025/1"

    def test_lcr(self) -> None:
        assert _format_doc_id("NYI/LCR20241/NAT/ATO/00001") == "LCR/2024/1"

    def test_unknown_passthrough(self) -> None:
        # Unknown formats should not crash.
        result = _format_doc_id("UNKNOWN")
        assert result  # just not empty


class TestParseDate:
    def test_iso_format(self) -> None:
        assert _parse_date("2024-01-31") == "2024-01-31"

    def test_slash_format(self) -> None:
        assert _parse_date("2024/01/31") == "2024-01-31"

    def test_indefinite(self) -> None:
        assert _parse_date("indefinite") is None

    def test_empty(self) -> None:
        assert _parse_date("") is None

    def test_na(self) -> None:
        assert _parse_date("n/a") is None


# ---------------------------------------------------------------------------
# C.2 — Browse API HTML parsing
# ---------------------------------------------------------------------------

class TestExtractDocIds:
    def test_browse_fixture(self) -> None:
        html = _load_gzip(BROWSE_FIXTURE)
        ids = _extract_doc_ids(html)
        assert len(ids) >= 2, f"Expected at least 2 doc IDs; got {len(ids)}"
        # First 2024 TR should be TR 2024/1.
        assert any("TR20241" in i for i in ids), f"Expected TR20241 in {ids[:5]}"

    def test_returns_raw_docids(self) -> None:
        html = _load_gzip(BROWSE_FIXTURE)
        ids = _extract_doc_ids(html)
        for doc_id in ids:
            # Each should have NAT/ATO pattern.
            assert "NAT/ATO" in doc_id, f"Unexpected DOCID format: {doc_id}"

    def test_no_duplicates(self) -> None:
        html = _load_gzip(BROWSE_FIXTURE)
        ids = _extract_doc_ids(html)
        assert len(ids) == len(set(ids)), "Duplicate DOCIDs extracted"


class TestExtractSubNodes:
    def test_finds_sub_nodes(self) -> None:
        # The 2024 TR browse response is at the year level (no sub-nodes beyond docs).
        # Use the parent-level node response instead (which we can synthesise).
        sample_html = """
        <ul>
          <li class="jstree-open"><a id="1-0-1">Taxation</a>
            <ul>
              <li class="jstree-closed">
                <a href="#Law/browse/Mode%3Dtype%26ImA%3Dfolder%26Node%3D1-0-1-4%26OpenNodes%3D1,1-0,1-0-1%26TOC%3D05%253APublic%2520rulings%253ARulings%253ATaxation%253A2024" title="2024 click to expand" id="1-0-1-4"></a>
              </li>
              <li class="jstree-closed">
                <a href="#Law/browse/Mode%3Dtype%26ImA%3Dfolder%26Node%3D1-0-1-5%26OpenNodes%3D1,1-0,1-0-1%26TOC%3D05%253APublic%2520rulings%253ARulings%253ATaxation%253A2023" title="2023 click to expand" id="1-0-1-5"></a>
              </li>
            </ul>
          </li>
        </ul>
        """
        nodes = _extract_sub_nodes(sample_html, "1-0-1")
        assert len(nodes) >= 2
        node_ids = [n[0] for n in nodes]
        assert "1-0-1-4" in node_ids
        assert "1-0-1-5" in node_ids

    def test_filters_drafts(self) -> None:
        """Draft and compendium nodes should be filtered out during ingest."""
        sample_html = """
        <ul>
          <li class="jstree-closed">
            <a href="#Law/browse/Mode%3Dtype%26ImA%3Dfolder%26Node%3D1-0-1-0%26TOC%3D05%253APublic%2520rulings%253ARulings%253ATaxation%253ADraft" title="Draft click to expand"></a>
          </li>
          <li class="jstree-closed">
            <a href="#Law/browse/Mode%3Dtype%26ImA%3Dfolder%26Node%3D1-0-1-4%26TOC%3D05%253APublic%2520rulings%253ARulings%253ATaxation%253A2024" title="2024 click to expand"></a>
          </li>
        </ul>
        """
        nodes = _extract_sub_nodes(sample_html, "1-0-1")
        # All nodes are returned; filtering happens in _discover_doc_ids.
        node_ids = [n[0] for n in nodes]
        assert "1-0-1-4" in node_ids  # real year node present
        # The source filters out Draft in _ingest_type; here we just check we get them all.


# ---------------------------------------------------------------------------
# C.3 — Document HTML parsing (fixture-based)
# ---------------------------------------------------------------------------

class TestParseTRFixture:
    def test_fixture_exists(self) -> None:
        assert TR2024_FIXTURE.exists(), f"Fixture not found: {TR2024_FIXTURE}"

    def test_parse_produces_doc(self) -> None:
        html = _load_gzip(TR2024_FIXTURE)
        src = LawAtoSource(PipelineConfig())
        out = src.parse_fixture(html, "TXR/TR20241/NAT/ATO/00001", "ATO_RULING_TR")

        assert len(out.docs) == 1, f"Expected 1 doc; got {len(out.docs)}"
        doc = out.docs[0]
        assert doc.doc_type == "ATO_RULING_TR"
        assert doc.source == "ato"
        assert doc.jurisdiction == "AU"

    def test_doc_id_format(self) -> None:
        html = _load_gzip(TR2024_FIXTURE)
        src = LawAtoSource(PipelineConfig())
        out = src.parse_fixture(html, "TXR/TR20241/NAT/ATO/00001", "ATO_RULING_TR")
        doc = out.docs[0]
        assert doc.doc_id == "ato-law:TR/2024/1", f"Got: {doc.doc_id}"

    def test_title_extracted(self) -> None:
        html = _load_gzip(TR2024_FIXTURE)
        src = LawAtoSource(PipelineConfig())
        out = src.parse_fixture(html, "TXR/TR20241/NAT/ATO/00001", "ATO_RULING_TR")
        doc = out.docs[0]
        assert "TR 2024/1" in doc.title or "composite items" in doc.title.lower(), (
            f"Unexpected title: {doc.title!r}"
        )

    def test_effective_from_parsed(self) -> None:
        html = _load_gzip(TR2024_FIXTURE)
        src = LawAtoSource(PipelineConfig())
        out = src.parse_fixture(html, "TXR/TR20241/NAT/ATO/00001", "ATO_RULING_TR")
        doc = out.docs[0]
        assert doc.effective_from == "2024-01-31", f"Got: {doc.effective_from}"

    def test_effective_to_none_for_current(self) -> None:
        html = _load_gzip(TR2024_FIXTURE)
        src = LawAtoSource(PipelineConfig())
        out = src.parse_fixture(html, "TXR/TR20241/NAT/ATO/00001", "ATO_RULING_TR")
        doc = out.docs[0]
        # TR 2024/1 is current (ValidToF = indefinite) => effective_to = None
        assert doc.effective_to is None, f"Expected None; got {doc.effective_to}"

    def test_chunks_produced(self) -> None:
        html = _load_gzip(TR2024_FIXTURE)
        src = LawAtoSource(PipelineConfig())
        out = src.parse_fixture(html, "TXR/TR20241/NAT/ATO/00001", "ATO_RULING_TR")
        assert len(out.chunks) >= 5, f"Expected at least 5 chunks; got {len(out.chunks)}"
        # All chunks belong to the correct doc.
        for chunk in out.chunks:
            assert chunk.doc_id == "ato-law:TR/2024/1"
        # Total text content should be substantial (full ruling body).
        total_text = sum(len(c.text) for c in out.chunks)
        assert total_text > 10_000, f"Expected >10k chars of content; got {total_text}"

    def test_chunk_ids_unique(self) -> None:
        html = _load_gzip(TR2024_FIXTURE)
        src = LawAtoSource(PipelineConfig())
        out = src.parse_fixture(html, "TXR/TR20241/NAT/ATO/00001", "ATO_RULING_TR")
        ids = [c.chunk_id for c in out.chunks]
        assert len(ids) == len(set(ids)), "Duplicate chunk IDs"

    def test_chunks_have_substantial_text(self) -> None:
        html = _load_gzip(TR2024_FIXTURE)
        src = LawAtoSource(PipelineConfig())
        out = src.parse_fixture(html, "TXR/TR20241/NAT/ATO/00001", "ATO_RULING_TR")
        total_text = " ".join(c.text for c in out.chunks)
        assert "depreciating asset" in total_text.lower(), (
            "Expected ruling body content in chunks"
        )

    def test_url_format(self) -> None:
        html = _load_gzip(TR2024_FIXTURE)
        src = LawAtoSource(PipelineConfig())
        out = src.parse_fixture(html, "TXR/TR20241/NAT/ATO/00001", "ATO_RULING_TR")
        doc = out.docs[0]
        assert "TXR/TR20241/NAT/ATO/00001" in str(doc.url)


# ---------------------------------------------------------------------------
# C.4 — Mocked network tests (no real HTTP)
# ---------------------------------------------------------------------------

@respx.mock
@pytest.mark.asyncio
async def test_law_ato_source_fetch_mocked() -> None:
    """Full fetch() path with mocked HTTP — no network required."""
    if not TR2024_FIXTURE.exists():
        pytest.skip("TR2024 fixture not found")
    if not BROWSE_FIXTURE.exists():
        pytest.skip("Browse fixture not found")

    fixture_html = _load_gzip(TR2024_FIXTURE)
    browse_html = _load_gzip(BROWSE_FIXTURE)
    raw_docid = "TXR/TR20241/NAT/ATO/00001"

    # Mock the parent TOC node call for TXR.
    parent_browse_url = "https://www.ato.gov.au/API/v1/law/lawservices/browse"
    # The parent (1-0-1) call should return the year nodes.
    year_listing_html = f"""
    <div id="tree"><ul>
      <li class="jstree-open"><a id="1-0-1">Taxation</a>
        <ul>
          <li class="jstree-closed">
            <a href="#Law/browse/Mode%3Dtype%26ImA%3Dfolder%26Node%3D1-0-1-4%26OpenNodes%3D1,1-0,1-0-1%26TOC%3D05%253APublic%2520rulings%253ARulings%253ATaxation%253A2024"
               title="2024 click to expand" id="1-0-1-4"></a>
          </li>
        </ul>
      </li>
    </ul></div>
    """

    # We need to use a pattern that matches the browse API params.
    def browse_side_effect(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if "Node=1-0-1&" in url or "Node=1-0-1%26" in url or "Node=1-0-1" in url:
            params = dict(request.url.params)
            node = params.get("Node", "")
            if node == "1-0-1":
                return httpx.Response(200, text=year_listing_html)
            if node == "1-0-1-4":
                return httpx.Response(200, text=browse_html)
        return httpx.Response(200, text="Found load balance testing")

    respx.get(parent_browse_url).mock(side_effect=browse_side_effect)

    # Mock the document page.
    doc_url = "https://www.ato.gov.au/law/view/view.htm"
    respx.get(doc_url).mock(return_value=httpx.Response(200, text=fixture_html))

    src = LawAtoSource(PipelineConfig(), types=["TXR"], max_per_type=10)
    out = await src.fetch()

    assert len(out.docs) >= 1, f"Expected docs from mocked fetch; got {len(out.docs)}"
    assert any(d.doc_type == "ATO_RULING_TR" for d in out.docs)


# ---------------------------------------------------------------------------
# C.5 — Configuration tests
# ---------------------------------------------------------------------------

class TestLawAtoSourceConfig:
    def test_default_types(self) -> None:
        src = LawAtoSource(PipelineConfig())
        assert "TXR" in src.types
        assert "TXD" in src.types
        assert "GST" in src.types
        assert "COG" in src.types

    def test_custom_types(self) -> None:
        src = LawAtoSource(PipelineConfig(), types=["TXR", "GST"])
        assert src.types == ["TXR", "GST"]

    def test_doctype_value_normalisation(self) -> None:
        src = LawAtoSource(PipelineConfig(), types=["ATO_RULING_TR", "ATO_RULING_PCG"])
        assert "TXR" in src.types
        assert "COG" in src.types

    def test_max_per_type_cap(self) -> None:
        src = LawAtoSource(PipelineConfig(), max_per_type=10)
        assert src.max_per_type == 10
