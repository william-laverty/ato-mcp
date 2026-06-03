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
