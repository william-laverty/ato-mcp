#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[smoke] Building TypeScript packages..."
pnpm -r build

echo "[smoke] Verifying CLI help exits 0 and prints the hosted endpoint..."
OUT="$(node packages/mcp/bin/ato-mcp.js help)"
echo "$OUT" | grep -q "https://api.ato-mcp.com.au/mcp" || { echo "[smoke] ERROR: help missing endpoint URL"; exit 1; }
echo "$OUT" | grep -q "ato-mcp.com.au/install" || { echo "[smoke] ERROR: help missing install link"; exit 1; }

echo "[smoke] OK"
