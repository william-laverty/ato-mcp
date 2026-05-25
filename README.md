# ato-pro

Local-first MCP server for Australian Taxation Office content. v0.1 scaffolding — see `docs/superpowers/specs/` for the full design.

## Quick start (development)

```bash
pnpm install
pnpm test
```

## Layout

- `packages/mcp/` — Node.js MCP server (the thing Claude Code talks to)
- `packages/pipeline/` — Python corpus builder
- `packages/shared/` — TypeScript types shared between server and future hosted backend

## Status

v0.1 — scaffolding. Local corpus, four primitive tools. See plan at `docs/superpowers/plans/`.
