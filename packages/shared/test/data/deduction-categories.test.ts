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
