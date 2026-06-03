# audit_risk_check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `audit_risk_check` hero workflow tool — given the taxpayer's facts + a draft return summary, flag the patterns the ATO scrutinises (qualitative, cited red-flags) with a risk band, why-flagged, what-to-do, and ATO guidance citations. No numeric benchmarking.

**Architecture:** Pure `deriveMetrics()` over the draft figures (unit-tested). A small inline `RISK_RULES` catalogue, each rule a pure `detect(facts, input, metrics)` predicate. The tool runs all rules, resolves citations for fired ones via the shared `resolveCitations()` spine (tool 1), orders by risk band, and reports `overall_risk` + transparency (`checked`/`skipped`). Same shared code in local MCP + hosted backend.

**Tech Stack:** TypeScript 5.6.3, Zod 3.23.8, vitest 2.1.5, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-06-03-audit-risk-check-design.md`
**Branch:** already on `feat/v0.4-deduction-discovery` (do NOT create a branch). Reuses `packages/shared/src/lib/citations.ts`.

---

## File structure

| File | Responsibility |
|------|----------------|
| `packages/shared/src/tools.ts` (modify) | `AuditRiskCheckInputSchema` + extend `ToolName` |
| `packages/shared/src/tools/audit_risk_check.ts` (create) | `deriveMetrics` + `RISK_RULES` catalogue + types + `auditRiskCheck()` |
| `packages/shared/package.json` (modify) | `./tools/audit_risk_check` subpath export |
| `packages/shared/test/tools/audit_risk_check.test.ts` (create) | metrics + scenario unit tests |
| `packages/mcp/src/server.ts` (modify) | Register tool |
| `packages/mcp/test/server.test.ts` (modify) | Dispatch test |
| `packages/mcp/test/e2e/mcp-protocol.test.ts` (modify) | Tool-list → 13 tools |
| `packages/backend/api/audit_risk_check.ts` (create) | Vercel handler |
| `packages/backend/test/handlers.test.ts` (modify) | Handler tests |
| `CLAUDE.md`, `HANDOFF.md` (modify) | Mark tool 4 shipped; v0.4 complete |

---

### Task 1: Input schema

**Files:** Modify `packages/shared/src/tools.ts`; Test `packages/shared/test/tools.schema.test.ts` (append)

- [ ] **Step 1: Write the failing test** (append)

```ts
import { AuditRiskCheckInputSchema } from "../src/tools.js";

describe("AuditRiskCheckInputSchema", () => {
  it("accepts an empty object (all optional)", () => {
    expect(() => AuditRiskCheckInputSchema.parse({})).not.toThrow();
  });
  it("accepts income + deductions + rental", () => {
    const v = AuditRiskCheckInputSchema.parse({ income: 80000, deductions: [{ category: "work-related car", amount: 4000 }], rental: { interest: 8000 } });
    expect(v.deductions![0]!.amount).toBe(4000);
  });
  it("rejects a negative deduction amount", () => {
    expect(() => AuditRiskCheckInputSchema.parse({ deductions: [{ category: "x", amount: -1 }] })).toThrow();
  });
  it("rejects an empty deduction category", () => {
    expect(() => AuditRiskCheckInputSchema.parse({ deductions: [{ category: "", amount: 1 }] })).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm --filter @ato-mcp/shared exec vitest run test/tools.schema.test.ts` → FAIL (not exported).

- [ ] **Step 3: Add the schema** (after `BasPrepChecklistInput`, before `ToolName`)

```ts
export const AuditRiskCheckInputSchema = z.object({
  income: z.number().nonnegative().optional(),
  deductions: z.array(z.object({ category: z.string().min(1), amount: z.number().nonnegative() })).optional(),
  rental: z.object({
    income: z.number().nonnegative().optional(),
    interest: z.number().nonnegative().optional(),
    repairs: z.number().nonnegative().optional(),
    capital_works: z.number().nonnegative().optional(),
  }).optional(),
  business_income: z.number().optional(),
  fy: z.string().regex(/^\d{4}-\d{2}$/, "FY must be YYYY-YY").optional(),
});
export type AuditRiskCheckInput = z.infer<typeof AuditRiskCheckInputSchema>;
```

Extend `ToolName`:

```ts
export type ToolName = "search" | "get_chunks" | "fetch" | "stats" | "get_definition" | "get_doc" | "get_doc_anchors" | "get_threshold" | "deduction_discovery" | "depreciation_helper" | "bas_prep_checklist" | "audit_risk_check";
```

- [ ] **Step 4: Run to verify it passes** — PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/tools.ts packages/shared/test/tools.schema.test.ts
git commit -m "feat(shared): add AuditRiskCheckInputSchema

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Derived metrics helper

**Files:** Create `packages/shared/src/tools/audit_risk_check.ts` (metrics only); Test `packages/shared/test/tools/audit_risk_check.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/test/tools/audit_risk_check.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deriveMetrics } from "../../src/tools/audit_risk_check.js";

describe("deriveMetrics", () => {
  it("totals deductions and computes the deduction-to-income %", () => {
    const m = deriveMetrics({ income: 100000, deductions: [{ category: "work-related car", amount: 4000 }, { category: "donations", amount: 500 }] });
    expect(m.total_deductions).toBe(4500);
    expect(m.deduction_to_income_pct).toBeCloseTo(4.5, 5);
  });
  it("sums only WRE-matching categories into wre_total", () => {
    const m = deriveMetrics({ deductions: [{ category: "work-related travel", amount: 2000 }, { category: "rental interest", amount: 9000 }] });
    expect(m.wre_total).toBe(2000);
  });
  it("counts round-number claims (>= $300, multiple of $100)", () => {
    const m = deriveMetrics({ deductions: [{ category: "a", amount: 1000 }, { category: "b", amount: 500 }, { category: "c", amount: 250 }, { category: "d", amount: 320 }] });
    expect(m.round_number_claims).toBe(2); // 1000 and 500 (250 < 300; 320 not multiple of 100)
  });
  it("hasCategory / categoryAmount match on keywords", () => {
    const m = deriveMetrics({ deductions: [{ category: "Working from home", amount: 600 }, { category: "Mobile phone & internet", amount: 300 }] });
    expect(m.hasCategory(["working from home"])).toBe(true);
    expect(m.hasCategory(["phone", "internet"])).toBe(true);
    expect(m.categoryAmount(["phone"])).toBe(300);
  });
  it("nulls when no data", () => {
    const m = deriveMetrics({});
    expect(m.total_deductions).toBeNull();
    expect(m.deduction_to_income_pct).toBeNull();
    expect(m.wre_total).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — module not found.

- [ ] **Step 3: Implement `deriveMetrics`**

Create `packages/shared/src/tools/audit_risk_check.ts`:

```ts
// ---------------------------------------------------------------------------
// Derived metrics for audit_risk_check. Pure.
// ---------------------------------------------------------------------------
import type { AuditRiskCheckInput } from "../tools.js";

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
```

- [ ] **Step 4: Run to verify it passes** — `pnpm --filter @ato-mcp/shared exec vitest run test/tools/audit_risk_check.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/tools/audit_risk_check.ts packages/shared/test/tools/audit_risk_check.test.ts
git commit -m "feat(shared): audit_risk_check derived metrics

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Risk-rule catalogue, types + the `auditRiskCheck()` tool

**Files:** Modify `packages/shared/src/tools/audit_risk_check.ts`, `packages/shared/package.json`, `packages/shared/test/tools/audit_risk_check.test.ts`

- [ ] **Step 1: Write the failing scenario tests** (append to the test file)

```ts
import { auditRiskCheck } from "../../src/tools/audit_risk_check.js";
import type { AuditRiskCheckDeps } from "../../src/tools/audit_risk_check.js";
import type { Store } from "../../src/store/types.js";
import type { Embedder } from "../../src/embed/types.js";
import type { UserFacts } from "../../src/facts.js";

const baseFacts: UserFacts = {
  given_name: "Sam", state: "VIC", residency_status: "resident",
  has_abn: false, business_structure: "none", gst_registered: false, gst_period: "n/a",
  payg_instalments: false, fbt_payer: false, has_spouse: false, dependants: 0,
  hecs_help_debt: false, private_health_insurance: false, has_investment_property: false,
  has_shares_or_managed_funds: false, has_crypto: false, super_fund_type: "industry",
  current_fy: "2025-26", prior_fy_lodged: true,
  accepted_disclaimer_at: "2026-01-01T00:00:00Z", facts_updated_at: "2026-01-01T00:00:00Z", schema_version: 1,
};

function deps(facts: UserFacts): AuditRiskCheckDeps {
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
const fired = (o: Awaited<ReturnType<typeof auditRiskCheck>>) => new Set(o.findings.map((f) => f.id));

describe("auditRiskCheck", () => {
  it("throws when facts are missing", async () => {
    await expect(auditRiskCheck({ store: {} as Store, embedder: {} as Embedder, userFacts: null }, {}))
      .rejects.toThrow(/onboard/);
  });

  it("flags high WRE relative to income as high", async () => {
    const out = await auditRiskCheck(deps(baseFacts), { income: 60000, deductions: [{ category: "work-related expenses", amount: 12000 }] });
    expect(fired(out).has("wre_high_vs_income")).toBe(true);
    expect(out.findings.find((f) => f.id === "wre_high_vs_income")!.risk_band).toBe("high");
    expect(out.overall_risk).toBe("high");
    expect(out.findings.find((f) => f.id === "wre_high_vs_income")!.citations.length).toBeGreaterThan(0);
  });

  it("flags deductions exceeding income", async () => {
    const out = await auditRiskCheck(deps(baseFacts), { income: 5000, deductions: [{ category: "business", amount: 9000 }] });
    expect(fired(out).has("deductions_exceed_income")).toBe(true);
  });

  it("flags >= 3 round numbers as medium", async () => {
    const out = await auditRiskCheck(deps(baseFacts), { income: 200000, deductions: [{ category: "a", amount: 1000 }, { category: "b", amount: 500 }, { category: "c", amount: 300 }] });
    const f = out.findings.find((x) => x.id === "large_round_numbers")!;
    expect(f.risk_band).toBe("medium");
  });

  it("flags WFH + phone double-dip", async () => {
    const out = await auditRiskCheck(deps(baseFacts), { income: 90000, deductions: [{ category: "working from home", amount: 600 }, { category: "mobile phone and internet", amount: 400 }] });
    expect(fired(out).has("wfh_phone_double")).toBe(true);
  });

  it("flags rental deductions with no rental income as high", async () => {
    const facts = { ...baseFacts, has_investment_property: true };
    const out = await auditRiskCheck(deps(facts), { income: 90000, rental: { interest: 8000, repairs: 1000 } });
    const f = out.findings.find((x) => x.id === "rental_deductions_no_income")!;
    expect(f.risk_band).toBe("high");
  });

  it("flags unreported crypto", async () => {
    const facts = { ...baseFacts, has_crypto: true };
    const out = await auditRiskCheck(deps(facts), { income: 90000, deductions: [{ category: "work-related car", amount: 1000 }] });
    expect(fired(out).has("crypto_unreported")).toBe(true);
  });

  it("clean modest return: no findings, overall low", async () => {
    const out = await auditRiskCheck(deps(baseFacts), { income: 90000, deductions: [{ category: "tax agent fee", amount: 175 }] });
    expect(out.findings.length).toBe(0);
    expect(out.overall_risk).toBe("low");
  });

  it("skips ratio checks and reports them when income is absent", async () => {
    const out = await auditRiskCheck(deps(baseFacts), { deductions: [{ category: "work-related", amount: 5000 }] });
    expect(out.skipped.some((s) => s.id === "wre_high_vs_income")).toBe(true);
  });

  it("includes disclaimer + heuristic note", async () => {
    const out = await auditRiskCheck(deps(baseFacts), { income: 90000 });
    expect(out.disclaimer).toMatch(/not tax advice/i);
    expect(out.notes.join(" ")).toMatch(/heuristic|not an audit/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `auditRiskCheck` not exported.

- [ ] **Step 3: Implement the catalogue, types, and tool** (append to `packages/shared/src/tools/audit_risk_check.ts`)

```ts
import type { Store } from "../store/types.js";
import type { Embedder } from "../embed/types.js";
import type { UserFacts } from "../facts.js";
import { resolveCitations, type Citation } from "../lib/citations.js";

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
      return { why_flagged: `Your work-related expense claims (about $${Math.round(m.wre_total)}) are ~${pct.toFixed(0)}% of your income, above the ~12% level that typically draws attention.`, band: pct > 20 ? "high" : "medium" };
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
```

- [ ] **Step 4: Add the subpath export** — in `packages/shared/package.json` `exports`, after `./tools/bas_prep_checklist`:

```json
    "./tools/audit_risk_check": {
      "types": "./dist/tools/audit_risk_check.d.ts",
      "import": "./dist/tools/audit_risk_check.js"
    },
```

- [ ] **Step 5: Run tests + typecheck + build** — `pnpm --filter @ato-mcp/shared test && pnpm --filter @ato-mcp/shared typecheck && pnpm --filter @ato-mcp/shared build` → green; `dist/tools/audit_risk_check.js` emitted.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/tools/audit_risk_check.ts packages/shared/package.json packages/shared/test/tools/audit_risk_check.test.ts
git commit -m "feat(shared): implement audit_risk_check tool

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Register in the MCP server

**Files:** Modify `packages/mcp/src/server.ts`, `packages/mcp/test/server.test.ts`, `packages/mcp/test/e2e/mcp-protocol.test.ts`

- [ ] **Step 1: Write the failing test** (append to `packages/mcp/test/server.test.ts`)

```ts
describe("server: audit_risk_check", () => {
  it("lists the tool", () => {
    const srv = buildServerForTesting({ store, embedder, facts, mode: "local" });
    expect(srv.listToolNames()).toContain("audit_risk_check");
  });
  it("dispatches and returns findings + overall_risk", async () => {
    const srv = buildServerForTesting({ store, embedder, facts, mode: "local" });
    const res = await srv.callTool("audit_risk_check", { income: 90000, deductions: [{ category: "tax agent fee", amount: 175 }] });
    expect(res).toHaveProperty("findings");
    expect(res).toHaveProperty("overall_risk");
    expect(res).toHaveProperty("disclaimer");
  });
});
```

- [ ] **Step 2: Run to verify it fails** — unknown tool.

- [ ] **Step 3: Register** in `packages/mcp/src/server.ts`:

(a) Import (after `basPrepChecklist`):

```ts
import { auditRiskCheck } from "@ato-mcp/shared/tools/audit_risk_check";
```

(b) Add `AuditRiskCheckInputSchema` to the `@ato-mcp/shared` schema import block.

(c) `TOOLS` entry (after `bas_prep_checklist`):

```ts
  audit_risk_check: {
    description:
      "Flag patterns the ATO is known to scrutinise, given the user's facts + a draft return summary (income, deductions, rental). Returns qualitative red-flag findings with a risk band, why-flagged, what-to-do and ATO guidance citations. A heuristic indicator, NOT an audit prediction and NOT numeric benchmarking. Optional inputs: income, deductions [{category, amount}], rental {income, interest, repairs, capital_works}, business_income, fy.",
    inputSchema: {
      type: "object",
      properties: {
        income: { type: "number", minimum: 0 },
        deductions: { type: "array", items: { type: "object", properties: { category: { type: "string" }, amount: { type: "number", minimum: 0 } }, required: ["category", "amount"], additionalProperties: false } },
        rental: { type: "object", properties: { income: { type: "number", minimum: 0 }, interest: { type: "number", minimum: 0 }, repairs: { type: "number", minimum: 0 }, capital_works: { type: "number", minimum: 0 } }, additionalProperties: false },
        business_income: { type: "number" },
        fy: { type: "string" },
      },
      additionalProperties: false,
    },
  },
```

(d) `dispatch` case (after `bas_prep_checklist`):

```ts
    case "audit_risk_check":
      return auditRiskCheck(
        { store: deps.store, embedder: deps.embedder, userFacts: deps.facts ?? null },
        AuditRiskCheckInputSchema.parse(args),
      );
```

- [ ] **Step 4: Update the e2e tool-list assertion** in `packages/mcp/test/e2e/mcp-protocol.test.ts` — add `"audit_risk_check"` to the sorted expected array (now 13 names). Run the test to confirm exact ordering.

- [ ] **Step 5: Run tests + typecheck** — `pnpm --filter @ato-mcp/mcp test && pnpm --filter @ato-mcp/mcp typecheck` → green.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/src/server.ts packages/mcp/test/server.test.ts packages/mcp/test/e2e/mcp-protocol.test.ts
git commit -m "feat(mcp): register audit_risk_check tool

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Backend handler

**Files:** Create `packages/backend/api/audit_risk_check.ts`; Modify `packages/backend/test/handlers.test.ts`

- [ ] **Step 1: Write the failing test** (append before the final lines)

```ts
describe("POST /audit_risk_check", () => {
  it("returns a structured onboard error when the user has no facts (mock store)", async () => {
    const { handler } = await import("../api/audit_risk_check.js");
    const resp = await handler(makePostRequest({ income: 90000 }));
    expect(resp.status).toBe(400);
    const body = await resp.json() as { kind: string; message: string };
    expect(body.kind).toBe("error");
    expect(body.message).toMatch(/onboard/i);
  });
  it("returns 401 without auth", async () => {
    const { handler } = await import("../api/audit_risk_check.js");
    const req = new Request("https://api.ato-mcp.com.au/audit_risk_check", { method: "POST", body: "{}" });
    const resp = await handler(req);
    expect(resp.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm --filter @ato-mcp/shared build && pnpm --filter @ato-mcp/backend exec vitest run test/handlers.test.ts` → FAIL (module not found).

- [ ] **Step 3: Create the handler** `packages/backend/api/audit_risk_check.ts`:

```ts
import { adapt } from "./_adapter.js";
import { authMiddleware } from "./_middleware.js";
import { auditRiskCheck } from "@ato-mcp/shared/tools/audit_risk_check";
import { AuditRiskCheckInputSchema, UserFactsSchema } from "@ato-mcp/shared";
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
    const args = AuditRiskCheckInputSchema.parse((await req.json()) as unknown);

    const svc = makeServiceClient();
    const { data } = await svc.from("user_facts").select("facts").eq("user_id", auth.user_id).single();
    let userFacts: UserFacts | null = null;
    if (data) {
      const parsed = UserFactsSchema.safeParse((data as { facts: unknown }).facts);
      if (parsed.success) userFacts = parsed.data as UserFacts;
    }

    embedder ??= await WasmEmbedder.load();
    const result = await auditRiskCheck({ store, embedder, userFacts }, args);
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
git add packages/backend/api/audit_risk_check.ts packages/backend/test/handlers.test.ts
git commit -m "feat(backend): audit_risk_check Vercel handler

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Docs + full-suite verification (v0.4 complete)

**Files:** Modify `CLAUDE.md`, `HANDOFF.md`

- [ ] **Step 1: Run the full suite** — `pnpm -r build && pnpm -r typecheck && pnpm -r test` → all green (mcp e2e now lists 13 tools).

- [ ] **Step 2: Update CLAUDE.md** — in "Not yet implemented (v0.4 and beyond)", REMOVE the hero-tools bullet entirely (all four are now done) and leave the remaining v0.4-and-beyond items (edited PBR ingest, AAT/FCA, state revenue, WordNet, RLS CI test, better embedding model).

Add to "Done since v0.3 ship":

```
- **`audit_risk_check` (v0.4 tool 4 of 4) shipped — v0.4 hero tools COMPLETE.** Qualitative, cited red-flag detector (`packages/shared/src/tools/audit_risk_check.ts`): ~13 pure rules over facts + a draft return summary (high WRE-to-income, deductions>income, round numbers, WFH/phone double-dip, rental-no-income, unreported crypto, etc.), each with a risk band + ATO guidance citations, reusing the `resolveCitations()` spine. Heuristic indicator, not numeric benchmarking (per-ANZSIC/occupation benchmark numbers + a `benchmarks` table remain a v0.5 lift). Registered in `mcp/src/server.ts`; backend handler `backend/api/audit_risk_check.ts`. Spec: `docs/superpowers/specs/2026-06-03-audit-risk-check-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md HANDOFF.md
git commit -m "docs: mark audit_risk_check shipped — v0.4 hero tools complete

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Final verification** — `pnpm -r test` → green.

---

## Self-review notes

- **Spec coverage:** §2 input → Task 1; §3 metrics + catalogue → Tasks 2–3; §4 assembly + §5 output → Task 3; §6 reuse/no-advice/failures → Task 3; §8 testing → Tasks 2–5; registration → Task 4 (forwarder automatic).
- **Type consistency:** `DerivedMetrics` defined once (Task 2), consumed by the rules (Task 3); `RiskBand`/`AuditRiskFinding`/`AuditRiskCheckOutput`/`AuditRiskCheckDeps` defined once; `AuditRiskCheckInput` from `tools.ts`; `Citation` from the tool-1 spine.
- **No placeholders:** complete code in every step. `seed_doc_ids` are best-effort pins (citations resolve live via `seed_queries`); `legal_basis: null` is intentional for the lodgement rule.
- **No-advice:** the `DISCLAIMER` + `notes` explicitly frame risk bands as heuristic, non-predictive indicators; findings advise verification/records, never claim reduction.
