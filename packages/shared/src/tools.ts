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

export const StatsInputSchema = z.object({}).optional();

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

export type ToolName = "search" | "get_chunks" | "fetch" | "stats" | "get_definition" | "get_doc" | "get_doc_anchors" | "get_threshold" | "deduction_discovery";
