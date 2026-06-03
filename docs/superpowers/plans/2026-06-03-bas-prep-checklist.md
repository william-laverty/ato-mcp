# bas_prep_checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `bas_prep_checklist` hero workflow tool — for a GST-registered taxpayer, return a tiered, cited checklist of the BAS sections/labels that apply to their reporting period, with evidence to gather and common gotchas (no amounts).

**Architecture:** Pure period/due-date helpers (unit-tested). A small inline `BAS_SECTIONS` catalogue tiered core/confirmed/conditional, each with an `applies(facts,input)` predicate + citation seeds. The tool filters by facts, resolves citations via the shared `resolveCitations()` spine (tool 1), orders by tier with cross-cutting last, and handles the not-registered (IAS / nothing-to-do) path. Same shared code in local MCP + hosted backend.

**Tech Stack:** TypeScript 5.6.3, Zod 3.23.8, vitest 2.1.5, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-06-03-bas-prep-checklist-design.md`
**Branch:** already on `feat/v0.4-deduction-discovery` (do NOT create a branch). Reuses `packages/shared/src/lib/citations.ts`.

---

## File structure

| File | Responsibility |
|------|----------------|
| `packages/shared/src/tools.ts` (modify) | `BasPrepChecklistInputSchema` + extend `ToolName` |
| `packages/shared/src/tools/bas_prep_checklist.ts` (create) | period helpers + catalogue + types + `basPrepChecklist()` |
| `packages/shared/package.json` (modify) | `./tools/bas_prep_checklist` subpath export |
| `packages/shared/test/tools/bas_prep_checklist.test.ts` (create) | helper + scenario unit tests |
| `packages/mcp/src/server.ts` (modify) | Register tool |
| `packages/mcp/test/server.test.ts` (modify) | Dispatch test |
| `packages/mcp/test/e2e/mcp-protocol.test.ts` (modify) | Tool-list → 12 tools |
| `packages/backend/api/bas_prep_checklist.ts` (create) | Vercel handler |
| `packages/backend/test/handlers.test.ts` (modify) | Handler tests |
| `CLAUDE.md`, `HANDOFF.md` (modify) | Mark tool 3 shipped |

---

### Task 1: Input schema

**Files:** Modify `packages/shared/src/tools.ts`; Test `packages/shared/test/tools.schema.test.ts` (append)

- [ ] **Step 1: Write the failing test** (append)

```ts
import { BasPrepChecklistInputSchema } from "../src/tools.js";

describe("BasPrepChecklistInputSchema", () => {
  it("applies defaults", () => {
    const v = BasPrepChecklistInputSchema.parse({});
    expect(v.full_gst_method).toBe(false);
    expect(v.period_type).toBeUndefined();
  });
  it("accepts period_type + quarter", () => {
    const v = BasPrepChecklistInputSchema.parse({ period_type: "quarterly", quarter: 2 });
    expect(v.quarter).toBe(2);
  });
  it("rejects quarter out of range", () => {
    expect(() => BasPrepChecklistInputSchema.parse({ quarter: 5 })).toThrow();
  });
  it("rejects bad period_type", () => {
    expect(() => BasPrepChecklistInputSchema.parse({ period_type: "weekly" })).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @ato-mcp/shared exec vitest run test/tools.schema.test.ts`
Expected: FAIL — not exported.

- [ ] **Step 3: Add the schema** (after `DepreciationHelperInput`, before `ToolName`)

```ts
export const BasPrepChecklistInputSchema = z.object({
  period_type: z.enum(["monthly", "quarterly", "annual"]).optional(),
  quarter: z.number().int().min(1).max(4).optional(),
  fy: z.string().regex(/^\d{4}-\d{2}$/, "FY must be YYYY-YY").optional(),
  full_gst_method: z.boolean().default(false),
});
export type BasPrepChecklistInput = z.infer<typeof BasPrepChecklistInputSchema>;
```

Extend `ToolName`:

```ts
export type ToolName = "search" | "get_chunks" | "fetch" | "stats" | "get_definition" | "get_doc" | "get_doc_anchors" | "get_threshold" | "deduction_discovery" | "depreciation_helper" | "bas_prep_checklist";
```

- [ ] **Step 4: Run to verify it passes** — `pnpm --filter @ato-mcp/shared exec vitest run test/tools.schema.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/tools.ts packages/shared/test/tools.schema.test.ts
git commit -m "feat(shared): add BasPrepChecklistInputSchema

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Period + due-date helpers

**Files:** Create `packages/shared/src/tools/bas_prep_checklist.ts` (helpers only); Test `packages/shared/test/tools/bas_prep_checklist.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/test/tools/bas_prep_checklist.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapGstPeriod, quarterlyDueDate, dueDateFor, formFor, periodLabel } from "../../src/tools/bas_prep_checklist.js";

describe("period helpers", () => {
  it("mapGstPeriod", () => {
    expect(mapGstPeriod("quarterly")).toBe("quarterly");
    expect(mapGstPeriod("monthly")).toBe("monthly");
    expect(mapGstPeriod("annual")).toBe("annual");
    expect(mapGstPeriod("n/a")).toBe("none");
  });
  it("quarterlyDueDate maps each quarter for FY2025-26", () => {
    expect(quarterlyDueDate(1, "2025-26")).toBe("2025-10-28");
    expect(quarterlyDueDate(2, "2025-26")).toBe("2026-02-28");
    expect(quarterlyDueDate(3, "2025-26")).toBe("2026-04-28");
    expect(quarterlyDueDate(4, "2025-26")).toBe("2026-07-28");
  });
  it("dueDateFor returns the quarterly date only when quarterly + quarter given", () => {
    expect(dueDateFor("quarterly", 2, "2025-26")).toBe("2026-02-28");
    expect(dueDateFor("quarterly", undefined, "2025-26")).toBeNull();
    expect(dueDateFor("monthly", undefined, "2025-26")).toBeNull();
    expect(dueDateFor("annual", undefined, "2025-26")).toBeNull();
  });
  it("formFor", () => {
    expect(formFor("monthly")).toMatch(/monthly/i);
    expect(formFor("quarterly")).toMatch(/quarterly/i);
    expect(formFor("annual")).toMatch(/annual/i);
    expect(formFor("none")).toMatch(/IAS|instalment/i);
  });
  it("periodLabel", () => {
    expect(periodLabel("quarterly", 2, "2025-26")).toMatch(/Q2/);
    expect(periodLabel("monthly", undefined, "2025-26")).toMatch(/monthly/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — module not found.

- [ ] **Step 3: Implement the helpers**

Create `packages/shared/src/tools/bas_prep_checklist.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify it passes** — `pnpm --filter @ato-mcp/shared exec vitest run test/tools/bas_prep_checklist.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/tools/bas_prep_checklist.ts packages/shared/test/tools/bas_prep_checklist.test.ts
git commit -m "feat(shared): bas_prep_checklist period + due-date helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Catalogue, types + the `basPrepChecklist()` tool

**Files:** Modify `packages/shared/src/tools/bas_prep_checklist.ts`, `packages/shared/package.json`, `packages/shared/test/tools/bas_prep_checklist.test.ts`

- [ ] **Step 1: Write the failing scenario tests** (append to the test file)

```ts
import { basPrepChecklist } from "../../src/tools/bas_prep_checklist.js";
import type { BasPrepChecklistDeps } from "../../src/tools/bas_prep_checklist.js";
import type { Store } from "../../src/store/types.js";
import type { Embedder } from "../../src/embed/types.js";
import type { UserFacts } from "../../src/facts.js";

const baseFacts: UserFacts = {
  given_name: "Sam", state: "VIC", residency_status: "resident",
  has_abn: true, abn: "51824753556", business_structure: "sole_trader",
  gst_registered: true, gst_period: "quarterly", payg_instalments: false, fbt_payer: false,
  has_spouse: false, dependants: 0, hecs_help_debt: false, private_health_insurance: false,
  has_investment_property: false, has_shares_or_managed_funds: false, has_crypto: false,
  super_fund_type: "industry", current_fy: "2025-26", prior_fy_lodged: true,
  accepted_disclaimer_at: "2026-01-01T00:00:00Z", facts_updated_at: "2026-01-01T00:00:00Z", schema_version: 1,
};

function deps(facts: UserFacts): BasPrepChecklistDeps {
  const store: Store = {
    stats: async () => ({ installed: true, schema_version: "x", docs: 1, chunks: 1, staleness_days: 0 }),
    keywordSearch: async () => [{ chunk_id: "c", doc_id: "d", ord: 0, text: "t", heading_path: [], score: 1, title: "T", url: "u", doc_type: "ATO_GUIDE", snippet: "s" }],
    vectorSearch: async () => [],
    getChunks: async () => [], getDoc: async () => null,
    getDocAnchors: async () => ({ anchors: [], inbound: [], outbound: [] }),
    getDefinition: async () => [], getThreshold: async () => null, close: () => {},
  };
  return { store, embedder: { embed: async () => new Float32Array(384), name: "mock" } as Embedder, userFacts: facts };
}
const ids = (o: Awaited<ReturnType<typeof basPrepChecklist>>) => new Set(o.sections.map((s) => s.id));
const tierOf = (o: Awaited<ReturnType<typeof basPrepChecklist>>, id: string) => o.sections.find((s) => s.id === id)?.tier;

describe("basPrepChecklist", () => {
  it("throws when facts are missing", async () => {
    await expect(basPrepChecklist({ store: {} as Store, embedder: {} as Embedder, userFacts: null }, { full_gst_method: false }))
      .rejects.toThrow(/onboard/);
  });

  it("registered quarterly: core GST sections + conditional sections, due date for Q2", async () => {
    const out = await basPrepChecklist(deps(baseFacts), { period_type: "quarterly", quarter: 2, full_gst_method: false });
    expect(out.registered).toBe(true);
    expect(out.reporting.form).toMatch(/quarterly/i);
    expect(out.reporting.due_date).toBe("2026-02-28");
    expect(ids(out).has("gst_total_sales")).toBe(true);
    expect(ids(out).has("gst_on_sales")).toBe(true);
    expect(ids(out).has("gst_on_purchases")).toBe(true);
    expect(tierOf(out, "gst_on_sales")).toBe("core");
    // conditional sections always surface (recall-first)
    expect(tierOf(out, "payg_withholding")).toBe("conditional");
    expect(tierOf(out, "fuel_tax_credits")).toBe("conditional");
    expect(out.sections.find((s) => s.id === "gst_on_sales")!.citations.length).toBeGreaterThan(0);
  });

  it("simpler BAS by default: no full-method G2/G3/G10/G11 labels", async () => {
    const out = await basPrepChecklist(deps(baseFacts), { full_gst_method: false });
    expect(ids(out).has("gst_full_method_labels")).toBe(false);
    expect(out.reporting.simpler_bas).toBe(true);
  });

  it("full_gst_method true: surfaces the extra labels", async () => {
    const out = await basPrepChecklist(deps(baseFacts), { full_gst_method: true });
    expect(ids(out).has("gst_full_method_labels")).toBe(true);
    expect(out.reporting.simpler_bas).toBe(false);
  });

  it("payg_instalments + fbt_payer surface as confirmed", async () => {
    const out = await basPrepChecklist(deps({ ...baseFacts, payg_instalments: true, fbt_payer: true }), { full_gst_method: false });
    expect(tierOf(out, "payg_income_instalment")).toBe("confirmed");
    expect(tierOf(out, "fbt_instalment")).toBe("confirmed");
  });

  it("not registered + payg_instalments: IAS path, no GST core", async () => {
    const out = await basPrepChecklist(deps({ ...baseFacts, gst_registered: false, gst_period: "n/a", payg_instalments: true }), { full_gst_method: false });
    expect(out.registered).toBe(false);
    expect(out.not_applicable_note).toMatch(/IAS|instalment activity statement/i);
    expect(ids(out).has("payg_income_instalment")).toBe(true);
    expect(ids(out).has("gst_on_sales")).toBe(false);
  });

  it("not registered + no PAYG-I: clear no-BAS note", async () => {
    const out = await basPrepChecklist(deps({ ...baseFacts, gst_registered: false, gst_period: "n/a", payg_instalments: false }), { full_gst_method: false });
    expect(out.registered).toBe(false);
    expect(out.not_applicable_note).toMatch(/do not lodge a BAS or IAS/i);
    expect(ids(out).has("gst_on_sales")).toBe(false);
  });

  it("orders core before confirmed before conditional, cross-cutting last", async () => {
    const out = await basPrepChecklist(deps({ ...baseFacts, payg_instalments: true }), { full_gst_method: false });
    const tiers = out.sections.map((s) => s.tier);
    const firstConditional = tiers.indexOf("conditional");
    const lastCore = tiers.lastIndexOf("core");
    // a cross-cutting core section (lodge_and_pay) is sorted last, so don't assert global tier monotonicity;
    // assert the confirmed PAYG instalment comes before the first conditional section.
    expect(out.sections.findIndex((s) => s.id === "payg_income_instalment")).toBeLessThan(firstConditional);
    expect(ids(out).has("lodge_and_pay")).toBe(true);
    expect(out.sections[out.sections.length - 1]!.id).toMatch(/lodge_and_pay|records_and_corrections/);
  });

  it("includes disclaimer", async () => {
    const out = await basPrepChecklist(deps(baseFacts), { full_gst_method: false });
    expect(out.disclaimer).toMatch(/not tax advice/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `basPrepChecklist` not exported.

- [ ] **Step 3: Implement the catalogue, types, and tool** (append to `packages/shared/src/tools/bas_prep_checklist.ts`)

```ts
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
```

- [ ] **Step 4: Add the subpath export** — in `packages/shared/package.json` `exports`, after `./tools/depreciation_helper`:

```json
    "./tools/bas_prep_checklist": {
      "types": "./dist/tools/bas_prep_checklist.d.ts",
      "import": "./dist/tools/bas_prep_checklist.js"
    },
```

- [ ] **Step 5: Run tests + typecheck + build** — `pnpm --filter @ato-mcp/shared test && pnpm --filter @ato-mcp/shared typecheck && pnpm --filter @ato-mcp/shared build` → all green; `dist/tools/bas_prep_checklist.js` emitted.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/tools/bas_prep_checklist.ts packages/shared/package.json packages/shared/test/tools/bas_prep_checklist.test.ts
git commit -m "feat(shared): implement bas_prep_checklist tool

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Register in the MCP server

**Files:** Modify `packages/mcp/src/server.ts`, `packages/mcp/test/server.test.ts`, `packages/mcp/test/e2e/mcp-protocol.test.ts`

- [ ] **Step 1: Write the failing test** (append to `packages/mcp/test/server.test.ts`)

```ts
describe("server: bas_prep_checklist", () => {
  it("lists the tool", () => {
    const srv = buildServerForTesting({ store, embedder, facts, mode: "local" });
    expect(srv.listToolNames()).toContain("bas_prep_checklist");
  });
  it("dispatches and returns a checklist", async () => {
    const gstFacts = { ...facts, has_abn: true, abn: "51824753556", business_structure: "sole_trader" as const, gst_registered: true, gst_period: "quarterly" as const };
    const srv = buildServerForTesting({ store, embedder, facts: gstFacts, mode: "local" });
    const res = await srv.callTool("bas_prep_checklist", { period_type: "quarterly", quarter: 1 });
    expect(res).toHaveProperty("sections");
    expect(res).toHaveProperty("disclaimer");
    expect(res.registered).toBe(true);
  });
});
```

(The top-of-file `facts` has `business_structure:"none"`/`gst_registered:false`; the test builds a GST-registered variant inline.)

- [ ] **Step 2: Run to verify it fails** — unknown tool.

- [ ] **Step 3: Register** in `packages/mcp/src/server.ts`:

(a) Import (after `depreciationHelper`):

```ts
import { basPrepChecklist } from "@ato-mcp/shared/tools/bas_prep_checklist";
```

(b) Add `BasPrepChecklistInputSchema` to the `@ato-mcp/shared` schema import block.

(c) `TOOLS` entry (after `depreciation_helper`):

```ts
  bas_prep_checklist: {
    description:
      "Produce a tiered, cited BAS preparation checklist for the user's GST reporting period: which labels apply (GST G1/1A/1B, PAYG-W, PAYG-I, FBT instalment, fuel tax credits, WET, LCT), what evidence to gather, and common gotchas. Does not calculate amounts. Optional inputs: period_type (monthly/quarterly/annual), quarter (1-4), fy, full_gst_method.",
    inputSchema: {
      type: "object",
      properties: {
        period_type: { type: "string", enum: ["monthly", "quarterly", "annual"] },
        quarter: { type: "integer", minimum: 1, maximum: 4 },
        fy: { type: "string" },
        full_gst_method: { type: "boolean", default: false },
      },
      additionalProperties: false,
    },
  },
```

(d) `dispatch` case (after `depreciation_helper`):

```ts
    case "bas_prep_checklist":
      return basPrepChecklist(
        { store: deps.store, embedder: deps.embedder, userFacts: deps.facts ?? null },
        BasPrepChecklistInputSchema.parse(args),
      );
```

- [ ] **Step 4: Update the e2e tool-list assertion** in `packages/mcp/test/e2e/mcp-protocol.test.ts` — add `"bas_prep_checklist"` to the sorted expected array (now 12 names). Run the test to confirm exact ordering.

- [ ] **Step 5: Run tests + typecheck** — `pnpm --filter @ato-mcp/mcp test && pnpm --filter @ato-mcp/mcp typecheck` → green.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/src/server.ts packages/mcp/test/server.test.ts packages/mcp/test/e2e/mcp-protocol.test.ts
git commit -m "feat(mcp): register bas_prep_checklist tool

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Backend handler

**Files:** Create `packages/backend/api/bas_prep_checklist.ts`; Modify `packages/backend/test/handlers.test.ts`

- [ ] **Step 1: Write the failing test** (append before the final lines)

```ts
describe("POST /bas_prep_checklist", () => {
  it("returns a structured onboard error when the user has no facts (mock store)", async () => {
    const { handler } = await import("../api/bas_prep_checklist.js");
    const resp = await handler(makePostRequest({}));
    expect(resp.status).toBe(400);
    const body = await resp.json() as { kind: string; message: string };
    expect(body.kind).toBe("error");
    expect(body.message).toMatch(/onboard/i);
  });
  it("returns 401 without auth", async () => {
    const { handler } = await import("../api/bas_prep_checklist.js");
    const req = new Request("https://api.ato-mcp.com.au/bas_prep_checklist", { method: "POST", body: "{}" });
    const resp = await handler(req);
    expect(resp.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm --filter @ato-mcp/shared build && pnpm --filter @ato-mcp/backend exec vitest run test/handlers.test.ts` → FAIL (module not found).

- [ ] **Step 3: Create the handler** `packages/backend/api/bas_prep_checklist.ts`:

```ts
import { adapt } from "./_adapter.js";
import { authMiddleware } from "./_middleware.js";
import { basPrepChecklist } from "@ato-mcp/shared/tools/bas_prep_checklist";
import { BasPrepChecklistInputSchema, UserFactsSchema } from "@ato-mcp/shared";
import type { UserFacts } from "@ato-mcp/shared";
import { SupabaseStore } from "../src/supabase-store.js";
import { WasmEmbedder } from "../src/wasm-embedder.js";
import { makeServiceClient } from "../src/supabase.js";

const store = new SupabaseStore();
let embedder: WasmEmbedder | null = null;

export async function handler(req: Request): Promise<Response> {
  const auth = await authMiddleware(req);
  if (auth instanceof Response) return auth;
  try {
    const args = BasPrepChecklistInputSchema.parse((await req.json()) as unknown);

    const svc = makeServiceClient();
    const { data } = await svc.from("user_facts").select("facts").eq("user_id", auth.user_id).single();
    let userFacts: UserFacts | null = null;
    if (data) {
      const parsed = UserFactsSchema.safeParse((data as { facts: unknown }).facts);
      if (parsed.success) userFacts = parsed.data as UserFacts;
    }

    embedder ??= await WasmEmbedder.load();
    const result = await basPrepChecklist({ store, embedder, userFacts }, args);
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ kind: "error", message: msg }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }
}

export default adapt(handler);
```

- [ ] **Step 4: Run to verify it passes** — `pnpm --filter @ato-mcp/backend exec vitest run test/handlers.test.ts` → PASS.

- [ ] **Step 5: Typecheck + build** — `pnpm --filter @ato-mcp/backend typecheck && pnpm --filter @ato-mcp/backend build` → clean.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/api/bas_prep_checklist.ts packages/backend/test/handlers.test.ts
git commit -m "feat(backend): bas_prep_checklist Vercel handler

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Docs + full-suite verification

**Files:** Modify `CLAUDE.md`, `HANDOFF.md`

- [ ] **Step 1: Run the full suite** — `pnpm -r build && pnpm -r typecheck && pnpm -r test` → all green (mcp e2e now lists 12 tools).

- [ ] **Step 2: Update CLAUDE.md** — change the "Not yet implemented" hero-tools bullet to:

```
- Hero workflow tools: `audit_risk_check` (the product differentiator from `gunba/ato-mcp`). `deduction_discovery`, `depreciation_helper` and `bas_prep_checklist` are DONE (v0.4 tools 1–3 of 4).
```

Add to "Done since v0.3 ship":

```
- **`bas_prep_checklist` (v0.4 tool 3 of 4) shipped.** Tiered (core/confirmed/conditional), cited BAS checklist (`packages/shared/src/tools/bas_prep_checklist.ts`) filtered by gst_registered/gst_period/payg_instalments/fbt_payer, reusing the `resolveCitations()` spine. Simpler-BAS default with full-method labels behind `full_gst_method`; not-registered users get an IAS/no-BAS cited note. Registered in `mcp/src/server.ts`; backend handler `backend/api/bas_prep_checklist.ts`. Spec: `docs/superpowers/specs/2026-06-03-bas-prep-checklist-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md HANDOFF.md
git commit -m "docs: mark bas_prep_checklist shipped (v0.4 tool 3 of 4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Final verification** — `pnpm -r test` → green.

---

## Self-review notes

- **Spec coverage:** §2 input → Task 1; §5 period/due-date → Task 2; §3 catalogue + §4 tiering + §6 not-registered + §7 output → Task 3; §8 reuse/no-advice/failures → Task 3; §10 testing → Tasks 2–5; registration → Task 4 (forwarder automatic).
- **Type consistency:** `PeriodType` defined once (Task 2), reused in the tool (Task 3); `BasSectionResult`/`BasPrepChecklistOutput`/`BasPrepChecklistDeps` defined once; `BasPrepChecklistInput` from `tools.ts`; `Citation` from the tool-1 spine.
- **No placeholders:** complete code in every step. `seed_doc_ids` are best-effort pins (citations resolve live via `seed_queries`); empty arrays are intentional where no single page was confirmed.
- **Recall-first tiering** is implemented via the catalogue `tier` + `applies` predicates (conditional sections gated on `gst_registered` so they always surface for a registered taxpayer, clearly labelled).
