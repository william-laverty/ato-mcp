"""Tests for the citation extractor."""
from __future__ import annotations

from ato_pipeline.extractors.citations import (
    extract_citations,
    resolve_citations,
)


# ---------------------------------------------------------------------------
# ITAA 1997 references
# ---------------------------------------------------------------------------

def test_section_with_explicit_trailing_act() -> None:
    text = (
        "The Dividend Component is a frankable distribution pursuant to "
        "section 202-40 of the ITAA 1997, and is therefore franked."
    )
    cits = extract_citations(text)
    assert any(c["to_doc_id"] == "legis:c2004a05138/202-40" for c in cits)


def test_subsection_uses_section_number_only() -> None:
    text = "subsection 104-10(1) and subsection 104-10(2) of the ITAA 1997"
    cits = extract_citations(text)
    docs = [c["to_doc_id"] for c in cits]
    assert "legis:c2004a05138/104-10" in docs
    # Both subsection refs collapse to the same parent section.
    assert docs.count("legis:c2004a05138/104-10") == 2


def test_section_with_global_context_only() -> None:
    text = (
        "This Ruling applies the ITAA 1997. Later in the body, see "
        "section 8-1 for the deduction principle."
    )
    cits = extract_citations(text)
    assert any(c["to_doc_id"] == "legis:c2004a05138/8-1" for c in cits)


def test_section_without_context_is_skipped() -> None:
    # No "ITAA 1997" / "Income Tax Assessment Act 1997" anywhere — could
    # be ITAA 1936 or another act. Don't fabricate a citation.
    text = "Refer to section 8-1 for further detail."
    cits = extract_citations(text)
    assert not cits


def test_itaa1936_bare_refs_are_ignored() -> None:
    text = "Legislative References:  ITAA 1936  ITAA 1936 6(1)  ITAA 1936 44"
    cits = extract_citations(text)
    # 6(1) and 44 are integer-only, won't match the X-Y pattern.
    assert not any(c["citation_kind"] == "legis_itaa1997" for c in cits)


def test_letter_suffixed_section_is_extracted() -> None:
    text = "the Commissioner's view on section 13-15A of the ITAA 1997"
    cits = extract_citations(text)
    assert any(c["to_doc_id"] == "legis:c2004a05138/13-15a" for c in cits)


# ---------------------------------------------------------------------------
# ATO ruling references
# ---------------------------------------------------------------------------

def test_tr_ruling_extracted() -> None:
    text = "Related Rulings/Determinations:   TR 2006/10"
    cits = extract_citations(text)
    assert any(
        c["to_doc_id"] == "ato-law:TR/2006/10" and c["citation_kind"] == "ato_ruling"
        for c in cits
    )


def test_cr_ruling_extracted() -> None:
    text = "see CR 2014/14 for the parallel ruling"
    cits = extract_citations(text)
    assert any(c["to_doc_id"] == "ato-law:CR/2014/14" for c in cits)


def test_draft_ruling_extracted() -> None:
    text = "as set out in TD 2024/D5 (draft determination)"
    cits = extract_citations(text)
    assert any(c["to_doc_id"] == "ato-law:TD/2024/D5" for c in cits)


def test_multiple_ruling_types() -> None:
    text = (
        "See GSTR 2006/3, TR 2024/1 and LCR 2024/2 for the Commissioner's "
        "views on this matter."
    )
    docs = {c["to_doc_id"] for c in extract_citations(text)}
    assert "ato-law:GSTR/2006/3" in docs
    assert "ato-law:TR/2024/1" in docs
    assert "ato-law:LCR/2024/2" in docs


def test_non_ruling_letter_combinations_ignored() -> None:
    text = "Random XYZ 2024/1 not a ruling type."
    cits = extract_citations(text)
    assert not cits


# ---------------------------------------------------------------------------
# resolve_citations — drops unknown doc_ids, dedupes
# ---------------------------------------------------------------------------

def test_resolve_drops_unknown_doc_ids() -> None:
    text = "section 999-99 of the ITAA 1997 and section 8-1 of the ITAA 1997"
    valid = {"legis:c2004a05138/8-1"}
    rows = resolve_citations("ato:test#0", text, valid)
    assert len(rows) == 1
    assert rows[0]["to_doc_id"] == "legis:c2004a05138/8-1"
    assert rows[0]["from_chunk_id"] == "ato:test#0"


def test_resolve_dedupes_within_chunk() -> None:
    text = (
        "section 8-1 of the ITAA 1997 ... section 8-1 of the ITAA 1997 ... "
        "see also s 8-1"
    )
    valid = {"legis:c2004a05138/8-1"}
    rows = resolve_citations("ato:test#0", text, valid)
    assert len(rows) == 1


def test_resolve_attaches_from_chunk_id() -> None:
    text = "Refer to TR 2024/1 for context."
    valid = {"ato-law:TR/2024/1"}
    rows = resolve_citations("legis:c2004a05138/100-10#0", text, valid)
    assert rows == [{
        "from_chunk_id": "legis:c2004a05138/100-10#0",
        "to_doc_id": "ato-law:TR/2024/1",
        "to_anchor": None,
        "citation_kind": "ato_ruling",
    }]
