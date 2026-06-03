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
