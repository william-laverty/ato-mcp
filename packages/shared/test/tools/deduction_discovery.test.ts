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
