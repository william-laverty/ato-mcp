/** Website-facing tool summaries. Full reference: docs/tools.md in the repo. */

export interface ToolMeta {
  name: string;
  group: "Retrieval" | "Personal context" | "Workflows";
  summary: string;
  example: string;
}

export const TOOLS_META: ToolMeta[] = [
  {
    name: "search",
    group: "Retrieval",
    summary: "Hybrid BM25 + vector search over the whole corpus, rank-fused, point-in-time aware.",
    example: `search({ query: "instant asset write-off eligibility", k: 5 })`,
  },
  {
    name: "get_chunks",
    group: "Retrieval",
    summary: "Resolve chunk_ids to full passages with optional neighbouring context.",
    example: `get_chunks({ chunk_ids: ["legis:…/8-1#0"], neighbours: 1 })`,
  },
  {
    name: "get_doc",
    group: "Retrieval",
    summary: "Fetch a whole document — metadata plus its anchor list.",
    example: `get_doc({ doc_id: "legis:c2004a05138/8-1" })`,
  },
  {
    name: "get_doc_anchors",
    group: "Retrieval",
    summary: "The citation graph around a document: anchors, inbound and outbound references.",
    example: `get_doc_anchors({ doc_id: "legis:c2004a05138/8-1" })`,
  },
  {
    name: "get_definition",
    group: "Retrieval",
    summary: "Statutory definitions (ITAA 1997 Dictionary and friends), point-in-time selectable.",
    example: `get_definition({ term: "depreciating asset" })`,
  },
  {
    name: "get_threshold",
    group: "Retrieval",
    summary: "Time-keyed scalar facts — IAWO limit, GST registration threshold, CGT discount, super caps.",
    example: `get_threshold({ name: "instant_asset_write_off" })`,
  },
  {
    name: "fetch",
    group: "Retrieval",
    summary: "Live-fetch a page by URI scheme (ato:, ato-law:, legis:) when freshness matters.",
    example: `fetch({ uri: "ato:tax-rates-and-codes/…" })`,
  },
  {
    name: "stats",
    group: "Retrieval",
    summary: "Corpus snapshot: counts, schema version, staleness.",
    example: `stats({})`,
  },
  {
    name: "get_user_facts",
    group: "Personal context",
    summary: "Your onboarded profile — 25 facts the agent reads once per session instead of re-asking.",
    example: `get_user_facts({})`,
  },
  {
    name: "deduction_discovery",
    group: "Workflows",
    summary: "Every plausibly-applicable deduction category for your taxpayer shape, cited and confidence-rated.",
    example: `deduction_discovery({ activity: "bought a laptop" })`,
  },
  {
    name: "depreciation_helper",
    group: "Workflows",
    summary: "Prime-cost / diminishing-value / IAWO / pool / Div 43 schedules, computed deterministically.",
    example: `depreciation_helper({ asset_cost: 4800, acquisition_date: "2025-09-01", effective_life_years: 3 })`,
  },
  {
    name: "bas_prep_checklist",
    group: "Workflows",
    summary: "A tiered, cited BAS checklist for your reporting period — labels, evidence, gotchas.",
    example: `bas_prep_checklist({ period_type: "quarterly", quarter: 2 })`,
  },
  {
    name: "audit_risk_check",
    group: "Workflows",
    summary: "Heuristic ATO red-flags over a draft return, risk-banded with the guidance behind each.",
    example: `audit_risk_check({ income: 90000, deductions: [...] })`,
  },
];
