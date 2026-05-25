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
});

export type GetChunksInput = z.infer<typeof GetChunksInputSchema>;

export const FetchInputSchema = z.object({
  uri: z.string().min(1),
});

export type FetchInput = z.infer<typeof FetchInputSchema>;

export const StatsInputSchema = z.object({}).optional();

export type ToolName = "search" | "get_chunks" | "fetch" | "stats";
