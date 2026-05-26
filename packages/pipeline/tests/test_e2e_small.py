import json
import sqlite3
from pathlib import Path
from unittest.mock import patch

import pytest


@pytest.mark.slow
def test_build_pipeline_with_mocked_pages(tmp_path: Path, monkeypatch):
    """E2E: skip the network. Inject fake pages, run cleaning->chunking->embed->package."""
    out_dir = tmp_path / "out"
    out_dir.mkdir()

    fake_pages = [
        (
            "https://www.ato.gov.au/test/deductions",
            "<html><head><title>Deductions you can claim | ATO</title></head>"
            "<body><main><h1>Deductions</h1><p>You can claim work uniform expenses if they're occupation-specific.</p>"
            "<h2>Records</h2><p>Keep your receipts for five years.</p></main></body></html>",
        ),
        (
            "https://www.ato.gov.au/test/gst",
            "<html><head><title>GST registration | ATO</title></head>"
            "<body><main><h1>GST</h1><p>Register for GST when your turnover exceeds 75000 dollars.</p></main></body></html>",
        ),
    ]

    async def fake_crawl(_cfg):
        return fake_pages

    from ato_pipeline import cli as cli_module
    monkeypatch.setattr(cli_module, "crawl", fake_crawl)

    from typer.testing import CliRunner

    runner = CliRunner()
    result = runner.invoke(
        cli_module.app,
        ["build", "--out-dir", str(out_dir), "--max-total-pages", "10", "--mode", "bfs"],
    )
    assert result.exit_code == 0, result.output

    db_path = out_dir / "ato.sqlite"
    assert db_path.exists()

    conn = sqlite3.connect(db_path)
    assert conn.execute("SELECT COUNT(*) FROM docs").fetchone()[0] == 2
    assert conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0] >= 2
    # FTS finds something tax-related
    row = conn.execute(
        "SELECT chunk_id FROM fts_chunks WHERE fts_chunks MATCH 'uniform' ORDER BY rank LIMIT 1"
    ).fetchone()
    assert row is not None
