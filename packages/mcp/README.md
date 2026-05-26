# @ato-mcp/mcp

Node.js MCP server for the Australian Taxation Office corpus. v0.1 scaffolding release.

## Install (development)

```bash
pnpm install
pnpm --filter @ato-mcp/mcp build
```

## Build a local corpus

```bash
cd packages/pipeline
uv sync
uv run ato-pipeline --out-dir corpus-out --max-total-pages 100
```

## Install corpus into data dir

```bash
node packages/mcp/bin/ato-mcp.js update ./packages/pipeline/corpus-out/ato.sqlite
```

## Verify

```bash
node packages/mcp/bin/ato-mcp.js stats
```

## Register with Claude Code

In your Claude Code MCP config (`~/.claude/settings.json` or workspace settings):

```json
{
  "mcpServers": {
    "ato-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/ato-mcp/packages/mcp/bin/ato-mcp.js", "mcp"]
    }
  }
}
```

## v0.1 tools

- `stats` — corpus version + counts
- `search` — hybrid BM25 + vector retrieval
- `get_chunks` — fetch chunks by id with neighbour context
- `fetch` — live `ato:<path>` retrieval for pages not in the corpus

See `docs/superpowers/specs/2026-05-25-ato-mcp-design.md` for the full v1 design.
