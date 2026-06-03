// ---------------------------------------------------------------------------
// Derived metrics for audit_risk_check. Pure.
// ---------------------------------------------------------------------------
import type { AuditRiskCheckInput } from "../tools.js";
import type { Store } from "../store/types.js";
import type { Embedder } from "../embed/types.js";
import type { UserFacts } from "../facts.js";
import { resolveCitations, type Citation } from "../lib/citations.js";

const WRE_KEYWORDS = [
  "work-related", "work related", "wre", "car", "travel", "clothing", "laundry", "uniform",
  "self-education", "self education", "home office", "working from home", "wfh", "phone",
  "internet", "mobile", "tools", "equipment", "union", "professional",
];

export interface DerivedMetrics {
  total_deductions: number | null;
  deduction_to_income_pct: number | null;
  wre_total: number;
  round_number_claims: number;
  hasCategory(keywords: string[]): boolean;
  categoryAmount(keywords: string[]): number;
}

function matches(category: string, keywords: string[]): boolean {
  const c = category.toLowerCase();
  return keywords.some((k) => c.includes(k));
}

export function deriveMetrics(input: AuditRiskCheckInput): DerivedMetrics {
  const ded = input.deductions ?? [];
  const total = ded.length > 0 ? ded.reduce((a, d) => a + d.amount, 0) : null;
  const wre = ded.filter((d) => matches(d.category, WRE_KEYWORDS)).reduce((a, d) => a + d.amount, 0);
  const round = ded.filter((d) => d.amount >= 300 && d.amount % 100 === 0).length;
  return {
    total_deductions: total,
    deduction_to_income_pct: total !== null && input.income !== undefined && input.income > 0 ? (total / input.income) * 100 : null,
    wre_total: wre,
    round_number_claims: round,
    hasCategory: (keywords) => ded.some((d) => matches(d.category, keywords)),
    categoryAmount: (keywords) => ded.filter((d) => matches(d.category, keywords)).reduce((a, d) => a + d.amount, 0),
  };
}

// ---------------------------------------------------------------------------
// Risk-rule catalogue, types, and the auditRiskCheck() tool.
// ---------------------------------------------------------------------------

export type BusinessStructure = UserFacts["business_structure"];
export type RiskBand = "low" | "medium" | "high";

const DISCLAIMER =
  "This tool flags patterns the ATO is known to scrutinise; it is not tax advice, not an audit prediction, and not an ATO determination. The risk bands are heuristic indicators. Verify each claim and keep records, and consult a registered tax agent for material decisions.";

interface RiskRule {
  id: string;
  title: string;
  default_band: RiskBand;
  pattern: string;
  what_to_do: string;
  seed_queries: string[];
  seed_doc_ids: string[];
  legal_basis: string | null;
  detect: (facts: UserFacts, input: AuditRiskCheckInput, m: DerivedMetrics) => { why_flagged: string; band?: RiskBand } | null;
}

const RISK_RULES: RiskRule[] = [
  {
    id: "wre_high_vs_income", title: "Work-related expenses high relative to income", default_band: "medium",
    pattern: "The ATO compares total work-related expense claims against income and occupation norms; unusually high WRE attracts review.",
    what_to_do: "Keep written evidence for every claim and confirm each expense was incurred earning your income and not reimbursed.",
    seed_queries: ["work-related expenses what attracts our attention", "claiming work-related deductions records"],
    seed_doc_ids: ["ato:individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions", "legis:c2004a05138/8-1"],
    legal_basis: "ITAA 1997 s 8-1; substantiation Div 900",
    detect: (_f, i, m) => {
      if (i.income === undefined || i.income <= 0 || m.wre_total <= 0) return null;
      const pct = (m.wre_total / i.income) * 100;
      if (pct <= 12) return null;
      return { why_flagged: `Your work-related expense claims (about $${Math.round(m.wre_total)}) are ~${pct.toFixed(0)}% of your income, above the ~12% level that typically draws attention.`, band: pct >= 20 ? "high" : "medium" };
    },
  },
  {
    id: "deductions_exceed_income", title: "Total deductions exceed income", default_band: "medium",
    pattern: "Deductions exceeding income (a loss), especially from business or rental, can engage the non-commercial loss rules and ATO review.",
    what_to_do: "Confirm the activity is genuinely income-producing and check whether the non-commercial loss rules defer the loss.",
    seed_queries: ["non-commercial losses rules deferral", "what is a non-commercial loss"],
    seed_doc_ids: ["ato:businesses-and-organisations/income-deductions-and-concessions/losses/non-commercial-losses"],
    legal_basis: "ITAA 1997 Div 35 (non-commercial losses)",
    detect: (_f, i, m) => (m.total_deductions !== null && i.income !== undefined && m.total_deductions > i.income)
      ? { why_flagged: `Your total deductions ($${Math.round(m.total_deductions)}) exceed your stated income ($${Math.round(i.income)}).` } : null,
  },
  {
    id: "large_round_numbers", title: "Large round-number claims", default_band: "low",
    pattern: "Claims made up of round numbers suggest estimates rather than records; the ATO flags round-figure deductions.",
    what_to_do: "Replace estimates with actual amounts from receipts and contemporaneous records.",
    seed_queries: ["records you need to claim a deduction", "evidence to support work-related deduction claims"],
    seed_doc_ids: ["ato:individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions"],
    legal_basis: "ITAA 1997 Div 900 (substantiation)",
    detect: (_f, _i, m) => m.round_number_claims >= 1
      ? { why_flagged: `${m.round_number_claims} of your claims are exact round numbers (multiples of $100 at or above $300), which can indicate estimates rather than records.`, band: m.round_number_claims >= 3 ? "medium" : "low" } : null,
  },
  {
    id: "near_300_substantiation", title: "Claim at the $300 written-evidence limit", default_band: "medium",
    pattern: "A claim sitting right at $300 can look like an attempt to stay under the written-evidence threshold for work expenses.",
    what_to_do: "Only claim what you actually incurred; you must still be able to show how a claim was worked out, even under $300.",
    seed_queries: ["$300 work-related expenses without receipts", "work expense records under $300"],
    seed_doc_ids: ["ato:individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions"],
    legal_basis: "ITAA 1997 Div 900",
    detect: (_f, i) => ((i.deductions ?? []).some((d) => d.amount >= 295 && d.amount <= 300))
      ? { why_flagged: "A claim sits right at the $300 written-evidence limit." } : null,
  },
  {
    id: "car_near_cap", title: "Car expense claim near the cents-per-km cap", default_band: "low",
    pattern: "Car claims near the maximum a 5,000-business-km cents-per-kilometre claim can produce are a common review trigger.",
    what_to_do: "Keep a logbook or a diary basis showing how the business kilometres were worked out.",
    seed_queries: ["work-related car expenses cents per kilometre 5000 km", "D1 car expenses logbook"],
    seed_doc_ids: ["ato:forms-and-instructions/individual-tax-return-2025-instructions/deduction-questions-d1-d10-individual-tax-return-2025/d1-work-related-car-expenses-2025"],
    legal_basis: "ITAA 1997 Div 28",
    detect: (_f, _i, m) => { const car = m.categoryAmount(["car", "motor vehicle", "cents per", "logbook"]); return car >= 3300 && car <= 5000 ? { why_flagged: `Your car expense claim ($${Math.round(car)}) is near the maximum a cents-per-kilometre claim (5,000 business km) can produce.` } : null; },
  },
  {
    id: "wfh_phone_double", title: "Working-from-home and phone/internet double-claim", default_band: "medium",
    pattern: "The working-from-home fixed rate already bundles phone and internet, so a separate phone/internet claim risks double-counting.",
    what_to_do: "If you used the WFH fixed rate, do not also claim phone and internet for the same usage.",
    seed_queries: ["PCG 2023/1 working from home fixed rate phone internet included", "double claiming working from home phone internet"],
    seed_doc_ids: ["ato-law:PCG/2023/1"],
    legal_basis: "PCG 2023/1",
    detect: (_f, _i, m) => (m.hasCategory(["working from home", "home office", "wfh"]) && m.hasCategory(["phone", "internet", "mobile"]))
      ? { why_flagged: "You have claimed both working-from-home running costs and a separate phone/internet amount — the WFH fixed rate already bundles phone and internet." } : null,
  },
  {
    id: "clothing_high", title: "Clothing/laundry claim above the no-receipt limit", default_band: "low",
    pattern: "The ATO scrutinises clothing claims because conventional/everyday clothing is not deductible even if required for work.",
    what_to_do: "Confirm the clothing is a compulsory/registered uniform, occupation-specific, or protective; keep receipts above the $150 laundry limit.",
    seed_queries: ["work clothing uniform laundry deduction TR 97/12", "clothing laundry $150 limit"],
    seed_doc_ids: ["ato-law:TXR/TR9712/NAT/ATO/00001"],
    legal_basis: "ITAA 1997 Div 34; TR 97/12",
    detect: (_f, _i, m) => { const c = m.categoryAmount(["clothing", "laundry", "uniform", "dry-clean", "dry clean"]); return c > 150 ? { why_flagged: `Your clothing/laundry claim ($${Math.round(c)}) exceeds the $150 laundry no-receipt limit; conventional clothing is not deductible.` } : null; },
  },
  {
    id: "self_education_present", title: "Self-education connection to current work", default_band: "low",
    pattern: "The ATO checks that self-education has a sufficient connection to your current income-earning activity.",
    what_to_do: "Keep evidence the study maintains or improves the skills you use in your current job (not a new field).",
    seed_queries: ["self-education expenses connection to current employment TR 2024/3", "work-related self-education deduction"],
    seed_doc_ids: ["ato-law:TR/2024/3"],
    legal_basis: "ITAA 1997 s 8-1; TR 2024/3",
    detect: (_f, _i, m) => m.hasCategory(["self-education", "self education", "course", "study", "tuition"])
      ? { why_flagged: "You have a self-education claim; the ATO checks the connection to your current work (study for a new career is not deductible)." } : null,
  },
  {
    id: "rental_deductions_no_income", title: "Rental deductions with no rental income", default_band: "high",
    pattern: "Claiming rental deductions while reporting no rental income suggests the property may not be genuinely available for rent.",
    what_to_do: "Confirm the property was genuinely available for rent for the period; apportion for any private use or vacancy.",
    seed_queries: ["rental property genuinely available for rent deductions", "rental expenses when property not rented TR 2026/1"],
    seed_doc_ids: ["ato-law:TR/2026/1"],
    legal_basis: "ITAA 1997 s 8-1; TR 2026/1",
    detect: (f, i) => {
      const rd = (i.rental?.interest ?? 0) + (i.rental?.repairs ?? 0) + (i.rental?.capital_works ?? 0);
      return (f.has_investment_property && rd > 0 && (i.rental?.income === undefined || i.rental.income === 0))
        ? { why_flagged: `You have rental deductions (about $${Math.round(rd)}) but no rental income recorded — the property must be genuinely available for rent.` } : null;
    },
  },
  {
    id: "rental_interest_vs_income", title: "Rental interest exceeds rental income", default_band: "medium",
    pattern: "High rental interest relative to income draws attention to interest apportionment and the use of borrowed funds.",
    what_to_do: "Confirm the loan was used wholly to produce rental income and apportion out any private/redraw portion.",
    seed_queries: ["rental property loan interest deduction apportionment", "interest deductibility use of borrowed funds TR 95/25"],
    seed_doc_ids: ["ato-law:TXR/TR9525/NAT/ATO/00001"],
    legal_basis: "ITAA 1997 s 8-1; TR 95/25",
    detect: (_f, i) => (i.rental?.interest !== undefined && i.rental?.income !== undefined && i.rental.income > 0 && i.rental.interest > i.rental.income)
      ? { why_flagged: `Your rental interest ($${Math.round(i.rental.interest)}) exceeds your rental income ($${Math.round(i.rental.income)}).` } : null,
  },
  {
    id: "rental_repairs_large", title: "Large rental repairs claim", default_band: "medium",
    pattern: "Large 'repairs' claims are scrutinised for capital improvements or initial repairs misclassified as immediately deductible repairs.",
    what_to_do: "Separate genuine repairs (deductible) from improvements and initial repairs (capital — depreciated instead).",
    seed_queries: ["rental repairs versus capital improvements TR 97/23", "deductions for repairs rental property"],
    seed_doc_ids: ["ato-law:TXR/TR9723/NAT/ATO/00001"],
    legal_basis: "ITAA 1997 s 25-10; TR 97/23",
    detect: (_f, i) => { const rep = i.rental?.repairs; return (rep !== undefined && rep > 0 && (rep > 5000 || (i.rental?.income !== undefined && rep > i.rental.income))) ? { why_flagged: `Your rental repairs claim ($${Math.round(rep)}) is large relative to the income or in absolute terms; check it is not a capital improvement.` } : null; },
  },
  {
    id: "crypto_unreported", title: "Crypto held but no capital gain reported", default_band: "medium",
    pattern: "The ATO data-matches crypto exchanges; holding crypto with no disposal/gain reported is a common discrepancy.",
    what_to_do: "Report every crypto disposal (including crypto-to-crypto swaps) as a CGT event, or confirm you made no disposals.",
    seed_queries: ["data matching for investment and assets crypto", "report CGT on crypto assets data matching"],
    seed_doc_ids: ["ato:individuals-and-families/your-tax-return/data-matching-letters/types-of-letters/data-matching-for-investment-and-assets"],
    legal_basis: "ITAA 1997 Pt 3-1 (CGT)",
    detect: (f, i, m) => (f.has_crypto && i.income !== undefined && !m.hasCategory(["crypto", "capital gain", "cgt"]))
      ? { why_flagged: "You hold crypto but your draft shows no crypto disposal or capital gain — the ATO data-matches crypto exchanges." } : null,
  },
  {
    id: "no_prior_year_lodged", title: "Prior-year return not lodged", default_band: "low",
    pattern: "Lodgement history forms part of the ATO's risk view; an outstanding prior-year return raises attention.",
    what_to_do: "Bring any outstanding prior-year returns up to date.",
    seed_queries: ["what attracts our attention small business lodgment", "outstanding lodgments ATO attention"],
    seed_doc_ids: ["ato:businesses-and-organisations/corporate-tax-measures-and-assurance/our-focus-areas-for-small-business/what-attracts-our-attention-in-small-business"],
    legal_basis: null,
    detect: (f) => f.prior_fy_lodged === false ? { why_flagged: "You indicated your prior-year return is not lodged." } : null,
  },
];

export interface AuditRiskCheckDeps {
  store: Store | null;
  embedder: Embedder;
  userFacts: UserFacts | null;
}

export interface AuditRiskFinding {
  id: string; title: string; risk_band: RiskBand;
  pattern: string; why_flagged: string; what_to_do: string;
  legal_basis: string | null; citations: Citation[];
}

export interface AuditRiskCheckOutput {
  fy: string;
  taxpayer_context: { business_structure: BusinessStructure; occupation: string | null; has_investment_property: boolean; has_crypto: boolean };
  summary: { income: number | null; total_deductions: number | null; deduction_to_income_pct: number | null };
  findings: AuditRiskFinding[];
  overall_risk: RiskBand;
  checked: string[];
  skipped: Array<{ id: string; reason: string }>;
  disclaimer: string;
  notes: string[];
}

function fyToPit(fy: string): string {
  const start = parseInt(fy.slice(0, 4), 10);
  return `${start + 1}-06-30`;
}
const BAND_ORDER: Record<RiskBand, number> = { high: 0, medium: 1, low: 2 };

export async function auditRiskCheck(
  deps: AuditRiskCheckDeps,
  args: AuditRiskCheckInput,
): Promise<AuditRiskCheckOutput> {
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
  const m = deriveMetrics(args);

  const checked: string[] = [];
  const findings: AuditRiskFinding[] = [];
  for (const rule of RISK_RULES) {
    checked.push(rule.id);
    const r = rule.detect(facts, args, m);
    if (!r) continue;
    const citations = await resolveCitations({ store, embedder: deps.embedder }, rule.seed_queries, { k: 3, pit, pinnedDocIds: rule.seed_doc_ids });
    findings.push({ id: rule.id, title: rule.title, risk_band: r.band ?? rule.default_band, pattern: rule.pattern, why_flagged: r.why_flagged, what_to_do: rule.what_to_do, legal_basis: rule.legal_basis, citations });
  }
  findings.sort((a, b) => BAND_ORDER[a.risk_band] - BAND_ORDER[b.risk_band]);

  const skipped: Array<{ id: string; reason: string }> = [];
  if (args.income === undefined) {
    skipped.push({ id: "wre_high_vs_income", reason: "no income provided — WRE-to-income ratio not assessed" });
    skipped.push({ id: "deductions_exceed_income", reason: "no income provided" });
  }
  if (!args.deductions || args.deductions.length === 0) {
    skipped.push({ id: "deduction_pattern_checks", reason: "no draft deductions provided — claim-pattern checks not assessed" });
  }

  return {
    fy,
    taxpayer_context: { business_structure: facts.business_structure, occupation: facts.occupation ?? null, has_investment_property: facts.has_investment_property, has_crypto: facts.has_crypto },
    summary: { income: args.income ?? null, total_deductions: m.total_deductions, deduction_to_income_pct: m.deduction_to_income_pct },
    findings,
    overall_risk: findings.length > 0 ? findings[0]!.risk_band : "low",
    checked,
    skipped,
    disclaimer: DISCLAIMER,
    notes: ["Risk bands are heuristic indicators based on conservative thresholds — they are not an audit prediction or an ATO determination.", "This tool does not compare your figures against ATO benchmark numbers (numeric benchmarking is a future enhancement)."],
  };
}
