import { z } from "zod";

export const SearchInputSchema = z.object({
  query: z.string().min(1),
  k: z.number().int().min(1).max(50).default(10),
  mode: z.enum(["hybrid", "vector", "keyword"]).default("hybrid"),
  source: z.array(z.string()).optional(),
  doc_type: z.array(z.string()).optional(),
  jurisdiction: z.string().optional(),
  pit: z.string().optional(),
  include_old: z.boolean().default(false),
});

export type SearchInput = z.infer<typeof SearchInputSchema>;

export const GetChunksInputSchema = z.object({
  chunk_ids: z.array(z.string().min(1)).min(1).max(50),
  neighbours: z.number().int().min(0).max(5).default(0),
  pit: z.string().optional(),
});

export type GetChunksInput = z.infer<typeof GetChunksInputSchema>;

export const FetchInputSchema = z.object({
  uri: z.string().min(1),
});

export type FetchInput = z.infer<typeof FetchInputSchema>;

export const GetDefinitionInputSchema = z.object({
  term: z.string().min(1),
  pit: z.string().optional(),
  jurisdiction: z.string().default("AU"),
});
export type GetDefinitionInput = z.infer<typeof GetDefinitionInputSchema>;

export const GetDocInputSchema = z.object({
  doc_id: z.string().min(1),
  pit: z.string().optional(),
});
export type GetDocInput = z.infer<typeof GetDocInputSchema>;

export const GetDocAnchorsInputSchema = z.object({
  doc_id: z.string().min(1),
});
export type GetDocAnchorsInput = z.infer<typeof GetDocAnchorsInputSchema>;

export const GetThresholdInputSchema = z.object({
  name: z.string().min(1),
  pit: z.string().optional(),
});
export type GetThresholdInput = z.infer<typeof GetThresholdInputSchema>;

export const DeductionDiscoveryInputSchema = z.object({
  activity: z.string().optional(),
  fy: z.string().regex(/^\d{4}-\d{2}$/, "FY must be YYYY-YY").optional(),
  k_citations: z.number().int().min(1).max(5).default(3),
  include_low_confidence: z.boolean().default(true),
});
export type DeductionDiscoveryInput = z.infer<typeof DeductionDiscoveryInputSchema>;

export const DepreciationHelperInputSchema = z.object({
  asset_cost: z.number().positive(),
  acquisition_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "acquisition_date must be YYYY-MM-DD"),
  business_use_pct: z.number().min(0).max(100).default(100),
  asset_type: z.string().optional(),
  effective_life_years: z.number().positive().optional(),
  is_small_business_entity: z.boolean().optional(),
  is_capital_works: z.boolean().default(false),
  method: z.enum(["prime_cost", "diminishing_value", "both"]).default("both"),
  fy: z.string().regex(/^\d{4}-\d{2}$/, "FY must be YYYY-YY").optional(),
  years: z.number().int().min(1).max(40).optional(),
});
export type DepreciationHelperInput = z.infer<typeof DepreciationHelperInputSchema>;

export const BasPrepChecklistInputSchema = z.object({
  period_type: z.enum(["monthly", "quarterly", "annual"]).optional(),
  quarter: z.number().int().min(1).max(4).optional(),
  fy: z.string().regex(/^\d{4}-\d{2}$/, "FY must be YYYY-YY").optional(),
  full_gst_method: z.boolean().default(false),
});
export type BasPrepChecklistInput = z.infer<typeof BasPrepChecklistInputSchema>;

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

export type ToolName = "search" | "get_chunks" | "fetch" | "stats" | "get_definition" | "get_doc" | "get_doc_anchors" | "get_threshold" | "deduction_discovery" | "depreciation_helper" | "bas_prep_checklist" | "audit_risk_check";
