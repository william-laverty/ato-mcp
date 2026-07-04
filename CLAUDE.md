# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **This repo is PUBLIC.** It contains only the thin npm client. Never add anything here that describes how the hosted platform, database, ranking, or corpus pipeline works — that all lives in private repos. Keep credentials and internal operational detail out of every file, commit message, and issue.

## What this is

`ato-mcp` is the public npm client for the hosted ato-mcp service (`ato-mcp.com.au`): AI agents get cited retrieval over the Australian Taxation Office corpus plus personal-context and workflow tools, over the MCP stdio protocol.

The client is a **self-contained branded stdio proxy**: it speaks MCP over stdio to the host
and internally proxies to the hosted endpoint (`https://api.ato-mcp.com.au/mcp`) via the
bundled `mcp-remote`, which performs the browser OAuth handshake (DCR + PKCE) and caches/
refreshes tokens under `~/.mcp-auth`. There is no local corpus, no offline mode, no token
environment variable, and no dependency on any private package.

## Layout

```
packages/mcp/          the npm package (unscoped: ato-mcp)
  bin/ato-mcp.js       CLI entry → dist/index.js
  src/index.ts         command dispatch (`mcp` default, `help`) + spawns mcp-remote's proxy
  test/                resolveProxyArgs unit tests + CLI smoke coverage
docs/tools.md          user-facing tool reference (inputs/outputs/examples)
scripts/smoke.sh       build + CLI help smoke test
```

## Commands

```bash
pnpm install
pnpm -r build && pnpm -r typecheck && pnpm -r test
pnpm test:smoke
node packages/mcp/bin/ato-mcp.js   # run the stdio proxy; first run opens the browser to sign in
```

## Rules

- **Stay self-contained.** No `@ato-mcp/*` workspace deps, no native deps beyond `mcp-remote`.
  The package must install instantly via `npx -y ato-mcp`.
- **No token auth.** The hosted service only accepts browser OAuth; there is no
  `ATO_MCP_TOKEN` and never will be again.
- **Never merge a branch whose git ancestry predates the 2026-07-02 baseline commit** — the repo history was intentionally reset; old ancestry must not be reintroduced.
- `ATO_MCP_URL` is the only supported override (points mcp-remote at a different hosted endpoint).

## Release & publish

Cut a `v*` GitHub release → `npm-publish.yml` builds, tests, and publishes to npm via **OIDC Trusted Publishing** (no stored token), gated by the `NPM_PUBLISH_ENABLED` repo variable, provenance-signed. See `RELEASING.md`.

GitHub rulesets: `protect-main` (require PR + the `node` status check; block force-push/deletion; admin bypass), `protect-release-tags` (block deletion/update of `v*` tags).
