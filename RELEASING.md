# Releasing

## Software releases (npm)

The publishable packages are `@ato-mcp/shared` and `ato-mcp` (mcp depends on shared;
publish shared first — `pnpm publish` rewrites the `workspace:*` range automatically).

One-time setup (repo owner):
1. Create an npm automation token.
2. `gh secret set NPM_TOKEN` with that token (enables the publish workflow).
3. `gh variable set NPM_PUBLISH_ENABLED --body true` (gates the publish step).

Cutting a release:
```bash
# bump versions in packages/shared/package.json + packages/mcp/package.json (keep in lockstep)
pnpm -r build && pnpm -r test
git tag v1.1.0 && git push origin v1.1.0
gh release create v1.1.0 --title "v1.1.0" --notes-file <(sed -n '/^## v1.1.0/,/^## /p' CHANGELOG.md)
```
The `npm-publish` workflow publishes both packages on the `v*` release. Manual fallback:
```bash
pnpm --filter @ato-mcp/shared publish --access public --no-git-checks
pnpm --filter ato-mcp publish --access public --no-git-checks
```

## Corpus refreshes

Corpus refreshes happen in the **private `william-laverty/ato-mcp-engine` repo** — not here.
Trigger the `corpus-build` workflow via `workflow_dispatch` (Actions tab) or wait for the
monthly schedule (1st of month, 03:00 UTC). The workflow scrapes, embeds, indexes, and imports
the result directly into the production Supabase corpus; no GitHub release asset is produced.

This public repo has no corpus-build workflow. The only releases here are software (`v*`) releases.
