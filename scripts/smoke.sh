#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[smoke] Building TypeScript packages..."
pnpm -r build

echo "[smoke] Verifying hosted client: missing token fails with guidance..."
OUT="$(node packages/mcp/bin/ato-mcp.js mcp 2>&1 || true)"
echo "$OUT" | grep -q "ATO_MCP_TOKEN" || { echo "[smoke] ERROR: expected ATO_MCP_TOKEN guidance"; exit 1; }
echo "$OUT" | grep -q "ato-mcp.com.au/onboard" || { echo "[smoke] ERROR: expected onboard URL"; exit 1; }

echo "[smoke] Verifying CLI help lists hosted usage..."
node packages/mcp/bin/ato-mcp.js help | grep -q "ATO_MCP_TOKEN" || { echo "[smoke] ERROR: help missing token guidance"; exit 1; }

echo "[smoke] OK"
