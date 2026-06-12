# Releasing

## Software releases (npm)

The publishable packages are `@ato-mcp/shared` and `@ato-mcp/mcp` (mcp depends on shared;
publish shared first — `pnpm publish` rewrites the `workspace:*` range automatically).

One-time setup (repo owner):
1. Create the npm org `ato-mcp` (https://www.npmjs.com/org/create) and an automation token.
2. `gh secret set NPM_TOKEN` with that token (enables the publish workflow).

Cutting a release:
```bash
# bump versions in packages/shared/package.json + packages/mcp/package.json (keep in lockstep)
pnpm -r build && pnpm -r test
git tag v1.0.0 && git push origin v1.0.0
gh release create v1.0.0 --title "v1.0.0" --notes-file <(sed -n '/^## 1.0.0/,/^## /p' CHANGELOG.md)
```
The `npm-publish` workflow publishes both packages on the `v*` release. Manual fallback:
```bash
pnpm --filter @ato-mcp/shared publish --access public --no-git-checks
pnpm --filter @ato-mcp/mcp publish --access public --no-git-checks
```

## Corpus releases

`corpus-build.yml` runs monthly (or via workflow_dispatch): scrape → embed → package →
GitHub release tagged `corpus-vYYYY.MM` with `ato-corpus-v*.sqlite.zst` + `manifest.json`,
marked `--latest=false` so software releases stay "latest". The client (`ato-mcp update`)
selects the newest release that carries a corpus asset, so the two release families never
conflict. If ato.gov.au blocks CI scraping, build from a machine that can reach it and run
`uv run ato-pipeline package --db <ato.sqlite> ...` + `gh release create` manually.

A corpus release must have: matching `embedding_model` in the manifest
(`sentence-transformers/all-MiniLM-L6-v2`), correct `corpus_sha256` (of the *uncompressed*
SQLite), and the standard table counts sanity-checked (docs ≥ 29k, thresholds = 8).
