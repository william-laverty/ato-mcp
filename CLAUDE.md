# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **This repo is PUBLIC.** It contains only the thin npm client. Never add anything here that describes how the hosted platform, database, ranking, or corpus pipeline works — that all lives in private repos. Keep credentials and internal operational detail out of every file, commit message, and issue.

## What this is

`ato-mcp` is the public npm client for the hosted ato-mcp service (`ato-mcp.com.au`): AI agents get cited retrieval over the Australian Taxation Office corpus plus personal-context and workflow tools, over the MCP stdio protocol.

The client is a **self-contained thin forwarder**: it reads `ATO_MCP_TOKEN` from the environment, registers the 13 tool schemas, and forwards every tool call to `api.ato-mcp.com.au` over HTTPS. There is no local corpus, no offline mode, and no dependency on any private package.

## Layout

```
packages/mcp/          the npm package (unscoped: ato-mcp)
  bin/ato-mcp.js       CLI entry (default action: stdio MCP server; also `help`, `onboard`)
  src/server.ts        MCP server + the 13 inlined tool JSON Schemas (TOOLS map)
  src/lib/remote-tools.ts   RemoteToolForwarder — the only thing the client does
  src/lib/onboard.ts   opens the browser to ato-mcp.com.au/onboard
  test/                server registration, forwarder, and MCP-protocol e2e tests
docs/tools.md          user-facing tool reference (inputs/outputs/examples)
scripts/smoke.sh       build + token-guidance + help smoke test
```

## Commands

```bash
pnpm install
pnpm -r build && pnpm -r typecheck && pnpm -r test
pnpm test:smoke
ATO_MCP_TOKEN=... node packages/mcp/bin/ato-mcp.js   # run the stdio server
```

## Rules

- **Stay self-contained.** No `@ato-mcp/*` workspace deps, no native deps. The package must install instantly via `npx -y ato-mcp`.
- **Tool schemas are duplicated by design.** The hosted API implements the tools; this repo inlines their JSON Schemas in `src/server.ts`. A tool change is coordinated with the hosted platform and must update `docs/tools.md` too.
- **Never merge a branch whose git ancestry predates the 2026-07-02 baseline commit** — the repo history was intentionally reset; old ancestry must not be reintroduced.
- Errors must carry user guidance (token missing → point to `ato-mcp.com.au/onboard`).

## Release & publish

Cut a `v*` GitHub release → `npm-publish.yml` builds, tests, and publishes to npm via **OIDC Trusted Publishing** (no stored token), gated by the `NPM_PUBLISH_ENABLED` repo variable, provenance-signed. See `RELEASING.md`.

GitHub rulesets: `protect-main` (require PR + the `node` status check; block force-push/deletion; admin bypass), `protect-release-tags` (block deletion/update of `v*` tags).
