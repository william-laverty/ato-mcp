import { z } from "zod";
import { readFileSync } from "node:fs";

export type CaseKind = "search" | "definition" | "threshold";

const base = { id: z.string().min(1), notes: z.string().optional() };

export const SearchCaseSchema = z.object({
  ...base,
  kind: z.literal("search"),
  query: z.string().min(1),
  expected_docs: z.array(z.string().min(1)).min(1),
  expected_anchors: z.array(z.string()).optional(),
});

export const DefinitionCaseSchema = z.object({
  ...base,
  kind: z.literal("definition"),
  term: z.string().min(1),
  expected_docs: z.array(z.string().min(1)).min(1),
});

export const ThresholdCaseSchema = z.object({
  ...base,
  kind: z.literal("threshold"),
  key: z.string().min(1),
  expected_value: z.number().optional(),
});

export const GoldenCaseSchema = z.discriminatedUnion("kind", [
  SearchCaseSchema,
  DefinitionCaseSchema,
  ThresholdCaseSchema,
]);

export type GoldenCase = z.infer<typeof GoldenCaseSchema>;

export const GoldenSetSchema = z.array(GoldenCaseSchema).min(1);

export function loadGolden(path: string): GoldenCase[] {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return GoldenSetSchema.parse(raw);
}
