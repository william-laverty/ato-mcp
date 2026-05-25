import { z } from "zod";

export const DocSchema = z.object({
  doc_id: z.string().min(1),
  source: z.enum(["ato", "legislation", "austlii", "state_revenue"]),
  url: z.string().url(),
  title: z.string(),
  jurisdiction: z.string().default("AU"),
  doc_type: z.string(),
  effective_from: z.string().nullable().optional(),
  effective_to: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  retrieved_at: z.string(),
  metadata: z.record(z.unknown()).default({}),
});

export type Doc = z.infer<typeof DocSchema>;

export const ChunkSchema = z.object({
  chunk_id: z.string().min(1),
  doc_id: z.string().min(1),
  ord: z.number().int().nonnegative(),
  text: z.string(),
  heading_path: z.array(z.string()).default([]),
  effective_from: z.string().nullable().optional(),
  effective_to: z.string().nullable().optional(),
  char_start: z.number().int().nonnegative(),
  char_end: z.number().int().nonnegative(),
});

export type Chunk = z.infer<typeof ChunkSchema>;

export interface SearchHit {
  chunk_id: string;
  doc_id: string;
  ord: number;
  text: string;
  heading_path: string[];
  score: number;
  title: string;
  url: string;
  doc_type: string;
  snippet: string;
}
