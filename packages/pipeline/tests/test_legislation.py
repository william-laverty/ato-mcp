"""Tests for the Federal Register legislation source (Phase B1).

The test suite uses a pre-recorded compressed HTML fixture
(tests/fixtures/legislation/itaa1997-fixture.html.gz) derived from the
EPUB HTML of ITAA 1997 Compilation 263 (April 2026). The fixture contains
sections 1-1 through 9-5 plus the first ~42 definitions from s 995-1.

Tests that hit the network are marked @pytest.mark.slow.
"""
from __future__ import annotations

import asyncio
import gzip
from pathlib import Path

import httpx
import pytest
import respx

from ato_pipeline.config import PipelineConfig
from ato_pipeline.sources.legislation import ACT_CONFIG, LegislationSource

FIXTURE = Path(__file__).parent / "fixtures" / "legislation" / "itaa1997-fixture.html.gz"


# ---------------------------------------------------------------------------
# Fixture helpers
# ---------------------------------------------------------------------------

def _load_fixture() -> str:
    if not FIXTURE.exists():
        pytest.skip("ITAA1997 fixture not found")
    with gzip.open(FIXTURE, "rt", encoding="utf-8") as f:
        return f.read()


# ---------------------------------------------------------------------------
# B1.1 — Fixture-based parser tests
# ---------------------------------------------------------------------------

def test_fixture_exists() -> None:
    assert FIXTURE.exists(), f"Fixture missing: {FIXTURE}"
    assert FIXTURE.stat().st_size < 1_000_000, "Fixture too large — should be gzip-compressed"


def test_legislation_source_parses_sections() -> None:
    html = _load_fixture()
    src = LegislationSource(PipelineConfig(), acts=["itaa1997"])
    out = src.parse_fixture(html, "itaa1997")

    assert len(out.docs) >= 10, f"Expected at least 10 sections; got {len(out.docs)}"
    # Each section doc has exactly one chunk; the synthetic dictionary parent
    # doc emitted for definitions has no chunk, so chunks == sections == docs - 1.
    section_docs = [d for d in out.docs if not d.metadata.get("synthetic")]
    assert len(out.chunks) == len(section_docs), "Each section doc must have exactly one chunk"
    assert all(d.doc_type == "LEGISLATION_ITAA1997" for d in out.docs)
    assert all(d.source == "legislation" for d in out.docs)
    assert all(d.jurisdiction == "AU" for d in out.docs)


def test_legislation_section_8_1() -> None:
    """Section 8-1 (General deductions) must be present with correct content."""
    html = _load_fixture()
    src = LegislationSource(PipelineConfig(), acts=["itaa1997"])
    out = src.parse_fixture(html, "itaa1997")

    sec_8_1 = [d for d in out.docs if d.metadata.get("section") == "8-1"]
    assert sec_8_1, "Expected to find section 8-1 (General deductions)"
    doc = sec_8_1[0]
    assert "General deductions" in doc.title
    assert doc.doc_id == "legis:c2004a05138/8-1"

    chunks = [c for c in out.chunks if c.doc_id == doc.doc_id]
    assert chunks, "Section 8-1 must have at least one chunk"
    body = chunks[0].text
    assert "assessable income" in body.lower(), "Body should mention assessable income"
    assert len(body) > 50, "Section body should have substantial content"


def test_legislation_heading_paths() -> None:
    """Chunks should include ancestor heading paths for context."""
    html = _load_fixture()
    src = LegislationSource(PipelineConfig(), acts=["itaa1997"])
    out = src.parse_fixture(html, "itaa1997")

    sec_8_1 = [c for c in out.chunks if "8-1" in c.doc_id]
    assert sec_8_1, "Section 8-1 chunk missing"
    path = sec_8_1[0].heading_path
    # Expect at least one ancestor (Part or Division)
    assert len(path) >= 1, f"Expected heading path for s 8-1; got: {path}"
    # Should mention Division 8 Deductions
    full_path = " ".join(path).lower()
    assert "deduction" in full_path or "part" in full_path


def test_legislation_anchors() -> None:
    """Each section should produce an anchor row."""
    html = _load_fixture()
    src = LegislationSource(PipelineConfig(), acts=["itaa1997"])
    out = src.parse_fixture(html, "itaa1997")

    # Anchors are one per section; synthetic dictionary doc has no anchor.
    section_docs = [d for d in out.docs if not d.metadata.get("synthetic")]
    assert len(out.anchors) == len(section_docs), "One anchor per section"
    # Spot-check anchor for 8-1
    anchor = next((a for a in out.anchors if "8-1" in a["anchor_id"]), None)
    assert anchor is not None
    assert anchor["doc_id"] == "legis:c2004a05138/8-1"
    assert "General deductions" in anchor["anchor_name"]


def test_legislation_definitions() -> None:
    """Dictionary definitions from s 995-1 must be extracted."""
    html = _load_fixture()
    src = LegislationSource(PipelineConfig(), acts=["itaa1997"])
    out = src.parse_fixture(html, "itaa1997")

    assert len(out.definitions) >= 10, (
        f"Expected at least 10 definitions from s 995-1; got {len(out.definitions)}"
    )
    for defn in out.definitions:
        assert defn["term"], "Definition term must not be empty"
        assert defn["body"], "Definition body must not be empty"
        assert defn["doc_id"] == "legis:c2004a05138/dictionary"
        # term should be lower-cased
        assert defn["term"] == defn["term"].lower()


def test_legislation_definition_100_subsidiary() -> None:
    """Spot-check a known term from the dictionary."""
    html = _load_fixture()
    src = LegislationSource(PipelineConfig(), acts=["itaa1997"])
    out = src.parse_fixture(html, "itaa1997")

    terms = {d["term"]: d for d in out.definitions}
    assert "100% subsidiary" in terms, f"Expected '100% subsidiary'; got keys: {list(terms.keys())[:10]}"
    body = terms["100% subsidiary"]["body"]
    assert "975" in body, "Body should reference s 975 (where term is defined)"


def test_legislation_dictionary_doc_emitted() -> None:
    """The dictionary parent doc must be emitted so definitions' FK is satisfied."""
    html = _load_fixture()
    src = LegislationSource(PipelineConfig(), acts=["itaa1997"])
    out = src.parse_fixture(html, "itaa1997")

    dict_doc = next(
        (d for d in out.docs if d.doc_id == "legis:c2004a05138/dictionary"), None
    )
    assert dict_doc is not None, "Dictionary parent doc missing — definitions would orphan"
    assert dict_doc.metadata.get("synthetic") is True
    # Every definition row must reference an emitted doc.
    doc_ids = {d.doc_id for d in out.docs}
    for defn in out.definitions:
        assert defn["doc_id"] in doc_ids, f"Definition references missing doc: {defn['doc_id']}"


def test_legislation_doc_ids_are_unique() -> None:
    html = _load_fixture()
    src = LegislationSource(PipelineConfig(), acts=["itaa1997"])
    out = src.parse_fixture(html, "itaa1997")

    ids = [d.doc_id for d in out.docs]
    assert len(ids) == len(set(ids)), "Duplicate doc_ids found"


# ---------------------------------------------------------------------------
# B1.2 — Mocked network tests
# ---------------------------------------------------------------------------

@respx.mock
@pytest.mark.asyncio
async def test_legislation_source_fetch_mocked() -> None:
    """Full fetch() path with mocked HTTP — no network required."""
    if not FIXTURE.exists():
        pytest.skip("ITAA1997 fixture not found")

    fixture_html = _load_fixture()
    title_id = "C2004A05138"

    # Mock the OData versions API.
    versions_url = (
        f"https://api.prod.legislation.gov.au/v1/Versions"
        f"?%24filter=titleId+eq+'{title_id}'"
        f"&%24orderby=start+desc&%24top=20"
    )
    respx.get(versions_url).mock(
        return_value=httpx.Response(
            200,
            json={
                "value": [
                    {
                        "titleId": title_id,
                        "start": "2026-04-01T00:00:00",
                        "registerId": "C2026C00122",
                        "registeredAt": "2026-04-07T00:00:00",
                    }
                ]
            },
        )
    )

    # Mock the text page (returns minimal HTML with one EPUB doc link).
    text_page_url = f"https://www.legislation.gov.au/{title_id}/latest/text"
    epub_doc_url = (
        f"https://www.legislation.gov.au/{title_id}/2026-04-01/2026-04-01"
        "/text/original/epub/OEBPS/document_1/document_1.html"
    )
    text_page_html = (
        f'<html><body><a href="{epub_doc_url}">Doc 1</a></body></html>'
    )
    respx.get(text_page_url).mock(
        return_value=httpx.Response(200, text=text_page_html)
    )

    # Mock the EPUB doc request.
    respx.get(epub_doc_url).mock(
        return_value=httpx.Response(200, text=fixture_html)
    )

    src = LegislationSource(PipelineConfig(), acts=["itaa1997"])
    out = await src.fetch()

    assert len(out.docs) >= 10
    assert len(out.definitions) >= 10
    assert any("LEGISLATION_ITAA1997" == d.doc_type for d in out.docs)
