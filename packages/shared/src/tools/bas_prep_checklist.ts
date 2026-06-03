// ---------------------------------------------------------------------------
// Reporting-period + due-date helpers for bas_prep_checklist. Pure.
// AU BAS due dates (statutory): quarterly Q1 28 Oct, Q2 28 Feb, Q3 28 Apr, Q4 28 Jul.
// ---------------------------------------------------------------------------
import type { UserFacts } from "../facts.js";

export type PeriodType = "monthly" | "quarterly" | "annual" | "none";

export function mapGstPeriod(p: UserFacts["gst_period"]): PeriodType {
  if (p === "monthly" || p === "quarterly" || p === "annual") return p;
  return "none";
}

export function quarterlyDueDate(quarter: number, fy: string): string {
  const startYear = parseInt(fy.slice(0, 4), 10);
  switch (quarter) {
    case 1: return `${startYear}-10-28`;
    case 2: return `${startYear + 1}-02-28`;
    case 3: return `${startYear + 1}-04-28`;
    case 4: return `${startYear + 1}-07-28`;
    default: return "";
  }
}

export function dueDateFor(periodType: PeriodType, quarter: number | undefined, fy: string): string | null {
  if (periodType === "quarterly" && quarter) return quarterlyDueDate(quarter, fy);
  return null;
}

export function formFor(periodType: PeriodType): string {
  switch (periodType) {
    case "monthly": return "Monthly BAS";
    case "quarterly": return "Quarterly BAS";
    case "annual": return "Annual GST return (BAS Z)";
    default: return "Instalment activity statement (IAS)";
  }
}

export function periodLabel(periodType: PeriodType, quarter: number | undefined, fy: string): string {
  if (periodType === "quarterly" && quarter) return `FY${fy} Q${quarter}`;
  return `FY${fy} ${periodType}`;
}

// ---------------------------------------------------------------------------
// Catalogue, types, and the basPrepChecklist() tool
// ---------------------------------------------------------------------------
import type { Store } from "../store/types.js";
import type { Embedder } from "../embed/types.js";
import type { BasPrepChecklistInput } from "../tools.js";
import { resolveCitations, type Citation } from "../lib/citations.js";

export type BusinessStructure = UserFacts["business_structure"];
export type BasTier = "core" | "confirmed" | "conditional";

const DISCLAIMER =
  "This tool retrieves and structures ATO material to help you prepare your activity statement; it is not tax advice and does not calculate amounts. Verify with a registered tax or BAS agent.";

interface BasSectionDef {
  id: string;
  label: string;
  tier: BasTier;
  cross_cutting?: boolean;
  bas_labels: string[];
  applies: (facts: UserFacts, input: BasPrepChecklistInput) => boolean;
  appliesReason: (facts: UserFacts) => string;
  what_to_gather: string[];
  gotchas: string[];
  seed_queries: string[];
  seed_doc_ids: string[];
  legal_basis: string | null;
}

const reg = (f: UserFacts) => f.gst_registered;

const BAS_SECTIONS: BasSectionDef[] = [
  {
    id: "gst_total_sales", label: "Total sales (G1)", tier: "core", bas_labels: ["G1"],
    applies: reg, appliesReason: () => "You are registered for GST.",
    what_to_gather: ["Total of all sales for the period (including GST, GST-free and input-taxed sales)"],
    gotchas: ["G1 includes ALL sales, not just taxable ones.", "State whether the G1 amount includes GST."],
    seed_queries: ["G1 total sales BAS what to include", "simpler BAS GST bookkeeping G1 1A 1B"],
    seed_doc_ids: ["ato:businesses-and-organisations/preparing-lodging-and-paying/business-activity-statements-bas/goods-and-services-tax-gst/simpler-bas-gst-bookkeeping-guide"],
    legal_basis: "A New Tax System (GST) Act 1999",
  },
  {
    id: "gst_on_sales", label: "GST on sales (1A)", tier: "core", bas_labels: ["1A"],
    applies: reg, appliesReason: () => "You are registered for GST.",
    what_to_gather: ["GST collected on taxable sales for the period", "GST on any taxable sales of business assets"],
    gotchas: ["Include GST on sales of business assets (e.g. selling a work vehicle).", "Do not include GST-free or input-taxed sales."],
    seed_queries: ["1A GST on sales BAS label", "GST payable on sales activity statement"],
    seed_doc_ids: ["ato:businesses-and-organisations/gst-excise-and-indirect-taxes/gst/accounting-for-gst-in-your-business"],
    legal_basis: "A New Tax System (GST) Act 1999",
  },
  {
    id: "gst_on_purchases", label: "GST on purchases / credits (1B)", tier: "core", bas_labels: ["1B"],
    applies: reg, appliesReason: () => "You are registered for GST.",
    what_to_gather: ["GST credits on business purchases for the period"],
    gotchas: ["You need a valid tax invoice for purchases over $82.50 (incl GST).", "Exclude the private-use portion and purchases relating to input-taxed supplies."],
    seed_queries: ["1B GST on purchases credits BAS", "claiming GST credits valid tax invoice"],
    seed_doc_ids: ["ato:businesses-and-organisations/gst-excise-and-indirect-taxes/gst/accounting-for-gst-in-your-business"],
    legal_basis: "A New Tax System (GST) Act 1999",
  },
  {
    id: "gst_accounting_basis", label: "GST accounting basis & reporting method", tier: "core", bas_labels: [],
    applies: reg, appliesReason: () => "You are registered for GST.",
    what_to_gather: ["Confirm your GST accounting basis (cash or accruals) and reporting method (Simpler or full)"],
    gotchas: ["The basis determines WHEN a sale/purchase is reported (when paid vs when invoiced)."],
    seed_queries: ["accounting for GST cash vs accruals basis", "choosing GST reporting and accounting method"],
    seed_doc_ids: ["ato:businesses-and-organisations/gst-excise-and-indirect-taxes/gst/accounting-for-gst-in-your-business"],
    legal_basis: "A New Tax System (GST) Act 1999",
  },
  {
    id: "gst_full_method_labels", label: "Full GST method labels (G2, G3, G10, G11)", tier: "core", bas_labels: ["G2", "G3", "G10", "G11"],
    applies: (f, i) => reg(f) && i.full_gst_method, appliesReason: () => "You report using the full GST method (not Simpler BAS).",
    what_to_gather: ["G2 export sales", "G3 other GST-free sales", "G10 capital purchases", "G11 non-capital purchases"],
    gotchas: ["Only required if you are NOT using Simpler BAS.", "Capital vs non-capital purchases are split between G10 and G11."],
    seed_queries: ["full GST reporting method G2 G3 G10 G11 labels", "BAS labels capital and non-capital purchases"],
    seed_doc_ids: [],
    legal_basis: "A New Tax System (GST) Act 1999",
  },
  {
    id: "payg_income_instalment", label: "PAYG income tax instalment (T7)", tier: "confirmed", bas_labels: ["T1", "T2", "T7", "T11"],
    applies: (f) => f.payg_instalments, appliesReason: () => "You pay PAYG income tax instalments.",
    what_to_gather: ["Your instalment income for the period, OR the ATO-notified instalment amount (option 1)"],
    gotchas: ["This is a pre-payment of income tax, credited when you lodge your return.", "You can vary the instalment, but under-varying may attract interest."],
    seed_queries: ["PAYG instalments how to complete your activity statement", "PAYG instalment options instalment income or amount"],
    seed_doc_ids: ["ato:forms-and-instructions/payg-instalments-how-to-complete-your-activity-statement"],
    legal_basis: "Taxation Administration Act 1953 Sch 1 Pt 2-10",
  },
  {
    id: "fbt_instalment", label: "FBT instalment (F1–F4)", tier: "confirmed", bas_labels: ["F1", "F2", "F3", "F4"],
    applies: (f) => f.gst_registered && f.fbt_payer, appliesReason: () => "You are a registered FBT payer.",
    what_to_gather: ["Your ATO-notified FBT instalment amount, or a varied estimate"],
    gotchas: ["The annual FBT return is separate from these instalments.", "Only appears for taxpayers registered for FBT instalments."],
    seed_queries: ["FBT instalments on activity statement F1 F2 F3 F4", "fringe benefits tax instalment BAS"],
    seed_doc_ids: [],
    legal_basis: "Fringe Benefits Tax Assessment Act 1986",
  },
  {
    id: "payg_withholding", label: "PAYG withholding (W1, W2)", tier: "conditional", bas_labels: ["W1", "W2", "W3", "W4", "W5"],
    applies: reg, appliesReason: () => "Applies if you employ staff or withhold amounts (e.g. no-ABN withholding).",
    what_to_gather: ["W1 total payments to employees/contractors subject to withholding", "W2 total tax withheld"],
    gotchas: ["W2 should reconcile with your Single Touch Payroll (STP) reporting.", "Only applies if you withhold — otherwise skip."],
    seed_queries: ["PAYG withholding W1 W2 on activity statement", "reporting PAYG withholding on your BAS"],
    seed_doc_ids: [],
    legal_basis: "Taxation Administration Act 1953 Sch 1 Pt 2-5",
  },
  {
    id: "fuel_tax_credits", label: "Fuel tax credits (7D)", tier: "conditional", bas_labels: ["7D"],
    applies: reg, appliesReason: () => "Applies if you use fuel in machinery, plant or heavy vehicles for business.",
    what_to_gather: ["Litres of eligible fuel by activity for the period"],
    gotchas: ["Fuel tax credit rates change with indexation — use the rate for the period.", "Different rates apply to heavy vehicles on public roads vs off-road use."],
    seed_queries: ["work out your fuel tax credits BAS 7D", "fuel tax credits rates and eligibility"],
    seed_doc_ids: ["ato:businesses-and-organisations/income-deductions-and-concessions/incentives-and-concessions/fuel-schemes/in-detail/heavy-vehicles/work-out-your-fuel-tax-credits"],
    legal_basis: "Fuel Tax Act 2006",
  },
  {
    id: "wine_equalisation_tax", label: "Wine equalisation tax (1C, 1D)", tier: "conditional", bas_labels: ["1C", "1D"],
    applies: reg, appliesReason: () => "Applies if you make, import or wholesale wine.",
    what_to_gather: ["WET payable (1C) and WET refundable (1D) for the period"],
    gotchas: ["WET is in addition to GST.", "The producer rebate has eligibility limits and caps."],
    seed_queries: ["wine equalisation tax WET on activity statement 1C 1D", "WET producer rebate"],
    seed_doc_ids: [],
    legal_basis: "A New Tax System (Wine Equalisation Tax) Act 1999",
  },
  {
    id: "luxury_car_tax", label: "Luxury car tax (1E, 1F)", tier: "conditional", bas_labels: ["1E", "1F"],
    applies: reg, appliesReason: () => "Applies if you sell or import cars above the LCT threshold.",
    what_to_gather: ["LCT payable (1E) and LCT refundable (1F) for the period"],
    gotchas: ["LCT only applies above the annual LCT threshold (a higher threshold applies to fuel-efficient cars)."],
    seed_queries: ["luxury car tax LCT activity statement 1E 1F", "luxury car tax threshold"],
    seed_doc_ids: ["ato:forms-and-instructions/approved-forms-consolidated-list-by-tax-topic/luxury-car-tax"],
    legal_basis: "A New Tax System (Luxury Car Tax) Act 1999",
  },
  {
    id: "lodge_and_pay", label: "Lodge and pay", tier: "core", cross_cutting: true, bas_labels: [],
    applies: reg, appliesReason: () => "Every activity statement must be lodged and paid by the due date.",
    what_to_gather: ["Your lodgement channel (Online services for business, or a registered BAS/tax agent)", "Payment reference number (PRN) for payment"],
    gotchas: ["Lodge a 'nil' activity statement even if you had no activity for the period.", "Lodging through a registered agent or online may give a later due date."],
    seed_queries: ["lodge and pay your BAS due dates", "how to lodge business activity statement online services"],
    seed_doc_ids: ["ato:forms-and-instructions/approved-forms-consolidated-list-by-tax-topic/business-activity-statements-bas"],
    legal_basis: null,
  },
  {
    id: "records_and_corrections", label: "Records and correcting mistakes", tier: "core", cross_cutting: true, bas_labels: [],
    applies: () => true, appliesReason: () => "Record-keeping applies to every taxpayer.",
    what_to_gather: ["Tax invoices, receipts and working papers supporting each label"],
    gotchas: ["Keep records for 5 years.", "Small GST errors can be corrected on a later BAS within the correction limits; larger ones need a revision."],
    seed_queries: ["completing your BAS to correct GST errors", "keep records business activity statement five years"],
    seed_doc_ids: ["ato:businesses-and-organisations/gst-excise-and-indirect-taxes/gst/in-detail/managing-gst-in-your-business/reporting-paying-and-activity-statements/correcting-gst-errors/completing-your-bas-to-correct-gst-errors"],
    legal_basis: null,
  },
];

export interface BasPrepChecklistDeps {
  store: Store | null;
  embedder: Embedder;
  userFacts: UserFacts | null;
}

export interface BasSectionResult {
  id: string;
  label: string;
  tier: BasTier;
  applies_reason: string;
  bas_labels: string[];
  what_to_gather: string[];
  gotchas: string[];
  legal_basis: string | null;
  citations: Citation[];
}

export interface BasPrepChecklistOutput {
  registered: boolean;
  reporting: { period_type: PeriodType; period_label: string; form: string; due_date: string | null; simpler_bas: boolean };
  taxpayer_context: { business_structure: BusinessStructure; gst_period: string; payg_instalments: boolean; fbt_payer: boolean };
  sections: BasSectionResult[];
  not_applicable_note: string | null;
  disclaimer: string;
  notes: string[];
}

function fyToPit(fy: string): string {
  const start = parseInt(fy.slice(0, 4), 10);
  return `${start + 1}-06-30`;
}

const TIER_ORDER: Record<BasTier, number> = { core: 0, confirmed: 1, conditional: 2 };

export async function basPrepChecklist(
  deps: BasPrepChecklistDeps,
  args: BasPrepChecklistInput,
): Promise<BasPrepChecklistOutput> {
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

  const toResult = async (def: BasSectionDef): Promise<BasSectionResult> => ({
    id: def.id, label: def.label, tier: def.tier, applies_reason: def.appliesReason(facts),
    bas_labels: def.bas_labels, what_to_gather: def.what_to_gather, gotchas: def.gotchas, legal_basis: def.legal_basis,
    citations: await resolveCitations({ store, embedder: deps.embedder }, def.seed_queries, { k: 3, pit, pinnedDocIds: def.seed_doc_ids }),
  });

  // --- Not registered: IAS path or nothing-to-do ---
  if (!facts.gst_registered) {
    const sections: BasSectionResult[] = [];
    let note: string;
    if (facts.payg_instalments) {
      sections.push(await toResult(BAS_SECTIONS.find((s) => s.id === "payg_income_instalment")!));
      note = "You are not registered for GST, so you do not lodge a BAS. You lodge an Instalment Activity Statement (IAS) for your PAYG instalments.";
    } else {
      note = "You are not registered for GST and have no PAYG instalment obligation, so you do not lodge a BAS or IAS.";
    }
    sections.push(await toResult(BAS_SECTIONS.find((s) => s.id === "records_and_corrections")!));
    return {
      registered: false,
      reporting: { period_type: "none", period_label: `FY${fy}`, form: formFor("none"), due_date: null, simpler_bas: true },
      taxpayer_context: { business_structure: facts.business_structure, gst_period: facts.gst_period, payg_instalments: facts.payg_instalments, fbt_payer: facts.fbt_payer },
      sections, not_applicable_note: note, disclaimer: DISCLAIMER, notes: [],
    };
  }

  // --- Registered ---
  let periodType = args.period_type ?? mapGstPeriod(facts.gst_period);
  if (periodType === "none") periodType = "quarterly"; // registered must have a period; default safely

  const applicable = BAS_SECTIONS.filter((d) => d.applies(facts, args));
  applicable.sort((a, b) => {
    const cc = (a.cross_cutting ? 1 : 0) - (b.cross_cutting ? 1 : 0);
    if (cc !== 0) return cc;
    return TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
  });
  const sections = await Promise.all(applicable.map(toResult));

  const notes: string[] = [];
  if (!args.full_gst_method) notes.push("Most small businesses use Simpler BAS (report only G1, 1A and 1B). If you report the full GST method, labels G2, G3, G10 and G11 also apply — pass full_gst_method=true.");
  notes.push("Lodge a 'nil' activity statement even if you had no activity for the period.");
  if (periodType === "monthly") notes.push("Monthly BAS is due on the 21st day of the month after the period.");
  if (periodType === "quarterly") notes.push("Lodging through a registered BAS/tax agent or via Online services may extend the standard due date.");
  if (periodType === "annual") notes.push("The annual GST return is generally due when your income tax return is due.");

  return {
    registered: true,
    reporting: { period_type: periodType, period_label: periodLabel(periodType, args.quarter, fy), form: formFor(periodType), due_date: dueDateFor(periodType, args.quarter, fy), simpler_bas: !args.full_gst_method },
    taxpayer_context: { business_structure: facts.business_structure, gst_period: facts.gst_period, payg_instalments: facts.payg_instalments, fbt_payer: facts.fbt_payer },
    sections, not_applicable_note: null, disclaimer: DISCLAIMER, notes,
  };
}
