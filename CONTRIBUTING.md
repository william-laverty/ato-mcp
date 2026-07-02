# Contributing

Thanks for helping make Australian tax legible to AI agents. Issues and PRs are welcome.

This repository contains the **ato-mcp client** — the open-source npm package that runs on
your machine and forwards MCP tool calls to the hosted API. The retrieval platform and the
corpus are maintained privately; issues about tool behaviour, corpus coverage, or tax
content are still welcome here and will be routed to the right place.

## Setup

```bash
pnpm install && pnpm -r build      # Node 22+, pnpm 10 (pinned via packageManager)
```

## Before you open a PR

```bash
pnpm -r typecheck
pnpm -r test
pnpm test:smoke
```

CI runs the same commands.

## Conventions

- The client stays **thin and dependency-light**: it reads `ATO_MCP_TOKEN`, registers the
  tool schemas (`src/server.ts`), and forwards calls (`src/lib/remote-tools.ts`). No native
  deps, no local corpus, no tool logic — tool behaviour changes happen server-side.
- No silent failures: throw actionable errors ("Get your token at ato-mcp.com.au/onboard…"),
  and surface any degraded behaviour explicitly in the output.
- Tool schema changes must stay in sync with the hosted API and be reflected in
  [`docs/tools.md`](docs/tools.md).

## Tax content issues

If you're reporting incorrect tax information, link the controlling source (ITAA section /
ruling / ATO page) that shows the correct position — it makes fixes fast.

## Releases

See [RELEASING.md](RELEASING.md). Software releases are tagged `v*` and published to npm
via Trusted Publishing.
