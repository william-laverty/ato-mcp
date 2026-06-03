// Generates src/data/deduction-categories.ts from the verified spec taxonomy
// JSON plus an explicit overrides map (kind / dedupe_key / residency_caveat /
// fy_note). Re-run with: pnpm --filter @ato-mcp/shared gen:deductions
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SPEC = new URL("../../../docs/superpowers/specs/2026-06-03-deduction-discovery-taxonomy.json", import.meta.url);
const OUT = new URL("../src/data/deduction-categories.ts", import.meta.url);

const KIND = {
  rental_travel_disallowed_note: "disallowance",
  rental_vacant_land_holding_costs: "disallowance",
  spouse_super_contribution_offset: "offset",
  crypto_cgt_on_disposal: "cgt_event",
  personal_super_notice_of_intent: "precondition",
  personal_super_carry_forward_concessional: "strategy",
  fhss_personal_contribution_notes: "strategy",
};
const DEDUPE_KEY = {
  personal_super_concessional_deduction: "super_personal_290_150",
  st_personal_super_contribution: "super_personal_290_150",
  smsf_member_personal_super_deduction: "super_personal_290_150",
  wre_income_protection_insurance: "income_protection_8_1",
  income_protection_insurance_premiums: "income_protection_8_1",
};
const RESIDENCY_CAVEAT = new Set([
  "crypto_cgt_on_disposal", // 50% CGT discount restricted for foreign residents
  "st_home_based_business", // main-residence CGT interaction
]);
const FY_NOTE = {
  wre_managing_tax_affairs:
    "ATO interest charges (GIC/SIC) incurred on or after 1 July 2025 are NOT deductible. Only charges incurred before 1 July 2025 are deductible.",
};

const raw = JSON.parse(readFileSync(fileURLToPath(SPEC), "utf8"));
const rows = raw.map((c) => ({
  id: c.id,
  label: c.label,
  kind: KIND[c.id] ?? "deduction",
  structures: c.structures,
  return_context: c.return_context,
  triggers: c.triggers ?? [],
  ...(DEDUPE_KEY[c.id] ? { dedupe_key: DEDUPE_KEY[c.id] } : {}),
  seed_queries: c.seed_queries ?? [],
  seed_doc_ids: c.seed_doc_ids ?? [],
  thresholds: c.thresholds ?? [],
  examples: c.examples ?? [],
  substantiation: c.substantiation ?? "",
  consider_prompt: c.consider_prompt ?? "",
  ato_focus_area: Boolean(c.ato_focus_area),
  legal_basis: c.legal_basis ?? "",
  ...(RESIDENCY_CAVEAT.has(c.id) ? { residency_caveat: true } : {}),
  ...(FY_NOTE[c.id] ? { fy_note: FY_NOTE[c.id] } : {}),
  ...(c.notes ? { notes: c.notes } : {}),
}));

const header = `// GENERATED FILE — do not edit by hand.
// Source: docs/superpowers/specs/2026-06-03-deduction-discovery-taxonomy.json
// Regenerate: pnpm --filter @ato-mcp/shared gen:deductions
import type { DeductionCategory } from "../tools/deduction_discovery.js";

export const DEDUCTION_CATEGORIES: DeductionCategory[] = ${JSON.stringify(rows, null, 2)};
`;

mkdirSync(fileURLToPath(new URL("../src/data/", import.meta.url)), { recursive: true });
writeFileSync(fileURLToPath(OUT), header);
console.log(`Wrote ${rows.length} categories to src/data/deduction-categories.ts`);
