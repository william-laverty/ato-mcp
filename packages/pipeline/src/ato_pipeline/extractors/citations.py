"""Citation extraction from chunk text.

Scans corpus chunks for outbound references and resolves them to
existing doc_ids. Two citation kinds are extracted:

  - legis_itaa1997: references to Income Tax Assessment Act 1997
    sections, e.g. "section 8-1", "s 8-1", "subsection 104-10(1)",
    "section 202-40 of the ITAA 1997". Resolved to
    `legis:c2004a05138/<section>`.

  - ato_ruling: references to ATO public rulings, e.g. "TR 2024/1",
    "TD 2024/D5", "GSTR 2006/3", "CR 2014/14". Resolved to
    `ato-law:<TYPE>/<YEAR>/<NUM>`.

Other reference kinds we deliberately skip:
  - ITAA 1936 — no docs for it in our corpus, would orphan.
  - Bare "Division N" / "Subdivision N" — those aren't chunked as
    separate docs in our pipeline.
  - Case law / AAT decisions — not in the corpus yet.

The extractor returns a list of citation dicts. Resolution against
the actual docs table happens in `resolve_citations()`, which the
caller supplies a doc_id set to filter unknown targets.
"""
from __future__ import annotations

import re
from typing import Iterable


# ITAA 1997 section refs.
# Examples we want to catch:
#   "section 8-1"          → 8-1
#   "s 8-1"                → 8-1
#   "subsection 104-10(1)" → 104-10
#   "ss 67-25(1A)"         → 67-25
#   "section 13-15"        → 13-15
# We require the section number to have the X-Y form (hyphenated) to
# avoid false-positives like "section 159" from ITAA 1936 refs.
_ITAA1997_SECTION = re.compile(
    r"\b(?:s|ss|section|subsection)s?\s+(\d+[A-Z]?-\d+[A-Z]?)\b",
    re.IGNORECASE,
)

# "of the ITAA 1997" or "of the Income Tax Assessment Act 1997" within
# 80 chars after the section number means it's definitely ITAA 1997.
# When this trailing context is missing we still accept the section if
# the chunk's broader context mentions ITAA 1997 (handled at extract time).
_ITAA1997_TRAILING = re.compile(
    r"of\s+the\s+(?:ITAA\s+1997|Income\s+Tax\s+Assessment\s+Act\s+1997)",
    re.IGNORECASE,
)

# ATO ruling refs. The TYPE part is one of the prefixes we know exist
# in the law.ato.gov.au browse API.
_RULING_TYPES = (
    "TR", "TD", "GSTR", "GSTD", "LCR", "CR", "PR", "PCG",
    "TXR", "TXD", "MTR", "MT",
)
_RULING_PATTERN = re.compile(
    r"\b(" + "|".join(_RULING_TYPES) + r")\s+((?:19|20)\d{2})/([A-Z]?\d+[A-Z]?)\b",
)


def extract_citations(text: str) -> list[dict]:
    """Return outbound citations found in *text*.

    Each citation dict has shape::

        {
          "to_doc_id":     str,    # resolved doc_id
          "to_anchor":     str|None,
          "citation_kind": str,    # "legis_itaa1997" | "ato_ruling"
        }

    Duplicates within the same text are collapsed by the caller.
    """
    out: list[dict] = []
    has_itaa1997 = bool(re.search(r"\bITAA\s+1997\b|Income\s+Tax\s+Assessment\s+Act\s+1997", text, re.IGNORECASE))

    for m in _ITAA1997_SECTION.finditer(text):
        section = m.group(1)
        # Confidence guard: only emit when either the chunk mentions
        # ITAA 1997 globally, or "of the ITAA 1997" follows the ref.
        tail = text[m.end() : m.end() + 80]
        if not (has_itaa1997 or _ITAA1997_TRAILING.search(tail)):
            continue
        out.append({
            "to_doc_id": f"legis:c2004a05138/{section.lower()}",
            "to_anchor": None,
            "citation_kind": "legis_itaa1997",
        })

    for m in _RULING_PATTERN.finditer(text):
        ruling_type, year, num = m.group(1), m.group(2), m.group(3)
        out.append({
            "to_doc_id": f"ato-law:{ruling_type}/{year}/{num}",
            "to_anchor": None,
            "citation_kind": "ato_ruling",
        })

    return out


def resolve_citations(
    chunk_id: str,
    text: str,
    valid_doc_ids: set[str] | frozenset[str],
) -> list[dict]:
    """Extract + resolve in one step.

    Drops references whose `to_doc_id` is not in *valid_doc_ids*.
    Deduplicates by (to_doc_id, to_anchor, citation_kind).
    """
    seen: set[tuple] = set()
    out: list[dict] = []
    for cit in extract_citations(text):
        if cit["to_doc_id"] not in valid_doc_ids:
            continue
        key = (cit["to_doc_id"], cit["to_anchor"], cit["citation_kind"])
        if key in seen:
            continue
        seen.add(key)
        out.append({
            "from_chunk_id": chunk_id,
            **cit,
        })
    return out


def extract_for_chunks(
    chunks: Iterable[tuple[str, str]],
    valid_doc_ids: set[str] | frozenset[str],
) -> list[dict]:
    """Vectorised entry: yield resolved citation rows for many chunks.

    *chunks* is an iterable of (chunk_id, text) pairs.
    """
    rows: list[dict] = []
    for chunk_id, text in chunks:
        rows.extend(resolve_citations(chunk_id, text, valid_doc_ids))
    return rows
