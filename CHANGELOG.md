# Changelog

## 1.0.0 — 2026-06

First public release.

- **Four workflow tools** (`deduction_discovery`, `depreciation_helper`, `bas_prep_checklist`,
  `audit_risk_check`): cited, structure-aware tax workflows for every Australian taxpayer
  shape — 59-category deduction taxonomy, deterministic depreciation schedules, tiered BAS
  checklists, heuristic audit red-flags.
- **Personal facts layer**: 25-field profile captured once via web onboarding
  (magic-link auth), served to agents via `get_user_facts`.
- **Dual deployment modes** sharing one tool core: local (SQLite + sqlite-vec + ONNX,
  fully offline) and hosted (Vercel + Supabase pgvector at `api.ato-mcp.com.au`).
- **Corpus**: 29,181 docs / 224,585 chunks — ato.gov.au, ITAA 1997 (4,638 sections,
  1,929 statutory definitions), 2,127 typed ATO rulings, 23,267-edge citation graph,
  8 time-keyed thresholds. Monthly rebuild pipeline with sha256-verified releases.
- **Hardening before launch**: hosted `getThreshold` SETOF unwrap fix, citation-resolution
  fault tolerance (bounded fan-out, per-leg survival, explicit degradation notes), backend
  consolidated to a single dynamic dispatcher (16 → 4 serverless functions), corpus update
  client resilient to mixed software/corpus releases.
- 317 TypeScript tests + 85 pipeline tests; authenticated end-to-end production verification.

## 0.4.0 — 2026-06

Hero workflow tools shipped (all four), Vercel Web Analytics, Vercel Pro requirement
documented.

## 0.3.0 — 2026-05

Personal-context release: shared tool core refactor, UserFactsSchema + `get_user_facts`,
Next.js onboarding at ato-mcp.com.au, hosted backend (Vercel + Supabase + RLS), bearer auth.

## 0.2.0 — 2026-05

Wider corpus: ITAA 1997 ingest, typed law.ato.gov.au rulings, threshold extractors,
`get_definition` / `get_doc_anchors` / `get_threshold` / `fetch`, release flow scaffolding.

## 0.1.0 — 2026-05

Scaffolding: monorepo, ATO sitemap pipeline, sqlite-vec corpus, MCP server with
`search` / `get_chunks` / `fetch` / `stats`.
