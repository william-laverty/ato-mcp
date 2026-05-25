"""Regex-based tax threshold extractors.

Each extractor targets a specific ATO web page and uses a pinned regex to
pull the numeric value of a well-known tax threshold or limit. The URL and
pattern are hand-maintained and should be re-verified after ATO website
updates.

The 5 most important thresholds for Phase B:
    1. gst_registration_threshold             — $75,000
    2. instant_asset_write_off                — $20,000 (2024-25)
    3. cgt_discount_individual                — 50%
    4. super_concessional_cap                 — $30,000 (2024-25)
    5. tax_free_threshold                     — $18,200
"""
from __future__ import annotations

import re
from dataclasses import dataclass

import httpx


@dataclass
class ThresholdExtractor:
    """Definition of a single threshold extraction rule."""

    name: str
    url: str
    pattern: str
    unit: str
    effective_from: str | None
    description: str

    def extract(self, html: str) -> float | None:
        """Return the extracted value or None if the pattern does not match."""
        m = re.search(self.pattern, html, re.IGNORECASE | re.DOTALL)
        if not m:
            return None
        raw = m.group(1).replace(",", "").replace("$", "").replace("%", "").strip()
        try:
            return float(raw)
        except ValueError:
            return None


# ---------------------------------------------------------------------------
# Extractor catalogue
# ---------------------------------------------------------------------------

EXTRACTORS: list[ThresholdExtractor] = [
    # 1. GST registration threshold — $75,000 for general businesses.
    ThresholdExtractor(
        name="gst_registration_threshold",
        url=(
            "https://www.ato.gov.au/businesses-and-organisations/"
            "gst-excise-and-indirect-taxes/gst/registering-for-gst"
        ),
        # Match "your GST turnover is $75,000 or more" or similar phrasing.
        pattern=r"\$\s*([\d,]+)\s+or\s+more",
        unit="AUD",
        effective_from="2007-07-01",
        description="GST registration threshold for general businesses (annual turnover)",
    ),
    # 2. GST registration threshold for non-profits — $150,000.
    ThresholdExtractor(
        name="gst_registration_threshold_nonprofit",
        url=(
            "https://www.ato.gov.au/businesses-and-organisations/"
            "gst-excise-and-indirect-taxes/gst/registering-for-gst"
        ),
        # Look for non-profit/not-for-profit context then dollar amount.
        pattern=r"not[- ]for[- ]profit[^.]{0,200}\$\s*([\d,]+)",
        unit="AUD",
        effective_from="2007-07-01",
        description="GST registration threshold for not-for-profit organisations",
    ),
    # 3. Instant asset write-off threshold (2024-25 FY: $20,000).
    ThresholdExtractor(
        name="instant_asset_write_off",
        url=(
            "https://www.ato.gov.au/businesses-and-organisations/"
            "income-deductions-and-concessions/income-and-deductions-for-business/"
            "deductions/depreciation-of-assets/"
            "simpler-depreciation-for-small-business/"
            "instant-asset-write-off"
        ),
        # Match "less than $X,000" or "$X,000 threshold".
        pattern=r"less\s+than\s+\$\s*([\d,]+)",
        unit="AUD",
        effective_from="2023-07-01",
        description="Instant asset write-off threshold for small business",
    ),
    # 4. CGT discount for individuals — 50%.
    ThresholdExtractor(
        name="cgt_discount_individual",
        url=(
            "https://www.ato.gov.au/individuals-and-families/"
            "investments-and-assets/capital-gains-tax/"
            "cgt-discount"
        ),
        # "50% discount" or "50 per cent discount"
        pattern=r"(50)\s*(?:%|per\s+cent)\s+(?:CGT\s+)?discount",
        unit="percent",
        effective_from="1999-09-21",
        description="CGT 50% discount for individuals holding asset > 12 months",
    ),
    # 5. Superannuation concessional cap (2024-25: $30,000).
    ThresholdExtractor(
        name="super_concessional_cap",
        url=(
            "https://www.ato.gov.au/individuals-and-families/"
            "super/growing-and-keeping-track-of-your-super/"
            "caps-on-super-contributions/concessional-contributions-cap"
        ),
        # Match "$30,000" in a concessional contribution context.
        pattern=r"concessional\s+contributions\s+cap[^$]{0,200}\$\s*([\d,]+)",
        unit="AUD",
        effective_from="2024-07-01",
        description="Annual concessional (pre-tax) super contributions cap",
    ),
    # 6. Tax-free threshold — $18,200.
    ThresholdExtractor(
        name="tax_free_threshold",
        url=(
            "https://www.ato.gov.au/tax-rates-and-codes/"
            "tax-rates-australian-residents"
        ),
        # "$18,200" appears as the first bracket boundary.
        pattern=r"\$(18[,.]?200)",
        unit="AUD",
        effective_from="2012-07-01",
        description="Tax-free threshold for Australian resident individuals",
    ),
    # 7. Low income tax offset (LITO) max — $700.
    ThresholdExtractor(
        name="low_income_tax_offset_max",
        url=(
            "https://www.ato.gov.au/tax-rates-and-codes/"
            "tax-offsets"
        ),
        pattern=r"low\s+income\s+tax\s+offset[^$]{0,200}\$\s*([\d,]+)",
        unit="AUD",
        effective_from="2022-07-01",
        description="Maximum low income tax offset (LITO)",
    ),
    # 8. Small business income tax offset (max) — 16% up to $1,000.
    ThresholdExtractor(
        name="small_business_income_tax_offset_cap",
        url=(
            "https://www.ato.gov.au/individuals-and-families/"
            "income-deductions-offsets-and-records/"
            "offsets-and-rebates/small-business-income-tax-offset"
        ),
        pattern=r"\$\s*(1[,.]?000)\s+(?:maximum|cap|limit)",
        unit="AUD",
        effective_from="2021-07-01",
        description="Maximum small business income tax offset",
    ),
]


# ---------------------------------------------------------------------------
# Async batch extractor
# ---------------------------------------------------------------------------

async def extract_all(client: httpx.AsyncClient) -> list[dict]:
    """Fetch and extract all registered thresholds.

    Returns a list of threshold dicts ready for insertion into the
    ``thresholds`` SQLite table.
    """
    rows: list[dict] = []
    seen_urls: dict[str, str] = {}  # url -> html cache

    for ext in EXTRACTORS:
        html = seen_urls.get(ext.url)
        if html is None:
            try:
                resp = await client.get(ext.url)
                html = resp.text if resp.status_code == 200 else ""
            except httpx.HTTPError:
                html = ""
            seen_urls[ext.url] = html

        value = ext.extract(html)
        if value is None:
            continue

        rows.append(
            {
                "name": ext.name,
                "value": value,
                "unit": ext.unit,
                "effective_from": ext.effective_from,
                "effective_to": None,
                "source_doc_id": None,
                "source_anchor": None,
            }
        )

    return rows
