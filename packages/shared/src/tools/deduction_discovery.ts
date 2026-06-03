import type { UserFacts } from "../facts.js";

export type BusinessStructure = UserFacts["business_structure"];
export type FactsOp = "truthy" | "falsy" | "eq" | "in";
export interface FactsPredicate {
  field: keyof UserFacts;
  op: FactsOp;
  value?: string;
}
export type CategoryKind =
  | "deduction" | "offset" | "cgt_event" | "disallowance" | "precondition" | "strategy";

export interface DeductionCategory {
  id: string;
  label: string;
  kind: CategoryKind;
  structures: BusinessStructure[];
  return_context: "personal" | "business_entity";
  triggers: FactsPredicate[];
  dedupe_key?: string;
  seed_queries: string[];
  seed_doc_ids: string[];
  thresholds: string[];
  examples: string[];
  substantiation: string;
  consider_prompt: string;
  ato_focus_area: boolean;
  legal_basis: string;
  residency_caveat?: boolean;
  fy_note?: string;
  notes?: string;
}

export function evalPredicate(facts: UserFacts, p: FactsPredicate): boolean {
  const v = facts[p.field];
  switch (p.op) {
    case "truthy": return Boolean(v);
    case "falsy": return !v;
    case "eq": return String(v) === p.value;
    case "in": return (p.value ?? "").split(",").map((s) => s.trim()).includes(String(v));
  }
}

export function categoryApplies(facts: UserFacts, c: DeductionCategory): boolean {
  if (!c.structures.includes(facts.business_structure)) return false;
  return c.triggers.every((t) => evalPredicate(facts, t));
}

/** Lower = more structure-specific (fewer structures, more triggers). */
function specificity(c: DeductionCategory): number {
  return c.structures.length * 10 - c.triggers.length;
}

/** Collapse categories that share a dedupe_key to a single (most-specific) row. */
export function dedupe(cats: DeductionCategory[]): DeductionCategory[] {
  const indexByKey = new Map<string, number>();
  const out: DeductionCategory[] = [];
  for (const c of cats) {
    if (!c.dedupe_key) { out.push(c); continue; }
    const existingIdx = indexByKey.get(c.dedupe_key);
    if (existingIdx === undefined) {
      indexByKey.set(c.dedupe_key, out.length);
      out.push(c);
    } else if (specificity(c) < specificity(out[existingIdx]!)) {
      out[existingIdx] = c;
    }
  }
  return out;
}

import type { Citation } from "../lib/citations.js";

export type Confidence = "high" | "medium" | "low";

export function rateConfidence(
  c: DeductionCategory,
  citations: Citation[],
): { confidence: Confidence; confidence_reason: string } {
  const cited = citations.length > 0;
  const explicit = c.triggers.length > 0;
  if (!cited) {
    return { confidence: "low", confidence_reason: "Surfaced for completeness; no live ATO citation resolved — verify applicability before claiming." };
  }
  if (explicit) {
    return { confidence: "high", confidence_reason: `Matches your stated facts and is backed by ${citations.length} ATO source(s).` };
  }
  return { confidence: "medium", confidence_reason: `Applies to your taxpayer type; backed by ${citations.length} general ATO source(s).` };
}

function tokenize(s: string): Set<string> {
  return new Set((s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2));
}

export interface ActivityCandidate { id: string; label: string; examples: string[] }

export function matchActivity(
  activity: string,
  surfaced: ActivityCandidate[],
): { category_id: string; rationale: string } | null {
  const a = tokenize(activity);
  if (a.size === 0) return null;
  let best: ActivityCandidate | null = null;
  let bestScore = 0;
  for (const s of surfaced) {
    const t = tokenize([s.label, ...s.examples].join(" "));
    let overlap = 0;
    for (const w of a) if (t.has(w)) overlap++;
    if (overlap > bestScore) { bestScore = overlap; best = s; }
  }
  if (!best || bestScore < 2) return null;
  return { category_id: best.id, rationale: `Activity text best matches "${best.label}" (${bestScore} shared terms).` };
}

export function buildNotes(facts: UserFacts): string[] {
  const notes: string[] = [];
  if (["company", "trust", "partnership"].includes(facts.business_structure)) {
    notes.push(`Your ${facts.business_structure} lodges its own return — categories marked return_context "business_entity" belong on that return, not your individual return.`);
  }
  if (facts.business_structure === "sole_trader") {
    notes.push("Personal services income (PSI) rules can restrict some business deductions — check whether your income is PSI before claiming.");
  }
  if (facts.residency_status !== "resident") {
    notes.push(`As a ${facts.residency_status.replace(/_/g, " ")}, your resident status affects some concessions (the 50% CGT discount, tax-free threshold, main-residence exemption) — verify eligibility.`);
  }
  return notes;
}

import type { Store, ThresholdRow } from "../store/types.js";
import type { Embedder } from "../embed/types.js";
import type { DeductionDiscoveryInput } from "../tools.js";
import { resolveCitations } from "../lib/citations.js";
import { DEDUCTION_CATEGORIES } from "../data/deduction-categories.js";

const DISCLAIMER =
  "This tool retrieves and structures ATO material; it is not tax advice. Verify material decisions with a registered tax agent.";

export interface DeductionDiscoveryDeps {
  store: Store | null;
  embedder: Embedder;
  userFacts: UserFacts | null;
}

export interface SurfacedCategory {
  id: string;
  label: string;
  kind: CategoryKind;
  return_context: "personal" | "business_entity";
  confidence: Confidence;
  confidence_reason: string;
  applies_because: string;
  examples: string[];
  substantiation: string;
  consider_prompt: string;
  ato_focus_area: boolean;
  legal_basis: string;
  thresholds: ThresholdRow[];
  citations: Citation[];
  residency_caveat?: string;
  fy_note?: string;
}

export interface DeductionDiscoveryOutput {
  fy: string;
  taxpayer_profile: {
    business_structure: BusinessStructure;
    residency_status: UserFacts["residency_status"];
    has_abn: boolean;
    occupation?: string;
    industry_code?: string;
    flags: string[];
  };
  activity?: string;
  categories: SurfacedCategory[];
  matched_activity: { category_id: string; rationale: string } | null;
  counts: Record<CategoryKind, number>;
  notes: string[];
  disclaimer: string;
}

/** FY "2025-26" → a point-in-time date inside that FY (30 June of the ending year). */
function fyToPit(fy: string): string {
  const start = parseInt(fy.slice(0, 4), 10);
  return `${start + 1}-06-30`;
}

function explain(c: DeductionCategory, facts: UserFacts): string {
  const parts = [`Applies to your structure (${facts.business_structure}).`];
  for (const t of c.triggers) {
    parts.push(`You indicated ${t.field}${t.op === "eq" ? ` = ${t.value}` : ""}.`);
  }
  return parts.join(" ");
}

function profileFlags(facts: UserFacts): string[] {
  const f: string[] = [];
  if (facts.has_investment_property) f.push("has_investment_property");
  if (facts.has_shares_or_managed_funds) f.push("has_shares_or_managed_funds");
  if (facts.has_crypto) f.push("has_crypto");
  if (facts.has_spouse) f.push("has_spouse");
  if (facts.gst_registered) f.push("gst_registered");
  if (facts.fbt_payer) f.push("fbt_payer");
  if (facts.super_fund_type === "smsf") f.push("smsf");
  return f;
}

const KIND_ORDER: CategoryKind[] = ["deduction", "cgt_event", "offset", "strategy", "precondition", "disallowance"];
const CONF_ORDER: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };

export async function deductionDiscovery(
  deps: DeductionDiscoveryDeps,
  args: DeductionDiscoveryInput,
): Promise<DeductionDiscoveryOutput> {
  if (!deps.userFacts) {
    throw new Error("Personal facts not set. Run `ato-mcp onboard` to complete the web onboarding flow.");
  }
  if (!deps.store) {
    throw new Error("Corpus not installed. Run `ato-mcp update` to download the latest corpus, then retry.");
  }
  const facts = deps.userFacts;
  const store = deps.store;
  const fy = args.fy ?? facts.current_fy;
  const pit = fyToPit(fy);

  const applicable = DEDUCTION_CATEGORIES.filter((c) => categoryApplies(facts, c));
  const deduped = dedupe(applicable);

  let surfaced: SurfacedCategory[] = await Promise.all(
    deduped.map(async (c): Promise<SurfacedCategory> => {
      const citations = await resolveCitations({ store, embedder: deps.embedder }, c.seed_queries, {
        k: args.k_citations,
        pit,
        pinnedDocIds: c.seed_doc_ids,
      });
      const thresholds = (
        await Promise.all(c.thresholds.map((n) => store.getThreshold(n, pit)))
      ).filter((t): t is ThresholdRow => t !== null);
      const { confidence, confidence_reason } = rateConfidence(c, citations);
      return {
        id: c.id,
        label: c.label,
        kind: c.kind,
        return_context: c.return_context,
        confidence,
        confidence_reason,
        applies_because: explain(c, facts),
        examples: c.examples,
        substantiation: c.substantiation,
        consider_prompt: c.consider_prompt,
        ato_focus_area: c.ato_focus_area,
        legal_basis: c.legal_basis,
        thresholds,
        citations,
        ...(c.residency_caveat && facts.residency_status !== "resident"
          ? { residency_caveat: `Your residency status (${facts.residency_status.replace(/_/g, " ")}) may restrict this concession — verify eligibility.` }
          : {}),
        ...(c.fy_note ? { fy_note: c.fy_note } : {}),
      };
    }),
  );

  if (!args.include_low_confidence) {
    surfaced = surfaced.filter((s) => s.confidence !== "low");
  }

  surfaced.sort((a, b) => {
    if (a.ato_focus_area !== b.ato_focus_area) return a.ato_focus_area ? -1 : 1;
    const k = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    if (k !== 0) return k;
    return CONF_ORDER[a.confidence] - CONF_ORDER[b.confidence];
  });

  const matched_activity = args.activity
    ? matchActivity(args.activity, surfaced.map((s) => ({ id: s.id, label: s.label, examples: s.examples })))
    : null;

  const counts: Record<CategoryKind, number> = {
    deduction: 0, offset: 0, cgt_event: 0, disallowance: 0, precondition: 0, strategy: 0,
  };
  for (const s of surfaced) counts[s.kind]++;

  return {
    fy,
    taxpayer_profile: {
      business_structure: facts.business_structure,
      residency_status: facts.residency_status,
      has_abn: facts.has_abn,
      ...(facts.occupation ? { occupation: facts.occupation } : {}),
      ...(facts.industry_code ? { industry_code: facts.industry_code } : {}),
      flags: profileFlags(facts),
    },
    ...(args.activity ? { activity: args.activity } : {}),
    categories: surfaced,
    matched_activity,
    counts,
    notes: buildNotes(facts),
    disclaimer: DISCLAIMER,
  };
}
