from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class PipelineConfig:
    out_dir: Path = field(default_factory=lambda: Path("corpus-out"))
    user_agent: str = "ato-mcp/0.1 (+https://github.com/williaml/ato-mcp)"
    request_timeout_s: float = 30.0
    request_concurrency: int = 6
    request_per_host_delay_s: float = 0.3
    # Sitemap-based crawl: authoritative URL list from ato.gov.au/sitemap.xml.
    # We filter to sections that contain tax-substantive content.
    sitemap_url: str = "https://www.ato.gov.au/sitemap.xml"
    sitemap_include_prefixes: tuple[str, ...] = (
        "https://www.ato.gov.au/individuals-and-families/",
        "https://www.ato.gov.au/businesses-and-organisations/",
        "https://www.ato.gov.au/forms-and-instructions/",
        "https://www.ato.gov.au/tax-and-super-professionals/",
        "https://www.ato.gov.au/tax-rates-and-codes/",
        "https://www.ato.gov.au/calculators-and-tools/",
        "https://www.ato.gov.au/online-services/",
    )
    # Legacy BFS seeds — kept for the existing test suite as a fallback mode.
    ato_seeds: tuple[str, ...] = (
        "https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim",
        "https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/income-and-deductions-for-business",
        "https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst",
        "https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/business-activity-statements-bas",
        "https://www.ato.gov.au/individuals-and-families/jobs-and-employment-types/working-as-a-contractor",
    )
    max_pages_per_seed: int = 80
    max_total_pages: int = 0  # 0 = no cap; take whatever the sitemap yields after filtering
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    chunk_max_chars: int = 1800  # ~450 tokens at ~4 chars/token
    chunk_overlap_chars: int = 200
