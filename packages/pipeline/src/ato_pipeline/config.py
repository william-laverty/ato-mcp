from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class PipelineConfig:
    out_dir: Path = field(default_factory=lambda: Path("corpus-out"))
    user_agent: str = "ato-pro/0.1 (+https://github.com/williaml/ato-pro)"
    request_timeout_s: float = 30.0
    request_concurrency: int = 4
    request_per_host_delay_s: float = 0.5
    # ATO sitemap seeds for v0.1. Each yields <= max_pages_per_seed pages.
    ato_seeds: tuple[str, ...] = (
        "https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim",
        "https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/income-and-deductions-for-business",
        "https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst",
        "https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/business-activity-statements-bas",
        "https://www.ato.gov.au/individuals-and-families/jobs-and-employment-types/working-as-a-contractor",
    )
    max_pages_per_seed: int = 80
    max_total_pages: int = 300
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    chunk_max_chars: int = 1800  # ~450 tokens at ~4 chars/token
    chunk_overlap_chars: int = 200
