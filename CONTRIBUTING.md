# Contributing

Thanks for helping make Australian tax legible to AI agents. Issues and PRs are welcome.

## Setup

```bash
pnpm install && pnpm -r build      # Node 22+, pnpm 10 (pinned via packageManager)
cd packages/pipeline && uv sync    # Python 3.12+ with uv (pipeline only)
```

## Before you open a PR

```bash
pnpm -r typecheck
pnpm -r test                                   # TypeScript suites
cd packages/pipeline && uv run pytest -k "not slow"   # if you touched the pipeline
```

All four TS workspaces must be green. CI runs the same commands.

## Layout and conventions

- **Tool logic lives in `packages/shared/src/tools/`** as pure `(deps, args) => result`
  functions against the `Store`/`Embedder` interfaces. Both the local MCP and the hosted
  backend run this exact code — never fork behaviour per mode.
- New tools need: a Zod input schema in `shared/src/tools.ts`, registration in
  `mcp/src/server.ts`, a dispatch entry in `backend/api/[tool].ts`, a subpath export in
  `shared/package.json`, unit tests (mock the store/embedder), and a row in `docs/tools.md`.
- **No advice in a tool's own voice.** Tools return structured data + resolvable citations;
  the agent does the prose. Every workflow tool carries a disclaimer. This is a hard
  product rule, not a style preference.
- No silent failures: throw actionable errors ("Run `ato-mcp onboard`…"), and surface any
  degraded behaviour explicitly in the output.
- Corpus-grounded data (e.g. the deduction taxonomy) must cite doc_ids that exist — there
  are integrity tests for this.

## Tax-law correctness

If a change encodes tax law (a rule, rate, date, or threshold), link the controlling source
(ITAA section / ruling / ATO page) in the PR description. Time-sensitive figures belong in
the `thresholds` table — never hardcoded.

## Releases

See [RELEASING.md](RELEASING.md). Corpus releases are automated monthly; software releases
are tagged `v*`.
