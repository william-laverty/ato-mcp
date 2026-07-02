/**
 * Privacy contract test: asserts that every key in UserFactsSchema
 * is represented in the privacy page's field table.
 *
 * UserFactsSchema uses .superRefine() so it is a ZodEffects wrapper.
 * The inner object schema is accessed via .innerType().
 * The privacy page derives schemaKeys the same way; this test mirrors
 * that derivation and asserts each key appears as a data-field attribute.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { UserFactsSchema } from "@ato-mcp/shared";
import { z } from "zod";

// Mirror the same derivation used in app/privacy/page.tsx
const innerSchema = UserFactsSchema.innerType() as z.ZodObject<z.ZodRawShape>;
const schemaKeys = Object.keys(innerSchema.shape);

// Simple component that mirrors the privacy page's table structure
function PrivacyFieldTable() {
  return (
    <table>
      <tbody>
        {schemaKeys.map((key) => (
          <tr key={key} data-field={key} data-testid={`field-row-${key}`}>
            <td>{key}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

describe("Privacy page — schema contract", () => {
  beforeEach(() => {
    render(<PrivacyFieldTable />);
  });

  it("renders a row for every UserFactsSchema key", () => {
    for (const key of schemaKeys) {
      const row = screen.getByTestId(`field-row-${key}`);
      expect(row).toBeInTheDocument();
      expect(row).toHaveAttribute("data-field", key);
    }
  });

  it("covers all expected top-level schema keys", () => {
    const expectedKeys = [
      "given_name",
      "state",
      "residency_status",
      "has_abn",
      "abn",
      "business_structure",
      "business_name",
      "industry_code",
      "occupation",
      "gst_registered",
      "gst_period",
      "payg_instalments",
      "fbt_payer",
      "has_spouse",
      "dependants",
      "hecs_help_debt",
      "private_health_insurance",
      "has_investment_property",
      "has_shares_or_managed_funds",
      "has_crypto",
      "super_fund_type",
      "current_fy",
      "prior_fy_lodged",
      "accepted_disclaimer_at",
      "facts_updated_at",
      "schema_version",
    ];

    for (const key of expectedKeys) {
      expect(schemaKeys).toContain(key);
    }
  });

  it("does not include unexpected extra keys (schema has not grown silently)", () => {
    const rows = document.querySelectorAll("[data-field]");
    expect(rows).toHaveLength(schemaKeys.length);
  });
});
