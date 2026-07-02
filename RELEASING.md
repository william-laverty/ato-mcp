# Releasing

The publishable package is `ato-mcp`. `@ato-mcp/shared` is a dev-only dependency of the
client and is **not published** to npm.

Publishing uses **npm Trusted Publishing (OIDC)** — no stored token. The Trusted Publisher
is configured on npmjs.com (GitHub Actions → this repo → `npm-publish.yml`), and the
publish step is gated by the `NPM_PUBLISH_ENABLED` repository variable.

Cutting a release:

```bash
# bump version in packages/mcp/package.json
pnpm -r build && pnpm -r test
git tag v1.1.0 && git push origin v1.1.0
gh release create v1.1.0 --title "v1.1.0" --notes-file <(sed -n '/^## v1.1.0/,/^## /p' CHANGELOG.md)
```

The `npm-publish` workflow builds, tests, and publishes `ato-mcp` on the `v*` release
with provenance.

The corpus is maintained privately; this repository only ships software (`v*`) releases.
