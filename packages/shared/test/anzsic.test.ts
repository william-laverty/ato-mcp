import { describe, it, expect } from "vitest";
import { ANZSIC_CODES, isValidAnzsicCode } from "../src/lib/anzsic.js";

describe("ANZSIC_CODES", () => {
  it("contains at least 80 codes", () => {
    expect(ANZSIC_CODES.length).toBeGreaterThanOrEqual(80);
  });

  it("all codes are 4-digit strings", () => {
    for (const entry of ANZSIC_CODES) {
      expect(entry.code).toMatch(/^\d{4}$/);
    }
  });

  it("all entries have non-empty titles", () => {
    for (const entry of ANZSIC_CODES) {
      expect(entry.title.length).toBeGreaterThan(0);
    }
  });

  it("codes are unique", () => {
    const seen = new Set<string>();
    for (const entry of ANZSIC_CODES) {
      expect(seen.has(entry.code), `Duplicate code: ${entry.code}`).toBe(false);
      seen.add(entry.code);
    }
  });
});

describe("isValidAnzsicCode", () => {
  it("validates known code — nursery production (0111)", () => {
    expect(isValidAnzsicCode("0111")).toBe(true);
  });

  it("validates accounting services (6920)", () => {
    expect(isValidAnzsicCode("6920")).toBe(true);
  });

  it("validates legal services (6910)", () => {
    expect(isValidAnzsicCode("6910")).toBe(true);
  });

  it("validates supermarket and grocery stores (4110)", () => {
    expect(isValidAnzsicCode("4110")).toBe(true);
  });

  it("validates cafes and restaurants (4511)", () => {
    expect(isValidAnzsicCode("4511")).toBe(true);
  });

  it("rejects unknown code 9999", () => {
    expect(isValidAnzsicCode("9999")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidAnzsicCode("")).toBe(false);
  });

  it("rejects 3-digit prefix 011 (too short)", () => {
    expect(isValidAnzsicCode("011")).toBe(false);
  });

  it("rejects a non-numeric code", () => {
    expect(isValidAnzsicCode("XXXX")).toBe(false);
  });
});
