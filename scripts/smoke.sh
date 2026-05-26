#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[smoke] Building TypeScript packages..."
pnpm -r build

echo "[smoke] Building a tiny corpus from mocked pages..."
cd packages/pipeline
uv run python -c "
import asyncio, sys
from pathlib import Path
from unittest.mock import patch

async def fake_crawl(_cfg):
    return [
        ('https://www.ato.gov.au/test/deductions',
         '<html><head><title>Deductions | ATO</title></head><body><main>'
         '<h1>Deductions</h1><p>You can claim work uniform expenses that are occupation-specific.</p>'
         '<h2>Records</h2><p>Keep your receipts for five years.</p>'
         '</main></body></html>'),
        ('https://www.ato.gov.au/test/gst',
         '<html><head><title>GST | ATO</title></head><body><main>'
         '<h1>GST</h1><p>Register for GST when annual turnover reaches 75000 dollars.</p>'
         '</main></body></html>'),
    ]

from ato_pipeline import cli as cli_module
from typer.testing import CliRunner

out_dir = Path('corpus-smoke')
runner = CliRunner()
with patch.object(cli_module, 'crawl', fake_crawl):
    result = runner.invoke(cli_module.app, ['--out-dir', str(out_dir)])
print(result.output)
sys.exit(result.exit_code)
"
cd "$ROOT"

CORPUS_PATH="$ROOT/packages/pipeline/corpus-smoke/ato.sqlite"
test -f "$CORPUS_PATH" || { echo "[smoke] ERROR: corpus not built"; exit 1; }

echo "[smoke] Installing corpus into a temp data dir..."
DATA_DIR="$(mktemp -d)"
export ATO_MCP_DATA_DIR="$DATA_DIR"
node packages/mcp/bin/ato-mcp.js update "$CORPUS_PATH"

echo "[smoke] Verifying stats..."
node packages/mcp/bin/ato-mcp.js stats

echo "[smoke] OK"
rm -rf "$DATA_DIR"
rm -rf "$ROOT/packages/pipeline/corpus-smoke"
