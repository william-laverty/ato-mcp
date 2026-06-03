# deduction_discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `deduction_discovery` hero workflow tool — given a taxpayer's facts + an optional activity string, surface every plausibly-applicable deduction-related category with corpus citations, thresholds, and a confidence rating, branching correctly across all taxpayer structures.

**Architecture:** A curated, corpus-grounded taxonomy (59 verified rows) is filtered by the user's facts, deduped by economic claim, then each surviving category resolves fresh citations via a new shared `resolveCitations()` spine and attaches live thresholds. Pure functions (predicate eval, dedupe, confidence, activity match) are unit-tested in isolation; the tool composes them. Same shared code runs in local MCP and the hosted backend.

**Tech Stack:** TypeScript 5.6.3, Zod 3.23.8, vitest 2.1.5, pnpm workspaces. Tool lives in `packages/shared`, registered in `packages/mcp` and exposed via `packages/backend`.

**Spec:** `docs/superpowers/specs/2026-06-03-deduction-discovery-design.md`
**Data source:** `docs/superpowers/specs/2026-06-03-deduction-discovery-taxonomy.json` (59 rows), `…-analysis.json` (test scenarios)

---

## File structure

| File | Responsibility |
|------|----------------|
| `packages/shared/src/tools.ts` (modify) | Add `DeductionDiscoveryInputSchema` + extend `ToolName` |
| `packages/shared/src/lib/citations.ts` (create) | Shared `resolveCitations()` spine (reused by all v0.4 tools) |
| `packages/shared/src/tools/deduction_discovery.ts` (create) | Category types + pure helpers (`evalPredicate`, `categoryApplies`, `dedupe`, `rateConfidence`, `matchActivity`) + the `deductionDiscovery()` tool |
| `packages/shared/scripts/gen-deduction-categories.mjs` (create) | Generator: taxonomy JSON + overrides → committed TS data file |
| `packages/shared/src/data/deduction-categories.ts` (generated, committed) | `DEDUCTION_CATEGORIES: DeductionCategory[]` |
| `packages/shared/package.json` (modify) | Add subpath exports + `gen:deductions` script |
| `packages/shared/test/lib/citations.test.ts` (create) | resolveCitations unit tests |
| `packages/shared/test/tools/deduction_discovery.test.ts` (create) | helper + scenario unit tests |
| `packages/shared/test/data/deduction-categories.test.ts` (create) | data-integrity tests |
| `packages/mcp/src/server.ts` (modify) | Register tool (TOOLS entry, dispatch case, pass userFacts) |
| `packages/backend/api/deduction_discovery.ts` (create) | Vercel handler |
| `packages/backend/test/handlers.test.ts` (modify) | Handler integration test |
| `CLAUDE.md` (modify) | Move `deduction_discovery` out of "Not yet implemented" |

---

### Task 1: Feature branch + input schema

**Files:**
- Modify: `packages/shared/src/tools.ts`
- Test: `packages/shared/test/tools.schema.test.ts` (create)

- [ ] **Step 1: Create the feature branch**

```bash
cd /Users/williamlaverty/Projects/Websites/ato-mcp
git checkout -b feat/v0.4-deduction-discovery
```

- [ ] **Step 2: Write the failing test**

Create `packages/shared/test/tools.schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DeductionDiscoveryInputSchema } from "../src/tools.js";

describe("DeductionDiscoveryInputSchema", () => {
  it("applies defaults", () => {
    const v = DeductionDiscoveryInputSchema.parse({});
    expect(v.k_citations).toBe(3);
    expect(v.include_low_confidence).toBe(true);
    expect(v.activity).toBeUndefined();
  });

  it("accepts an activity + fy override", () => {
    const v = DeductionDiscoveryInputSchema.parse({ activity: "bought a laptop", fy: "2025-26" });
    expect(v.activity).toBe("bought a laptop");
    expect(v.fy).toBe("2025-26");
  });

  it("rejects a malformed fy", () => {
    expect(() => DeductionDiscoveryInputSchema.parse({ fy: "2025" })).toThrow();
  });

  it("clamps k_citations to <= 5", () => {
    expect(() => DeductionDiscoveryInputSchema.parse({ k_citations: 9 })).toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @ato-mcp/shared exec vitest run test/tools.schema.test.ts`
Expected: FAIL — `DeductionDiscoveryInputSchema` is not exported.

- [ ] **Step 4: Add the schema**

In `packages/shared/src/tools.ts`, append before the `ToolName` type:

```ts
export const DeductionDiscoveryInputSchema = z.object({
  activity: z.string().optional(),
  fy: z.string().regex(/^\d{4}-\d{2}$/, "FY must be YYYY-YY").optional(),
  k_citations: z.number().int().min(1).max(5).default(3),
  include_low_confidence: z.boolean().default(true),
});
export type DeductionDiscoveryInput = z.infer<typeof DeductionDiscoveryInputSchema>;
```

Then change the `ToolName` union (last line) to include the new tool:

```ts
export type ToolName = "search" | "get_chunks" | "fetch" | "stats" | "get_definition" | "get_doc" | "get_doc_anchors" | "get_threshold" | "deduction_discovery";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ato-mcp/shared exec vitest run test/tools.schema.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/tools.ts packages/shared/test/tools.schema.test.ts
git commit -m "feat(shared): add DeductionDiscoveryInputSchema"
```

---

### Task 2: `resolveCitations()` shared spine

**Files:**
- Create: `packages/shared/src/lib/citations.ts`
- Modify: `packages/shared/package.json` (add subpath export)
- Test: `packages/shared/test/lib/citations.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/test/lib/citations.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveCitations } from "../../src/lib/citations.js";
import type { Store } from "../../src/store/types.js";
import type { Embedder } from "../../src/embed/types.js";
import type { SearchHit } from "../../src/corpus.js";

function hit(chunk_id: string, doc_id: string): SearchHit {
  return { chunk_id, doc_id, ord: 0, text: "t", heading_path: [], score: 0, title: `T-${doc_id}`, url: "u", doc_type: "ATO_GUIDE", snippet: `snip-${doc_id}` };
}

function mockStore(kw: SearchHit[], vec: SearchHit[]): Store {
  return {
    stats: async () => ({ installed: true, schema_version: "x", docs: 1, chunks: 1, staleness_days: 0 }),
    keywordSearch: async () => kw,
    vectorSearch: async () => vec,
    getChunks: async () => [],
    getDoc: async () => null,
    getDocAnchors: async () => ({ anchors: [], inbound: [], outbound: [] }),
    getDefinition: async () => [],
    getThreshold: async () => null,
    close: () => {},
  };
}

const mockEmbedder: Embedder = { embed: async () => new Float32Array(384) };

describe("resolveCitations", () => {
  it("returns up to k de-duped citations (one per doc)", async () => {
    const store = mockStore(
      [hit("c1", "d1"), hit("c2", "d2"), hit("c3", "d2")],
      [hit("c4", "d3")],
    );
    const out = await resolveCitations({ store, embedder: mockEmbedder }, ["q"], { k: 3 });
    const docs = out.map((c) => c.doc_id);
    expect(new Set(docs).size).toBe(docs.length); // unique docs
    expect(out.length).toBeLessThanOrEqual(3);
    expect(out[0]).toHaveProperty("chunk_id");
    expect(out[0]).toHaveProperty("snippet");
  });

  it("boosts pinned doc_ids to the front", async () => {
    const store = mockStore([hit("c1", "d1"), hit("c2", "dPIN")], []);
    const out = await resolveCitations({ store, embedder: mockEmbedder }, ["q"], { k: 2, pinnedDocIds: ["dPIN"] });
    expect(out[0]!.doc_id).toBe("dPIN");
  });

  it("returns [] for empty seed queries", async () => {
    const store = mockStore([hit("c1", "d1")], []);
    const out = await resolveCitations({ store, embedder: mockEmbedder }, ["", "  "], { k: 3 });
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ato-mcp/shared exec vitest run test/lib/citations.test.ts`
Expected: FAIL — cannot find `../../src/lib/citations.js`.

- [ ] **Step 3: Implement `resolveCitations`**

Create `packages/shared/src/lib/citations.ts`:

```ts
import type { Store } from "../store/types.js";
import type { Embedder } from "../embed/types.js";
import type { SearchHit } from "../corpus.js";
import { rrfFuse } from "./rrf.js";

export interface Citation {
  chunk_id: string;
  doc_id: string;
  title: string;
  snippet: string;
  score: number;
}

export interface ResolveCitationsOpts {
  k: number;
  pit?: string;
  pinnedDocIds?: string[];
}

/**
 * Shared citation-resolution spine for the v0.4 workflow tools.
 * Runs the same hybrid keyword+vector+RRF flow as `search.ts`, de-dupes by
 * doc_id (keeping the best-ranked chunk per doc), and boosts any pinned
 * doc_ids that surface to the front. Returns at most `k` citations.
 */
export async function resolveCitations(
  deps: { store: Store; embedder: Embedder },
  seedQueries: string[],
  opts: ResolveCitationsOpts,
): Promise<Citation[]> {
  const query = seedQueries.map((q) => q.trim()).filter(Boolean).join("; ");
  if (!query) return [];

  const overFetch = Math.min(Math.max(opts.k * 3, 15), 40);
  const [kw, vec] = await Promise.all([
    deps.store.keywordSearch(query, overFetch, opts.pit),
    deps.embedder.embed(query).then((v) => deps.store.vectorSearch(v, overFetch, opts.pit)),
  ]);

  const fused = rrfFuse<SearchHit>([kw, vec], (h) => h.chunk_id, 60);
  const pinned = new Set(opts.pinnedDocIds ?? []);
  const ordered = [
    ...fused.filter((h) => pinned.has(h.doc_id)),
    ...fused.filter((h) => !pinned.has(h.doc_id)),
  ];

  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const h of ordered) {
    if (seen.has(h.doc_id)) continue;
    seen.add(h.doc_id);
    out.push({ chunk_id: h.chunk_id, doc_id: h.doc_id, title: h.title, snippet: h.snippet, score: h.score });
    if (out.length >= opts.k) break;
  }
  return out;
}
```

- [ ] **Step 4: Add the subpath export**

In `packages/shared/package.json`, add to the `exports` object (after `./lib/rrf`):

```json
    "./lib/citations": {
      "types": "./dist/lib/citations.d.ts",
      "import": "./dist/lib/citations.js"
    },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ato-mcp/shared exec vitest run test/lib/citations.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/lib/citations.ts packages/shared/package.json packages/shared/test/lib/citations.test.ts
git commit -m "feat(shared): add resolveCitations spine for v0.4 tools"
```

---

### Task 3: Category types + pure filtering helpers

**Files:**
- Create: `packages/shared/src/tools/deduction_discovery.ts` (types + helpers only this task)
- Test: `packages/shared/test/tools/deduction_discovery.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/test/tools/deduction_discovery.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { evalPredicate, categoryApplies, dedupe } from "../../src/tools/deduction_discovery.js";
import type { DeductionCategory } from "../../src/tools/deduction_discovery.js";
import type { UserFacts } from "../../src/facts.js";

const baseFacts: UserFacts = {
  given_name: "Alice", state: "NSW", residency_status: "resident",
  has_abn: false, business_structure: "none",
  gst_registered: false, gst_period: "n/a", payg_instalments: false, fbt_payer: false,
  has_spouse: false, dependants: 0, hecs_help_debt: false, private_health_insurance: false,
  has_investment_property: false, has_shares_or_managed_funds: false, has_crypto: false,
  super_fund_type: "industry", current_fy: "2025-26", prior_fy_lodged: true,
  accepted_disclaimer_at: "2026-01-01T00:00:00Z", facts_updated_at: "2026-01-01T00:00:00Z", schema_version: 1,
};

function cat(over: Partial<DeductionCategory>): DeductionCategory {
  return {
    id: "x", label: "X", kind: "deduction", structures: ["none"], return_context: "personal",
    triggers: [], seed_queries: ["q"], seed_doc_ids: [], thresholds: [],
    examples: [], substantiation: "", consider_prompt: "", ato_focus_area: false, legal_basis: "s 8-1",
    ...over,
  };
}

describe("evalPredicate", () => {
  it("truthy / falsy", () => {
    expect(evalPredicate({ ...baseFacts, has_crypto: true }, { field: "has_crypto", op: "truthy" })).toBe(true);
    expect(evalPredicate(baseFacts, { field: "has_crypto", op: "truthy" })).toBe(false);
    expect(evalPredicate(baseFacts, { field: "has_abn", op: "falsy" })).toBe(true);
  });
  it("eq", () => {
    expect(evalPredicate({ ...baseFacts, super_fund_type: "smsf" }, { field: "super_fund_type", op: "eq", value: "smsf" })).toBe(true);
    expect(evalPredicate(baseFacts, { field: "super_fund_type", op: "eq", value: "smsf" })).toBe(false);
  });
});

describe("categoryApplies", () => {
  it("requires structure membership", () => {
    expect(categoryApplies({ ...baseFacts, business_structure: "company" }, cat({ structures: ["none"] }))).toBe(false);
    expect(categoryApplies(baseFacts, cat({ structures: ["none"] }))).toBe(true);
  });
  it("requires all triggers to pass", () => {
    const c = cat({ structures: ["none"], triggers: [{ field: "has_investment_property", op: "truthy" }] });
    expect(categoryApplies(baseFacts, c)).toBe(false);
    expect(categoryApplies({ ...baseFacts, has_investment_property: true }, c)).toBe(true);
  });
});

describe("dedupe", () => {
  it("collapses rows sharing a dedupe_key, keeping the most structure-specific", () => {
    const broad = cat({ id: "broad", dedupe_key: "k", structures: ["sole_trader", "none", "company", "trust", "partnership"], triggers: [] });
    const specific = cat({ id: "specific", dedupe_key: "k", structures: ["sole_trader"], triggers: [{ field: "has_abn", op: "truthy" }] });
    const out = dedupe([broad, specific]);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe("specific");
  });
  it("keeps rows without a dedupe_key", () => {
    const out = dedupe([cat({ id: "a" }), cat({ id: "b" })]);
    expect(out.map((c) => c.id)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ato-mcp/shared exec vitest run test/tools/deduction_discovery.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create types + helpers**

Create `packages/shared/src/tools/deduction_discovery.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ato-mcp/shared exec vitest run test/tools/deduction_discovery.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/tools/deduction_discovery.ts packages/shared/test/tools/deduction_discovery.test.ts
git commit -m "feat(shared): deduction_discovery category types + filtering helpers"
```

---

### Task 4: Generate the taxonomy data file

**Files:**
- Create: `packages/shared/scripts/gen-deduction-categories.mjs`
- Create (generated, committed): `packages/shared/src/data/deduction-categories.ts`
- Modify: `packages/shared/package.json` (add `gen:deductions` script)
- Test: `packages/shared/test/data/deduction-categories.test.ts`

- [ ] **Step 1: Write the generator**

Create `packages/shared/scripts/gen-deduction-categories.mjs`:

```js
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
```

- [ ] **Step 2: Add the npm script**

In `packages/shared/package.json` `scripts`, add:

```json
    "gen:deductions": "node scripts/gen-deduction-categories.mjs",
```

- [ ] **Step 3: Run the generator**

Run: `pnpm --filter @ato-mcp/shared gen:deductions`
Expected: `Wrote 59 categories to src/data/deduction-categories.ts` and the file exists.

- [ ] **Step 4: Write the data-integrity test**

Create `packages/shared/test/data/deduction-categories.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DEDUCTION_CATEGORIES } from "../../src/data/deduction-categories.js";
import { UserFactsSchema } from "../../src/facts.js";

const FACTS_FIELDS = new Set(Object.keys(UserFactsSchema._def.schema.shape));
const ALLOWED_THRESHOLDS = new Set([
  "gst_registration_threshold", "gst_registration_threshold_nonprofit", "instant_asset_write_off",
  "cgt_discount_individual", "super_concessional_cap", "tax_free_threshold",
  "low_income_tax_offset_max", "small_business_income_tax_offset_cap",
]);
const STRUCTS = new Set(["sole_trader", "partnership", "company", "trust", "none"]);

describe("deduction-categories data integrity", () => {
  it("has the full taxonomy", () => {
    expect(DEDUCTION_CATEGORIES.length).toBe(59);
  });
  it("ids are unique", () => {
    const ids = DEDUCTION_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("every trigger.field is a real UserFacts field", () => {
    for (const c of DEDUCTION_CATEGORIES) {
      for (const t of c.triggers) expect(FACTS_FIELDS.has(t.field)).toBe(true);
    }
  });
  it("every threshold is allow-listed", () => {
    for (const c of DEDUCTION_CATEGORIES) {
      for (const n of c.thresholds) expect(ALLOWED_THRESHOLDS.has(n)).toBe(true);
    }
  });
  it("every structure value is valid and non-empty", () => {
    for (const c of DEDUCTION_CATEGORIES) {
      expect(c.structures.length).toBeGreaterThan(0);
      for (const s of c.structures) expect(STRUCTS.has(s)).toBe(true);
    }
  });
  it("seed_doc_ids use a known corpus prefix", () => {
    for (const c of DEDUCTION_CATEGORIES) {
      for (const d of c.seed_doc_ids) expect(/^(ato:|ato-law:|legis:)/.test(d)).toBe(true);
    }
  });
  it("assigns the special kinds", () => {
    const byId = new Map(DEDUCTION_CATEGORIES.map((c) => [c.id, c]));
    expect(byId.get("rental_travel_disallowed_note")!.kind).toBe("disallowance");
    expect(byId.get("spouse_super_contribution_offset")!.kind).toBe("offset");
    expect(byId.get("crypto_cgt_on_disposal")!.kind).toBe("cgt_event");
    expect(byId.get("personal_super_notice_of_intent")!.kind).toBe("precondition");
  });
  it("the super s290-150 trio shares one dedupe_key", () => {
    const keys = ["personal_super_concessional_deduction", "st_personal_super_contribution", "smsf_member_personal_super_deduction"]
      .map((id) => DEDUCTION_CATEGORIES.find((c) => c.id === id)!.dedupe_key);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBeTruthy();
  });
});
```

> Note: `UserFactsSchema` is a `ZodEffects` (it has `.superRefine`), so the inner object is at `_def.schema.shape`. If a future refactor changes this, read the field list from a small exported constant instead.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ato-mcp/shared exec vitest run test/data/deduction-categories.test.ts`
Expected: PASS (8 tests). If "FACTS_FIELDS" is empty (schema shape access changed), fix the accessor before proceeding.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/scripts/gen-deduction-categories.mjs packages/shared/src/data/deduction-categories.ts packages/shared/package.json packages/shared/test/data/deduction-categories.test.ts
git commit -m "feat(shared): generate + verify deduction category taxonomy (59 rows)"
```

---

### Task 5: Confidence, activity match, notes, profile helpers

**Files:**
- Modify: `packages/shared/src/tools/deduction_discovery.ts`
- Modify: `packages/shared/test/tools/deduction_discovery.test.ts`

- [ ] **Step 1: Write the failing tests** (append to the existing test file)

```ts
import { rateConfidence, matchActivity, buildNotes } from "../../src/tools/deduction_discovery.js";
import type { Citation } from "../../src/lib/citations.js";

const oneCite: Citation[] = [{ chunk_id: "c", doc_id: "d", title: "t", snippet: "s", score: 1 }];

describe("rateConfidence", () => {
  it("high when triggered + cited", () => {
    const c = cat({ triggers: [{ field: "has_crypto", op: "truthy" }] });
    expect(rateConfidence(c, oneCite).confidence).toBe("high");
  });
  it("medium when no trigger but cited", () => {
    expect(rateConfidence(cat({ triggers: [] }), oneCite).confidence).toBe("medium");
  });
  it("low when no citation", () => {
    expect(rateConfidence(cat({ triggers: [{ field: "has_crypto", op: "truthy" }] }), []).confidence).toBe("low");
  });
});

describe("matchActivity", () => {
  it("matches by shared terms", () => {
    const surfaced = [
      { id: "wre_tools_equipment", label: "Tools, equipment and depreciating assets used for work", examples: ["work laptop tablet printer"] },
      { id: "wre_car", label: "Work-related car expenses", examples: ["fuel rego insurance"] },
    ];
    const m = matchActivity("I bought a laptop and a printer for work", surfaced);
    expect(m?.category_id).toBe("wre_tools_equipment");
  });
  it("returns null when nothing meaningfully matches", () => {
    expect(matchActivity("xyzzy", [{ id: "a", label: "B", examples: [] }])).toBeNull();
  });
});

describe("buildNotes", () => {
  it("adds a separate-return note for company/trust", () => {
    const notes = buildNotes({ ...baseFacts, business_structure: "company" });
    expect(notes.join(" ")).toMatch(/own return/i);
  });
  it("adds a residency note for working holiday makers", () => {
    const notes = buildNotes({ ...baseFacts, residency_status: "working_holiday_maker" });
    expect(notes.join(" ")).toMatch(/resident/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ato-mcp/shared exec vitest run test/tools/deduction_discovery.test.ts`
Expected: FAIL — `rateConfidence`/`matchActivity`/`buildNotes` not exported.

- [ ] **Step 3: Implement the helpers** (append to `packages/shared/src/tools/deduction_discovery.ts`, after `dedupe`)

```ts
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
    notes.push(`As a ${facts.residency_status.replace(/_/g, " ")}, some concessions (the 50% CGT discount, tax-free threshold, main-residence exemption) may be restricted — verify eligibility.`);
  }
  return notes;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ato-mcp/shared exec vitest run test/tools/deduction_discovery.test.ts`
Expected: PASS (all helper tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/tools/deduction_discovery.ts packages/shared/test/tools/deduction_discovery.test.ts
git commit -m "feat(shared): deduction_discovery confidence + activity-match + notes"
```

---

### Task 6: The `deductionDiscovery()` tool + multi-structure scenario tests

**Files:**
- Modify: `packages/shared/src/tools/deduction_discovery.ts`
- Modify: `packages/shared/package.json` (subpath export)
- Modify: `packages/shared/test/tools/deduction_discovery.test.ts`

- [ ] **Step 1: Write the failing scenario tests** (append to the test file)

```ts
import { deductionDiscovery } from "../../src/tools/deduction_discovery.js";
import type { DeductionDiscoveryDeps } from "../../src/tools/deduction_discovery.js";
import type { Store } from "../../src/store/types.js";
import type { Embedder } from "../../src/embed/types.js";

function depsFor(facts: UserFacts): DeductionDiscoveryDeps {
  const store: Store = {
    stats: async () => ({ installed: true, schema_version: "x", docs: 1, chunks: 1, staleness_days: 0 }),
    keywordSearch: async () => [{ chunk_id: "c", doc_id: "d", ord: 0, text: "t", heading_path: [], score: 1, title: "T", url: "u", doc_type: "ATO_GUIDE", snippet: "s" }],
    vectorSearch: async () => [],
    getChunks: async () => [],
    getDoc: async () => null,
    getDocAnchors: async () => ({ anchors: [], inbound: [], outbound: [] }),
    getDefinition: async () => [],
    getThreshold: async (name) => ({ name, value: 20000, unit: "AUD", effective_from: null, effective_to: null, source_doc_id: null, source_anchor: null }),
    close: () => {},
  };
  const embedder: Embedder = { embed: async () => new Float32Array(384) };
  return { store, embedder, userFacts: facts };
}

function idsFrom(out: Awaited<ReturnType<typeof deductionDiscovery>>): Set<string> {
  return new Set(out.categories.map((c) => c.id));
}

describe("deductionDiscovery scenarios", () => {
  it("throws when facts are missing", async () => {
    await expect(deductionDiscovery({ store: {} as Store, embedder: {} as Embedder, userFacts: null }, { k_citations: 3, include_low_confidence: true }))
      .rejects.toThrow(/onboard/);
  });

  it("employee with occupation: WRE set, no st_/ent_/investor rows", async () => {
    const facts: UserFacts = { ...baseFacts, business_structure: "none", occupation: "registered nurse" };
    const out = await deductionDiscovery(depsFor(facts), { k_citations: 3, include_low_confidence: true });
    const ids = idsFrom(out);
    expect(ids.has("wre_self_education")).toBe(true);
    expect(ids.has("wre_managing_tax_affairs")).toBe(true);
    expect([...ids].some((i) => i.startsWith("st_"))).toBe(false);
    expect([...ids].some((i) => i.startsWith("ent_"))).toBe(false);
    expect(ids.has("rental_loan_interest")).toBe(false);
  });

  it("sole trader who is also employed: both wre_ and st_", async () => {
    const facts: UserFacts = { ...baseFacts, business_structure: "sole_trader", has_abn: true, abn: "51824753556", occupation: "carpenter" };
    const out = await deductionDiscovery(depsFor(facts), { k_citations: 3, include_low_confidence: true });
    const ids = idsFrom(out);
    expect([...ids].some((i) => i.startsWith("wre_"))).toBe(true);
    expect(ids.has("st_operating_expenses")).toBe(true);
    expect([...ids].some((i) => i.startsWith("ent_"))).toBe(false);
  });

  it("company director with rental + crypto: entity rows + personal rows tagged distinctly", async () => {
    const facts: UserFacts = { ...baseFacts, business_structure: "company", has_abn: true, abn: "51824753556", has_investment_property: true, has_crypto: true, prior_fy_lodged: true };
    const out = await deductionDiscovery(depsFor(facts), { k_citations: 3, include_low_confidence: true });
    const ids = idsFrom(out);
    expect(ids.has("ent_directors_fees")).toBe(true);
    expect(ids.has("ent_rd_tax_incentive")).toBe(true);
    expect(ids.has("crypto_cgt_on_disposal")).toBe(true);
    expect(ids.has("rental_loan_interest")).toBe(true);
    const ent = out.categories.find((c) => c.id === "ent_directors_fees")!;
    const rental = out.categories.find((c) => c.id === "rental_loan_interest")!;
    expect(ent.return_context).toBe("business_entity");
    expect(rental.return_context).toBe("personal");
    expect(out.notes.join(" ")).toMatch(/own return/i);
  });

  it("trust: ent_ set minus directors/R&D", async () => {
    const facts: UserFacts = { ...baseFacts, business_structure: "trust", has_abn: true, abn: "51824753556", prior_fy_lodged: true };
    const ids = idsFrom(await deductionDiscovery(depsFor(facts), { k_citations: 3, include_low_confidence: true }));
    expect(ids.has("ent_general_operating_8_1")).toBe(true);
    expect(ids.has("ent_prior_year_tax_losses")).toBe(true);
    expect(ids.has("ent_directors_fees")).toBe(false);
    expect(ids.has("ent_rd_tax_incentive")).toBe(false);
  });

  it("SMSF member: member super deduction, no fund-level rows; super trio deduped to one", async () => {
    const facts: UserFacts = { ...baseFacts, business_structure: "none", super_fund_type: "smsf", occupation: "consultant" };
    const out = await deductionDiscovery(depsFor(facts), { k_citations: 3, include_low_confidence: true });
    const ids = [...idsFrom(out)];
    // Exactly one row carries the super_personal_290_150 dedupe outcome
    const superRows = out.categories.filter((c) => ["personal_super_concessional_deduction", "st_personal_super_contribution", "smsf_member_personal_super_deduction"].includes(c.id));
    expect(superRows.length).toBe(1);
  });

  it("working holiday maker: categories surface with a residency caveat note", async () => {
    const facts: UserFacts = { ...baseFacts, residency_status: "working_holiday_maker", occupation: "fruit picker" };
    const out = await deductionDiscovery(depsFor(facts), { k_citations: 3, include_low_confidence: true });
    expect(out.notes.join(" ")).toMatch(/working holiday/i);
  });

  it("counts break down by kind and disclaimer is present", async () => {
    const facts: UserFacts = { ...baseFacts, has_spouse: true, has_crypto: true, occupation: "teacher" };
    const out = await deductionDiscovery(depsFor(facts), { k_citations: 3, include_low_confidence: true });
    expect(out.disclaimer).toMatch(/not tax advice/i);
    expect(out.counts.offset).toBeGreaterThanOrEqual(1); // spouse offset
    expect(out.counts.cgt_event).toBeGreaterThanOrEqual(1); // crypto
    const spouse = out.categories.find((c) => c.id === "spouse_super_contribution_offset")!;
    expect(spouse.kind).toBe("offset");
  });

  it("include_low_confidence=false drops low-confidence rows", async () => {
    // With a store returning no hits, every category is low-confidence.
    const facts: UserFacts = { ...baseFacts, occupation: "teacher" };
    const deps = depsFor(facts);
    deps.store.keywordSearch = async () => [];
    const out = await deductionDiscovery(deps, { k_citations: 3, include_low_confidence: false });
    expect(out.categories.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ato-mcp/shared exec vitest run test/tools/deduction_discovery.test.ts`
Expected: FAIL — `deductionDiscovery` not exported.

- [ ] **Step 3: Implement the tool** (append to `packages/shared/src/tools/deduction_discovery.ts`)

```ts
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
```

- [ ] **Step 4: Add the subpath export**

In `packages/shared/package.json` `exports`, add (after `./tools/get_user_facts`):

```json
    "./tools/deduction_discovery": {
      "types": "./dist/tools/deduction_discovery.d.ts",
      "import": "./dist/tools/deduction_discovery.js"
    },
```

- [ ] **Step 5: Run the full shared test suite**

Run: `pnpm --filter @ato-mcp/shared test`
Expected: PASS — all prior shared tests plus the new deduction_discovery suite.

- [ ] **Step 6: Typecheck + build shared**

Run: `pnpm --filter @ato-mcp/shared typecheck && pnpm --filter @ato-mcp/shared build`
Expected: no type errors; `dist/tools/deduction_discovery.js` and `dist/lib/citations.js` emitted.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/tools/deduction_discovery.ts packages/shared/package.json packages/shared/test/tools/deduction_discovery.test.ts
git commit -m "feat(shared): implement deduction_discovery tool"
```

---

### Task 7: Register the tool in the MCP server

**Files:**
- Modify: `packages/mcp/src/server.ts`
- Test: `packages/mcp/test/server.test.ts` (append; if absent, create — see Step 1)

- [ ] **Step 1: Write the failing test**

Append to `packages/mcp/test/server.test.ts` (create the file with this content if it does not exist):

```ts
import { describe, it, expect } from "vitest";
import { buildServerForTesting } from "../src/server.js";
import type { Store, Embedder, UserFacts } from "@ato-mcp/shared";

const facts: UserFacts = {
  given_name: "Alice", state: "NSW", residency_status: "resident",
  has_abn: false, business_structure: "none", gst_registered: false, gst_period: "n/a",
  payg_instalments: false, fbt_payer: false, has_spouse: false, dependants: 0,
  hecs_help_debt: false, private_health_insurance: false, has_investment_property: false,
  has_shares_or_managed_funds: false, has_crypto: false, super_fund_type: "industry",
  current_fy: "2025-26", prior_fy_lodged: true,
  accepted_disclaimer_at: "2026-01-01T00:00:00Z", facts_updated_at: "2026-01-01T00:00:00Z", schema_version: 1,
};

const store: Store = {
  stats: async () => ({ installed: true, schema_version: "x", docs: 1, chunks: 1, staleness_days: 0 }),
  keywordSearch: async () => [],
  vectorSearch: async () => [],
  getChunks: async () => [],
  getDoc: async () => null,
  getDocAnchors: async () => ({ anchors: [], inbound: [], outbound: [] }),
  getDefinition: async () => [],
  getThreshold: async () => null,
  close: () => {},
};
const embedder: Embedder = { embed: async () => new Float32Array(384) };

describe("server: deduction_discovery", () => {
  it("lists the tool", () => {
    const srv = buildServerForTesting({ store, embedder, facts, mode: "local" });
    expect(srv.listToolNames()).toContain("deduction_discovery");
  });
  it("dispatches and returns a structured result", async () => {
    const srv = buildServerForTesting({ store, embedder, facts, mode: "local" });
    const res = await srv.callTool("deduction_discovery", {});
    expect(res).toHaveProperty("categories");
    expect(res).toHaveProperty("disclaimer");
    expect(res.fy).toBe("2025-26");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ato-mcp/mcp exec vitest run test/server.test.ts`
Expected: FAIL — `deduction_discovery` not in tool list / unknown tool.

- [ ] **Step 3: Register the tool**

In `packages/mcp/src/server.ts`:

(a) Add the import (after the `getUserFacts` import, line ~27):

```ts
import { deductionDiscovery } from "@ato-mcp/shared/tools/deduction_discovery";
```

(b) Add to the imports from `@ato-mcp/shared` (the schema block, line ~5-14) — add `DeductionDiscoveryInputSchema`:

```ts
  GetThresholdInputSchema,
  DeductionDiscoveryInputSchema,
  UserFactsSchema,
```

(c) Add a `TOOLS` entry (after the `get_user_facts` entry, before the closing `} as const;`):

```ts
  deduction_discovery: {
    description:
      "Surface every deduction-related category that plausibly applies to the authenticated user's tax profile, with corpus citations, thresholds, and a confidence rating. Branches across all taxpayer structures (individual, sole trader, partnership, company, trust, SMSF member). Optionally pass `activity` to focus on a specific spend.",
    inputSchema: {
      type: "object",
      properties: {
        activity: { type: "string" },
        fy: { type: "string" },
        k_citations: { type: "integer", minimum: 1, maximum: 5, default: 3 },
        include_low_confidence: { type: "boolean", default: true },
      },
      additionalProperties: false,
    },
  },
```

(d) Add a `dispatch` case (after the `get_threshold` case):

```ts
    case "deduction_discovery":
      return deductionDiscovery(
        { store: deps.store, embedder: deps.embedder, userFacts: deps.facts ?? null },
        DeductionDiscoveryInputSchema.parse(args),
      );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ato-mcp/mcp exec vitest run test/server.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck mcp**

Run: `pnpm --filter @ato-mcp/mcp typecheck`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/mcp/src/server.ts packages/mcp/test/server.test.ts
git commit -m "feat(mcp): register deduction_discovery tool (local + advertised in hosted)"
```

---

### Task 8: Backend handler

**Files:**
- Create: `packages/backend/api/deduction_discovery.ts`
- Modify: `packages/backend/test/handlers.test.ts`

- [ ] **Step 1: Write the failing test** (append to `packages/backend/test/handlers.test.ts`, before the final closing lines)

```ts
// ---------------------------------------------------------------------------
// deduction_discovery handler
// ---------------------------------------------------------------------------
describe("POST /deduction_discovery", () => {
  it("returns a structured onboard error when the user has no facts (mock store)", async () => {
    const { handler } = await import("../api/deduction_discovery.js");
    const resp = await handler(makePostRequest({}));
    // Mock user_facts returns null → tool throws the onboard message → handled
    expect(resp.status).toBe(400);
    const body = await resp.json() as { kind: string; message: string };
    expect(body.kind).toBe("error");
    expect(body.message).toMatch(/onboard/i);
  });

  it("returns 401 without auth", async () => {
    const { handler } = await import("../api/deduction_discovery.js");
    const req = new Request("https://api.ato-mcp.com.au/deduction_discovery", { method: "POST", body: "{}" });
    const resp = await handler(req);
    expect(resp.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ato-mcp/shared build && pnpm --filter @ato-mcp/backend exec vitest run test/handlers.test.ts`
Expected: FAIL — cannot find `../api/deduction_discovery.js`.

(The `shared build` is required because backend imports resolve to `@ato-mcp/shared`'s `dist`.)

- [ ] **Step 3: Create the handler**

Create `packages/backend/api/deduction_discovery.ts`:

```ts
import { adapt } from "./_adapter.js";
import { authMiddleware } from "./_middleware.js";
import { deductionDiscovery } from "@ato-mcp/shared/tools/deduction_discovery";
import { DeductionDiscoveryInputSchema, UserFactsSchema } from "@ato-mcp/shared";
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
    const args = DeductionDiscoveryInputSchema.parse((await req.json()) as unknown);

    // Resolve the authenticated user's facts (same pattern as get_user_facts handler)
    const svc = makeServiceClient();
    const { data } = await svc.from("user_facts").select("facts").eq("user_id", auth.user_id).single();
    let userFacts: UserFacts | null = null;
    if (data) {
      const parsed = UserFactsSchema.safeParse((data as { facts: unknown }).facts);
      if (parsed.success) userFacts = parsed.data as UserFacts;
    }

    embedder ??= await WasmEmbedder.load();
    const result = await deductionDiscovery({ store, embedder, userFacts }, args);
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ kind: "error", message: msg }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}

export default adapt(handler);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ato-mcp/backend exec vitest run test/handlers.test.ts`
Expected: PASS (the two new cases plus all existing handler tests).

- [ ] **Step 5: Typecheck + build backend**

Run: `pnpm --filter @ato-mcp/backend typecheck && pnpm --filter @ato-mcp/backend build`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/api/deduction_discovery.ts packages/backend/test/handlers.test.ts
git commit -m "feat(backend): deduction_discovery Vercel handler"
```

---

### Task 9: Docs + full-suite verification

**Files:**
- Modify: `CLAUDE.md`
- Modify: `HANDOFF.md` (optional short note)

- [ ] **Step 1: Run the full TS test suite + typecheck**

Run: `pnpm -r build && pnpm -r typecheck && pnpm -r test`
Expected: all workspaces green (shared, mcp, backend, web).

- [ ] **Step 2: Update CLAUDE.md**

In `CLAUDE.md` → "Not yet implemented (v0.4 and beyond)", change the hero-tools bullet from:

```
- Hero workflow tools: `deduction_discovery`, `bas_prep_checklist`, `audit_risk_check`, `depreciation_helper` (the product differentiator from `gunba/ato-mcp`)
```

to:

```
- Hero workflow tools: `bas_prep_checklist`, `audit_risk_check`, `depreciation_helper` (the product differentiator from `gunba/ato-mcp`). `deduction_discovery` is DONE (v0.4 tool 1 of 4).
```

And in the "Done since v0.3 ship" section, add:

```
- **`deduction_discovery` (v0.4 tool 1 of 4) shipped.** Curated 59-row taxonomy (`packages/shared/src/data/deduction-categories.ts`, generated from the verified spec JSON) filtered by user facts → fresh citations via the new shared `resolveCitations()` spine (`packages/shared/src/lib/citations.ts`) → live thresholds → discrete confidence. Branches across all taxpayer structures, tags personal vs business_entity returns, types categories by `kind` (deduction/offset/cgt_event/disallowance/precondition/strategy). Registered in `mcp/src/server.ts`; backend handler `backend/api/deduction_discovery.ts`. Spec: `docs/superpowers/specs/2026-06-03-deduction-discovery-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md HANDOFF.md
git commit -m "docs: mark deduction_discovery shipped (v0.4 tool 1 of 4)"
```

- [ ] **Step 4: Final verification before handoff**

Run: `pnpm -r test`
Expected: green. Confirm `node packages/mcp/bin/ato-mcp.js mcp` (or the existing smoke harness) lists `deduction_discovery` among the tools.

---

## Self-review notes

- **Spec coverage:** §2 input → Task 1; §3 taxonomy → Tasks 3–4; §4 resolution + `resolveCitations` → Tasks 2,6; §5 output → Task 6; §6 confidence → Task 5; §7 branching → Task 6 scenarios; §8 edge cases → Task 6 scenarios + Task 5 notes; §9 resolutions (kind/dedupe/residency/fy) → Task 4 overrides + Task 6; §10 no-advice/disclaimer → Task 6; §12 testing → Tasks 3–8; registration/forwarding → Tasks 7 (forwarder is automatic by name).
- **Type consistency:** `DeductionCategory`, `Citation`, `Confidence`, `CategoryKind`, `DeductionDiscoveryDeps`, `DeductionDiscoveryOutput` are defined once (Tasks 3/5/6) and imported thereafter. `resolveCitations` signature is stable across Tasks 2 and 6.
- **No placeholders:** every code/test step shows complete code. The 59-row data file is the one exception by design — it is generated deterministically from the committed spec JSON (Task 4) rather than inlined.
- **Risk:** the `UserFactsSchema._def.schema.shape` accessor in the Task 4 integrity test depends on Zod internals (the schema is a `ZodEffects`). Step 5 of Task 4 instructs to fix the accessor if the field set comes back empty.
