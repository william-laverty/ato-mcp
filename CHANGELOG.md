# Changelog

## v1.1.2

- `serverInfo.version` now reads from `package.json` instead of a hardcoded
  string, so the MCP handshake always reports the released version (#39).
- Invalid/revoked-token (401) errors now include recovery guidance pointing to
  ato-mcp.com.au/account and /onboard; 429s advise retrying; raw validation
  (400) payloads are collapsed into concise human-readable messages (#40).
- `fetch` tool: when the source site blocks automated access, `ato:` and
  `ato-law:` URIs are now served from the stored corpus copy (marked
  `served_from: "corpus"` with `retrieved_at`); other failures raise a tool
  error instead of a silent empty-body success. `stats` no longer returns the
  legacy `data_dir`, `corpus_path`, and `staleness_days` fields (docs updated
  to match the hosted API).

## v1.1.1

- No functional changes. Repository restructure: this repo now contains only the
  open-source client; the hosted platform moved to a private repository. Rebuilt
  and re-published with fresh provenance from the restructured repo; dropped
  stale devDependencies from the package manifest.

## v1.1.0

- **Hosted-only.** The `ato-mcp` client forwards every tool call to
  api.ato-mcp.com.au using `ATO_MCP_TOKEN`. The package has no native runtime
  deps and installs instantly via `npx`.
- **Renamed** the npm package `@ato-mcp/mcp` → `ato-mcp` (unscoped).
- The corpus is maintained privately and served only from the hosted backend.

## 1.0.0 — 2026-06

First public release.

- **Four workflow tools** (`deduction_discovery`, `depreciation_helper`, `bas_prep_checklist`,
  `audit_risk_check`): cited, structure-aware tax workflows for every Australian taxpayer
  shape — 59-category deduction taxonomy, deterministic depreciation schedules, tiered BAS
  checklists, heuristic audit red-flags.
- **Personal facts layer**: 25-field profile captured once via web onboarding
  (magic-link auth), served to agents via `get_user_facts`.
- **Corpus**: 29,000+ docs — ato.gov.au guidance, ITAA 1997 (4,638 sections,
  1,929 statutory definitions), 2,127 typed ATO rulings, 23,267-edge citation graph,
  time-keyed thresholds. Refreshed monthly.
- **Hardening before launch**: citation-resolution fault tolerance (bounded fan-out,
  per-leg survival, explicit degradation notes) and a consolidated backend dispatcher.
- 317 TypeScript tests; authenticated end-to-end production verification.

## 0.4.0 — 2026-06

Hero workflow tools shipped (all four).

## 0.3.0 — 2026-05

Personal-context release: shared tool core refactor, UserFactsSchema + `get_user_facts`,
Next.js onboarding at ato-mcp.com.au, hosted backend, bearer auth.

## 0.2.0 — 2026-05

Wider corpus coverage: ITAA 1997, typed law.ato.gov.au rulings,
`get_definition` / `get_doc_anchors` / `get_threshold` / `fetch`.

## 0.1.0 — 2026-05

Scaffolding: monorepo, initial ATO corpus, MCP server with
`search` / `get_chunks` / `fetch` / `stats`.
