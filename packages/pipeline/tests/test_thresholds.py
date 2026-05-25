"""Tests for threshold extractors (Phase B3)."""
from __future__ import annotations

import pytest
import httpx
import respx

from ato_pipeline.extractors.thresholds import (
    EXTRACTORS,
    ThresholdExtractor,
    extract_all,
)


# ---------------------------------------------------------------------------
# Unit tests: regex extraction against pinned HTML snippets
# ---------------------------------------------------------------------------

def _get(name: str) -> ThresholdExtractor:
    matches = [e for e in EXTRACTORS if e.name == name]
    assert matches, f"Extractor '{name}' not found"
    return matches[0]


def test_gst_registration_threshold_extracted() -> None:
    html = (
        "<p>You must register for GST if you carry on a business and your "
        "GST turnover is $75,000 or more.</p>"
    )
    ext = _get("gst_registration_threshold")
    assert ext.extract(html) == 75_000.0


def test_gst_registration_threshold_with_commas() -> None:
    html = "<p>Your GST turnover reaches $75,000 or more per year.</p>"
    ext = _get("gst_registration_threshold")
    assert ext.extract(html) == 75_000.0


def test_gst_registration_threshold_no_match() -> None:
    html = "<p>Completely irrelevant content here.</p>"
    ext = _get("gst_registration_threshold")
    assert ext.extract(html) is None


def test_tax_free_threshold_extracted() -> None:
    html = (
        "<tr><td>$0 – $18,200</td><td>Nil</td></tr>"
        "<tr><td>$18,201 – $45,000</td><td>Taxable income × 16%...</td></tr>"
    )
    ext = _get("tax_free_threshold")
    assert ext.extract(html) == 18_200.0


def test_cgt_discount_extracted() -> None:
    html = (
        "<p>Individuals may be eligible for a 50% CGT discount "
        "if they held the asset for more than 12 months.</p>"
    )
    ext = _get("cgt_discount_individual")
    assert ext.extract(html) == 50.0


def test_super_concessional_cap_extracted() -> None:
    html = (
        "<p>The concessional contributions cap for 2024–25 is $30,000 "
        "per person per year.</p>"
    )
    ext = _get("super_concessional_cap")
    assert ext.extract(html) == 30_000.0


def test_instant_asset_write_off_extracted() -> None:
    html = (
        "<p>You can claim an immediate deduction for a depreciating asset "
        "that costs less than $20,000.</p>"
    )
    ext = _get("instant_asset_write_off")
    assert ext.extract(html) == 20_000.0


def test_all_extractors_have_required_fields() -> None:
    for ext in EXTRACTORS:
        assert ext.name, f"Extractor missing name: {ext}"
        assert ext.url.startswith("https://"), f"URL must be HTTPS: {ext.url}"
        assert ext.pattern, f"Pattern required: {ext.name}"
        assert ext.unit in ("AUD", "percent"), f"Unknown unit: {ext.unit}"


# ---------------------------------------------------------------------------
# Integration test: extract_all with mocked HTTP
# ---------------------------------------------------------------------------

@respx.mock
@pytest.mark.asyncio
async def test_extract_all_mocked() -> None:
    """extract_all returns structured rows for each matched extractor."""
    # Set up minimal HTML responses for the key URLs.
    GST_URL = (
        "https://www.ato.gov.au/businesses-and-organisations/"
        "gst-excise-and-indirect-taxes/gst/registering-for-gst"
    )
    TAX_RATES_URL = (
        "https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents"
    )

    # Mock all unique URLs from the extractor catalogue.
    seen: set[str] = set()
    for ext in EXTRACTORS:
        if ext.url not in seen:
            seen.add(ext.url)
            if ext.url == GST_URL:
                html = (
                    "<p>GST turnover is $75,000 or more.</p>"
                    "<p>not-for-profit organisations $150,000.</p>"
                )
            elif ext.url == TAX_RATES_URL:
                html = "<td>$0 – $18,200</td><td>Nil</td>"
            else:
                html = "<p>Placeholder content — no match expected.</p>"
            respx.get(ext.url).mock(return_value=httpx.Response(200, text=html))

    async with httpx.AsyncClient() as client:
        rows = await extract_all(client)

    # We expect at least the GST threshold and tax-free threshold to match.
    names = {r["name"] for r in rows}
    assert "gst_registration_threshold" in names
    assert "tax_free_threshold" in names

    # All rows must have the required structure.
    for row in rows:
        assert isinstance(row["value"], float)
        assert row["unit"] in ("AUD", "percent")
        assert "name" in row
        assert "effective_from" in row
