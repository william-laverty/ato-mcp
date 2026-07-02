// Dynamic dispatcher for every MCP tool endpoint.
//
// One serverless function serves all 13 tools (api.ato-mcp.com.au/<tool> —
// the vercel.json rewrite maps /<tool> → /api/<tool>, and Vercel's filesystem
// router sends anything without an exact api/*.ts match here). Non-tool
// endpoints (facts, usage_event) keep their own files.
//
// Why one function instead of one file per tool:
//   - a deployment previously shipped 16 functions, exceeding plan limits;
//   - each per-tool bundle duplicated the heavy embedder stack;
//   - the per-tool handlers duplicated the user-facts lookup six times.
//
// The dispatch table mirrors packages/mcp/src/server.ts.

import { adapt } from "./_adapter.js";
import { authMiddleware } from "./_middleware.js";
import {
  SearchInputSchema,
  GetChunksInputSchema,
  FetchInputSchema,
  GetDefinitionInputSchema,
  GetDocInputSchema,
  GetDocAnchorsInputSchema,
  GetThresholdInputSchema,
  DeductionDiscoveryInputSchema,
  DepreciationHelperInputSchema,
  BasPrepChecklistInputSchema,
  AuditRiskCheckInputSchema,
  UserFactsSchema,
} from "@ato-mcp/shared";
import type { UserFacts, Embedder } from "@ato-mcp/shared";
import { stats } from "@ato-mcp/shared/tools/stats";
import { search } from "@ato-mcp/shared/tools/search";
import { getChunks } from "@ato-mcp/shared/tools/get_chunks";
import { fetchUri } from "@ato-mcp/shared/tools/fetch";
import { getDefinition } from "@ato-mcp/shared/tools/get_definition";
import { getDoc } from "@ato-mcp/shared/tools/get_doc";
import { getDocAnchors } from "@ato-mcp/shared/tools/get_doc_anchors";
import { getThreshold } from "@ato-mcp/shared/tools/get_threshold";
import { getUserFacts } from "@ato-mcp/shared/tools/get_user_facts";
import { deductionDiscovery } from "@ato-mcp/shared/tools/deduction_discovery";
import { depreciationHelper } from "@ato-mcp/shared/tools/depreciation_helper";
import { basPrepChecklist } from "@ato-mcp/shared/tools/bas_prep_checklist";
import { auditRiskCheck } from "@ato-mcp/shared/tools/audit_risk_check";
import { SupabaseStore } from "../src/supabase-store.js";
import { OpenAIEmbedder } from "../src/openai-embedder.js";
import { makeServiceClient } from "../src/supabase.js";

const store = new SupabaseStore();
// Load the embedder lazily and only for tools that actually embed, so
// stats/get_chunks/etc. stay fast on cold start.
let embedder: Embedder | null = null;
async function getEmbedder(): Promise<Embedder> {
  embedder ??= await OpenAIEmbedder.load();
  return embedder;
}

async function lookupUserFacts(userId: string): Promise<UserFacts | null> {
  const svc = makeServiceClient();
  const { data } = await svc.from("user_facts").select("facts").eq("user_id", userId).single();
  if (!data) return null;
  const parsed = UserFactsSchema.safeParse((data as { facts: unknown }).facts);
  return parsed.success ? (parsed.data as UserFacts) : null;
}

type ToolRunner = (body: unknown, userId: string) => Promise<unknown>;

const TOOLS: Record<string, ToolRunner> = {
  stats: () => stats({ store }),
  search: async (body) =>
    search({ store, embedder: await getEmbedder() }, SearchInputSchema.parse(body)),
  get_chunks: (body) => getChunks({ store }, GetChunksInputSchema.parse(body)),
  fetch: (body) => fetchUri(FetchInputSchema.parse(body)),
  get_definition: (body) => getDefinition({ store }, GetDefinitionInputSchema.parse(body)),
  get_doc: (body) => getDoc({ store }, GetDocInputSchema.parse(body)),
  get_doc_anchors: (body) => getDocAnchors({ store }, GetDocAnchorsInputSchema.parse(body)),
  get_threshold: (body) => getThreshold({ store }, GetThresholdInputSchema.parse(body)),
  get_user_facts: async (_body, userId) =>
    getUserFacts({ facts: await lookupUserFacts(userId) }, {}),
  deduction_discovery: async (body, userId) =>
    deductionDiscovery(
      { store, embedder: await getEmbedder(), userFacts: await lookupUserFacts(userId) },
      DeductionDiscoveryInputSchema.parse(body),
    ),
  depreciation_helper: async (body, userId) =>
    depreciationHelper(
      { store, embedder: await getEmbedder(), userFacts: await lookupUserFacts(userId) },
      DepreciationHelperInputSchema.parse(body),
    ),
  bas_prep_checklist: async (body, userId) =>
    basPrepChecklist(
      { store, embedder: await getEmbedder(), userFacts: await lookupUserFacts(userId) },
      BasPrepChecklistInputSchema.parse(body),
    ),
  audit_risk_check: async (body, userId) =>
    auditRiskCheck(
      { store, embedder: await getEmbedder(), userFacts: await lookupUserFacts(userId) },
      AuditRiskCheckInputSchema.parse(body),
    ),
};

function toolNameFrom(req: Request): string {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? "";
}

export async function handler(req: Request): Promise<Response> {
  const auth = await authMiddleware(req);
  if (auth instanceof Response) return auth;

  const tool = toolNameFrom(req);
  const run = TOOLS[tool];
  if (!run) {
    return new Response(JSON.stringify({ kind: "error", message: `unknown_tool: ${tool}` }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const raw = req.method === "GET" || req.method === "HEAD" ? "" : await req.text();
    const body: unknown = raw ? JSON.parse(raw) : {};
    const result = await run(body, auth.user_id);
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ kind: "error", message: msg }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}

export default adapt(handler);
