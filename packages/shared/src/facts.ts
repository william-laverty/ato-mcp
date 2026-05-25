import { z } from "zod";
import { isValidAnzsicCode } from "./lib/anzsic.js";

const Years = z.string().regex(/^\d{4}-\d{2}$/, "FY must be YYYY-YY");

/**
 * ABN checksum validation per ATO/ABR specification (modulus 89).
 * Algorithm: subtract 1 from the leading digit, then compute a weighted sum
 * using weights [10,1,3,5,7,9,11,13,15,17,19]; the sum must be divisible by 89.
 *
 * Known-good test vector: "51824753556" (ATO sample ABN).
 */
export function isValidAbn(abn: string): boolean {
  if (!/^\d{11}$/.test(abn)) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = abn.split("").map(Number);
  digits[0]! -= 1; // subtract 1 from leading digit per ABR spec
  let sum = 0;
  for (let i = 0; i < 11; i++) sum += digits[i]! * weights[i]!;
  return sum % 89 === 0;
}

export const UserFactsSchema = z
  .object({
    given_name: z.string().min(1),
    state: z.enum(["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]),
    residency_status: z.enum([
      "resident",
      "non_resident",
      "temporary_resident",
      "working_holiday_maker",
    ]),

    has_abn: z.boolean(),
    abn: z.string().optional(),
    business_structure: z.enum([
      "sole_trader",
      "partnership",
      "company",
      "trust",
      "none",
    ]),
    business_name: z.string().optional(),
    industry_code: z.string().optional(),
    occupation: z.string().optional(),
    gst_registered: z.boolean(),
    gst_period: z.enum(["monthly", "quarterly", "annual", "n/a"]),
    payg_instalments: z.boolean(),
    fbt_payer: z.boolean(),

    has_spouse: z.boolean(),
    dependants: z.number().int().min(0).max(20),
    hecs_help_debt: z.boolean(),
    private_health_insurance: z.boolean(),
    has_investment_property: z.boolean(),
    has_shares_or_managed_funds: z.boolean(),
    has_crypto: z.boolean(),
    super_fund_type: z.enum(["industry", "retail", "smsf", "unsure", "none"]),

    current_fy: Years,
    prior_fy_lodged: z.boolean(),

    accepted_disclaimer_at: z.string(),
    facts_updated_at: z.string(),
    schema_version: z.literal(1),
  })
  .superRefine((data, ctx) => {
    // ABN: if has_abn is true, abn must be present and pass checksum
    if (data.has_abn && (!data.abn || !isValidAbn(data.abn))) {
      ctx.addIssue({
        code: "custom",
        path: ["abn"],
        message: "ABN missing or fails checksum",
      });
    }
    // GST: gst_period must match gst_registered
    if (data.gst_registered && data.gst_period === "n/a") {
      ctx.addIssue({
        code: "custom",
        path: ["gst_period"],
        message: "GST period required when registered",
      });
    }
    if (!data.gst_registered && data.gst_period !== "n/a") {
      ctx.addIssue({
        code: "custom",
        path: ["gst_period"],
        message: "GST period must be 'n/a' when not registered",
      });
    }
    // Industry code: must be a valid ANZSIC code if provided
    if (data.industry_code && !isValidAnzsicCode(data.industry_code)) {
      ctx.addIssue({
        code: "custom",
        path: ["industry_code"],
        message: "Unknown ANZSIC code",
      });
    }
  });

export type UserFacts = z.infer<typeof UserFactsSchema>;
