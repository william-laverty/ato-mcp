# ato-pro

Local-first MCP server for the Australian Taxation Office corpus. v0.1 scaffolding release.

## Status

**v0.1** — works locally with a small ATO corpus. Tools: `search`, `get_chunks`, `fetch`, `stats`. See `docs/superpowers/specs/` for the full design and `docs/superpowers/plans/` for the v0.1 plan.

## Quick start

```bash
# Install JS deps
pnpm install

# Build Python pipeline
cd packages/pipeline && uv sync && cd ../..

# Run tests
pnpm test

# Build a small corpus (~5 minutes, includes model download)
cd packages/pipeline && uv run ato-pipeline --out-dir corpus-out && cd ../..

# Install corpus
node packages/mcp/bin/ato-pro-mcp.js update ./packages/pipeline/corpus-out/ato.sqlite

# Verify
node packages/mcp/bin/ato-pro-mcp.js stats

# Smoke test (no network)
bash scripts/smoke.sh
```

## Register with Claude Code

In `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "ato-pro": {
      "command": "node",
      "args": ["/absolute/path/to/ato-pro/packages/mcp/bin/ato-pro-mcp.js", "mcp"]
    }
  }
}
```

## Layout

- `packages/mcp/` — Node MCP server
- `packages/pipeline/` — Python corpus builder
- `packages/shared/` — shared TypeScript types

## License

MIT. ATO content remains subject to the ATO's publication terms.
