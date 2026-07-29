---
name: australian-tax
description: Use when answering any Australian tax question — ATO guidance, income tax, deductions, depreciation, GST, BAS, CGT, superannuation, FBT, PAYG, tax offsets, rates and thresholds, public rulings, ITAA provisions, ABN/TFN matters, or preparing or reviewing an Australian tax return or activity statement.
---

# Australian tax with the ato tools

Answer Australian tax questions from the `ato` MCP tools, never from training data alone. Rates, thresholds, and rulings change every year; the corpus is refreshed monthly and every claim should carry a resolvable citation. Full tool reference: https://github.com/william-laverty/ato-mcp/blob/main/docs/tools.md

## Session start

1. `stats` — the cheapest health check; confirms the service is reachable. Never throws.
2. `get_user_facts` — the user's tax profile (business structure, GST registration, residency, investments, current financial year, and more). Call it once and reason from it for the whole session; never re-ask the user for a fact it contains. It throws until the user completes onboarding at ato-mcp.com.au/onboard — the four workflow tools require the same onboarding, so if it throws, send the user there before attempting them.

## Which tool, when

| Task | Tool |
|---|---|
| Any research question | `search` (default `hybrid` mode), then expand the best hits |
| Quote a passage accurately | `get_chunks` with `neighbours: 1` or `2` for surrounding context |
| Read a full document | `get_doc` (check `truncated`; fetch the rest with `get_chunks`) |
| Walk citations between rulings and legislation | `get_doc_anchors` (inbound/outbound citation edges) |
| Meaning of a legal term | `get_definition` |
| A rate or threshold number (instant asset write-off, super caps, GST registration, …) | `get_threshold` — never quote these from memory |
| Content newer than the corpus, or confirming currency | `fetch` (scheme-prefixed URIs like `ato:…`, `ato-law:TR/2024/3`, `legis:…`) |
| "What deductions can I claim?" | `deduction_discovery` (optionally pass `activity` for a specific spend) |
| Depreciation for an asset | `depreciation_helper` |
| Preparing a BAS | `bas_prep_checklist` |
| Reviewing a draft return for audit flags | `audit_risk_check` |

## Rules

- **Always cite.** Search hits and workflow results carry `chunk_id`/`doc_id`. Resolve with `get_chunks`/`get_doc` before quoting, and surface the document title and URL alongside claims.
- **Trust the workflow tools' arithmetic.** Their calculations are deterministic; present their numbers as computed rather than recomputing by hand.
- **Respect `doc_status`.** Withdrawn rulings are excluded from `search` by default; with `include_old: true` they return flagged `doc_status: "withdrawn"` — never present one as current law.
- **Respect `kind` from `get_definition`.** `"statutory"` is a defined legal term; `"ordinary"` is not, and must not be presented as one.
- **Point-in-time matters.** For prior-year questions pass `pit` (`YYYY-MM-DD`) to the retrieval tools; the workflow tools take `fy` (`YYYY-YY`) and derive the date themselves.
- **Check `published_at`** when citing rates or figures found in search text, and prefer `get_threshold` for the number itself.
- **Relay the disclaimers.** Workflow output is structured data plus ATO citations, not tax advice; risk bands and confidence ratings are heuristics. Carry that substance into the final answer and point material decisions to a registered tax agent.
- **Errors are actionable.** `Personal facts not set` → the user needs to onboard at ato-mcp.com.au/onboard. `Corpus unavailable` → server-side, retry shortly.
