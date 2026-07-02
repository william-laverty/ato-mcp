import { describe, it, expect } from "vitest";
import { UserFactsSchema, isValidAbn } from "../src/facts.js";

// Minimal valid facts object (no ABN, sole individual, not GST registered)
const base = {
  given_name: "Alice",
  state: "NSW" as const,
  residency_status: "resident" as const,
  has_abn: false,
  business_structure: "none" as const,
  gst_registered: false,
  gst_period: "n/a" as const,
  payg_instalments: false,
  fbt_payer: false,
  has_spouse: false,
  dependants: 0,
  hecs_help_debt: false,
  private_health_insurance: false,
  has_investment_property: false,
  has_shares_or_managed_funds: false,
  has_crypto: false,
  super_fund_type: "industry" as const,
  current_fy: "2025-26",
  prior_fy_lodged: true,
  accepted_disclaimer_at: "2026-01-01T00:00:00Z",
  facts_updated_at: "2026-01-01T00:00:00Z",
  schema_version: 1 as const,
};

describe("isValidAbn", () => {
  it("accepts a known-good ABN (ATO sample 51824753556)", () => {
    expect(isValidAbn("51824753556")).toBe(true);
  });

  it("rejects an ABN with a flipped last digit (51824753557)", () => {
    expect(isValidAbn("51824753557")).toBe(false);
  });

  it("rejects an ABN that is all zeros", () => {
    expect(isValidAbn("00000000000")).toBe(false);
  });

  it("rejects an ABN shorter than 11 digits", () => {
    expect(isValidAbn("5182475355")).toBe(false);
  });

  it("rejects an ABN longer than 11 digits", () => {
    expect(isValidAbn("518247535560")).toBe(false);
  });

  it("rejects an ABN containing non-digit characters", () => {
    expect(isValidAbn("5182475355X")).toBe(false);
  });

  it("rejects an ABN of all ones (11111111111)", () => {
    // weighted sum with all ones: digits[0]-1=0, sum = 0*10 + 1*1 + 1*3 + ... ≠ multiple of 89
    expect(isValidAbn("11111111111")).toBe(false);
  });
});

describe("UserFactsSchema — valid input", () => {
  it("accepts a minimal valid facts object (no ABN, not GST registered)", () => {
    expect(() => UserFactsSchema.parse(base)).not.toThrow();
  });

  it("accepts facts with a valid ABN when has_abn=true", () => {
    expect(() =>
      UserFactsSchema.parse({
        ...base,
        has_abn: true,
        abn: "51824753556",
        business_structure: "sole_trader",
      }),
    ).not.toThrow();
  });

  it("accepts facts with gst_registered=true and a non-n/a period", () => {
    expect(() =>
      UserFactsSchema.parse({
        ...base,
        has_abn: true,
        abn: "51824753556",
        business_structure: "sole_trader",
        gst_registered: true,
        gst_period: "quarterly",
      }),
    ).not.toThrow();
  });

  it("accepts facts with a valid ANZSIC industry_code", () => {
    expect(() =>
      UserFactsSchema.parse({ ...base, industry_code: "6920" }), // Accounting Services
    ).not.toThrow();
  });

  it("accepts facts with no industry_code (field is optional)", () => {
    const { industry_code: _, ...noCode } = { ...base, industry_code: undefined };
    expect(() => UserFactsSchema.parse(noCode)).not.toThrow();
  });
});

describe("UserFactsSchema — ABN validation", () => {
  it("rejects has_abn=true with missing abn field", () => {
    expect(() =>
      UserFactsSchema.parse({ ...base, has_abn: true }),
    ).toThrow();
  });

  it("rejects has_abn=true with a bad checksum ABN (11111111111)", () => {
    expect(() =>
      UserFactsSchema.parse({ ...base, has_abn: true, abn: "11111111111" }),
    ).toThrow();
  });

  it("rejects has_abn=true with a flipped-digit ABN (51824753557)", () => {
    expect(() =>
      UserFactsSchema.parse({ ...base, has_abn: true, abn: "51824753557" }),
    ).toThrow();
  });

  it("allows has_abn=false with no abn", () => {
    expect(() => UserFactsSchema.parse({ ...base, has_abn: false })).not.toThrow();
  });

  it("allows has_abn=false even when abn field is provided (not validated)", () => {
    // If has_abn is false the abn value is ignored by superRefine
    expect(() =>
      UserFactsSchema.parse({ ...base, has_abn: false, abn: "99999999999" }),
    ).not.toThrow();
  });
});

describe("UserFactsSchema — GST cross-field validation", () => {
  it("rejects gst_registered=true with gst_period='n/a'", () => {
    expect(() =>
      UserFactsSchema.parse({ ...base, gst_registered: true, gst_period: "n/a" }),
    ).toThrow(/GST period required/);
  });

  it("rejects gst_registered=false with gst_period='quarterly'", () => {
    expect(() =>
      UserFactsSchema.parse({ ...base, gst_registered: false, gst_period: "quarterly" }),
    ).toThrow(/must be 'n\/a'/);
  });

  it("rejects gst_registered=false with gst_period='monthly'", () => {
    expect(() =>
      UserFactsSchema.parse({ ...base, gst_registered: false, gst_period: "monthly" }),
    ).toThrow();
  });
});

describe("UserFactsSchema — ANZSIC industry code validation", () => {
  it("rejects an unknown industry code", () => {
    expect(() =>
      UserFactsSchema.parse({ ...base, industry_code: "9999" }),
    ).toThrow(/Unknown ANZSIC code/);
  });

  it("accepts a known industry code (0111)", () => {
    expect(() =>
      UserFactsSchema.parse({ ...base, industry_code: "0111" }),
    ).not.toThrow();
  });
});

describe("UserFactsSchema — field-level validation", () => {
  it("rejects given_name as empty string", () => {
    expect(() => UserFactsSchema.parse({ ...base, given_name: "" })).toThrow();
  });

  it("rejects an invalid state", () => {
    expect(() =>
      UserFactsSchema.parse({ ...base, state: "ZZ" as any }),
    ).toThrow();
  });

  it("rejects dependants above 20", () => {
    expect(() =>
      UserFactsSchema.parse({ ...base, dependants: 21 }),
    ).toThrow();
  });

  it("rejects a non-integer dependants value", () => {
    expect(() =>
      UserFactsSchema.parse({ ...base, dependants: 1.5 }),
    ).toThrow();
  });

  it("rejects current_fy not matching YYYY-YY pattern", () => {
    expect(() =>
      UserFactsSchema.parse({ ...base, current_fy: "2025/26" }),
    ).toThrow();
  });

  it("rejects schema_version !== 1", () => {
    expect(() =>
      UserFactsSchema.parse({ ...base, schema_version: 2 as any }),
    ).toThrow();
  });
});
