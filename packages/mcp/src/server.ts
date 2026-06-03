import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs";
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
  UserFactsSchema,
} from "@ato-mcp/shared";
import type { Store, Embedder, UserFacts } from "@ato-mcp/shared";
import { SqliteStore } from "./store/sqlite.js";
import { OnnxEmbedder } from "./embed/onnx.js";
import { RemoteToolForwarder } from "./lib/remote-tools.js";
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
import { corpusPath, dataDir, configPath } from "./lib/paths.js";

interface ServerDeps {
  store: Store | null;
  embedder: Embedder;
  wordnetLookup?: (term: string) => Promise<string | null>;
  facts?: UserFacts | null;
  mode?: "local" | "hosted";
}

interface Config {
  mode?: "local" | "hosted";
  api_endpoint?: string;
  bearer_token?: string;
  facts?: unknown;
}

function readConfig(): Config {
  const p = configPath();
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, "utf-8")) as Config;
}

const TOOLS = {
  stats: {
    description: "Report corpus installation status, version, and counts.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  search: {
    description:
      "Hybrid BM25 + vector search over the ATO corpus. Returns top-k chunks with [doc:X] citations.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1 },
        k: { type: "integer", minimum: 1, maximum: 50, default: 10 },
        mode: { type: "string", enum: ["hybrid", "vector", "keyword"], default: "hybrid" },
        include_old: { type: "boolean", default: false },
        pit: { type: "string" },
      },
      required: ["query"],
      additionalProperties: true,
    },
  },
  get_chunks: {
    description: "Fetch chunk bodies by chunk_id with optional neighbour context.",
    inputSchema: {
      type: "object",
      properties: {
        chunk_ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 50 },
        neighbours: { type: "integer", minimum: 0, maximum: 5, default: 0 },
        pit: { type: "string" },
      },
      required: ["chunk_ids"],
      additionalProperties: false,
    },
  },
  fetch: {
    description:
      "Live-fetch a document by URI. Supports `ato:`, `ato-law:`, `legis:`, and `staterev-<juris>:` schemes.",
    inputSchema: {
      type: "object",
      properties: { uri: { type: "string", minLength: 1 } },
      required: ["uri"],
      additionalProperties: false,
    },
  },
  get_definition: {
    description: "Statutory definition with optional point-in-time. Falls back to labelled ordinary-meaning (WordNet) when no statutory match. Caller MUST respect kind:'ordinary' vs kind:'statutory'.",
    inputSchema: { type: "object", properties: { term: { type: "string", minLength: 1 }, pit: { type: "string" }, jurisdiction: { type: "string", default: "AU" } }, required: ["term"], additionalProperties: false },
  },
  get_doc: {
    description: "Fetch full document by doc_id with cleaned HTML and anchor list.",
    inputSchema: { type: "object", properties: { doc_id: { type: "string", minLength: 1 }, pit: { type: "string" } }, required: ["doc_id"], additionalProperties: false },
  },
  get_doc_anchors: {
    description: "List in-document anchors and the citation graph (inbound + outbound) for a doc.",
    inputSchema: { type: "object", properties: { doc_id: { type: "string", minLength: 1 } }, required: ["doc_id"], additionalProperties: false },
  },
  get_threshold: {
    description: "Time-keyed scalar tax fact lookup (e.g. gst_registration_threshold, instant_asset_write_off, super_concessional_cap). PIT-aware.",
    inputSchema: { type: "object", properties: { name: { type: "string", minLength: 1 }, pit: { type: "string" } }, required: ["name"], additionalProperties: false },
  },
  get_user_facts: {
    description: "Return the authenticated user's personal tax facts (state, ABN, business structure, GST, dependants, etc.). Call once on initialise and reason from the result throughout the session.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  deduction_discovery: {
    description:
      "Surface every deduction-related category that plausibly applies to the authenticated user's tax profile, with corpus citations, thresholds, and a confidence rating. Branches across all taxpayer structures (individual, sole trader, partnership, company, trust, SMSF member). Optionally pass `activity` to focus on a specific spend.",
    inputSchema: {
      type: "object",
      properties: {
        activity: { type: "string" },
        fy: { type: "string" },
        k_citations: { type: "integer", minimum: 1, maximum: 5, default: 3 },
        include_low_confidence: { type: "boolean", default: true },
      },
      additionalProperties: false,
    },
  },
  depreciation_helper: {
    description:
      "Compute depreciation for an asset across all applicable methods (prime cost, diminishing value, instant asset write-off, $300 immediate, small business pool, Division 43 capital works), branched by the user's taxpayer structure. Returns year-by-year schedules, the live instant-asset-write-off threshold, and corpus citations. Inputs: asset_cost, acquisition_date (YYYY-MM-DD), and optionally business_use_pct, effective_life_years, is_small_business_entity, is_capital_works, asset_type, fy.",
    inputSchema: {
      type: "object",
      properties: {
        asset_cost: { type: "number", exclusiveMinimum: 0 },
        acquisition_date: { type: "string" },
        business_use_pct: { type: "number", minimum: 0, maximum: 100, default: 100 },
        asset_type: { type: "string" },
        effective_life_years: { type: "number", exclusiveMinimum: 0 },
        is_small_business_entity: { type: "boolean" },
        is_capital_works: { type: "boolean", default: false },
        method: { type: "string", enum: ["prime_cost", "diminishing_value", "both"], default: "both" },
        fy: { type: "string" },
        years: { type: "integer", minimum: 1, maximum: 40 },
      },
      required: ["asset_cost", "acquisition_date"],
      additionalProperties: false,
    },
  },
  bas_prep_checklist: {
    description:
      "Produce a tiered, cited BAS preparation checklist for the user's GST reporting period: which labels apply (GST G1/1A/1B, PAYG-W, PAYG-I, FBT instalment, fuel tax credits, WET, LCT), what evidence to gather, and common gotchas. Does not calculate amounts. Optional inputs: period_type (monthly/quarterly/annual), quarter (1-4), fy, full_gst_method.",
    inputSchema: {
      type: "object",
      properties: {
        period_type: { type: "string", enum: ["monthly", "quarterly", "annual"] },
        quarter: { type: "integer", minimum: 1, maximum: 4 },
        fy: { type: "string" },
        full_gst_method: { type: "boolean", default: false },
      },
      additionalProperties: false,
    },
  },
} as const;

async function dispatch(name: string, args: unknown, deps: ServerDeps): Promise<unknown> {
  switch (name) {
    case "stats":
      return stats({ store: deps.store, data_dir: dataDir(), corpus_path: corpusPath() });
    case "search":
      return search(deps, SearchInputSchema.parse(args));
    case "get_chunks":
      return getChunks(deps, GetChunksInputSchema.parse(args));
    case "fetch":
      return fetchUri(FetchInputSchema.parse(args));
    case "get_definition":
      return getDefinition({ store: deps.store, wordnetLookup: deps.wordnetLookup }, GetDefinitionInputSchema.parse(args));
    case "get_doc":
      return getDoc({ store: deps.store }, GetDocInputSchema.parse(args));
    case "get_doc_anchors":
      return getDocAnchors({ store: deps.store }, GetDocAnchorsInputSchema.parse(args));
    case "get_threshold":
      return getThreshold({ store: deps.store }, GetThresholdInputSchema.parse(args));
    case "get_user_facts":
      return getUserFacts(
        {
          facts: deps.facts ?? null,
          fetchedFrom: deps.mode === "hosted" ? "hosted_api" : "config_file",
          mode: deps.mode ?? "local",
        },
        {},
      );
    case "deduction_discovery":
      return deductionDiscovery(
        { store: deps.store, embedder: deps.embedder, userFacts: deps.facts ?? null },
        DeductionDiscoveryInputSchema.parse(args),
      );
    case "depreciation_helper":
      return depreciationHelper(
        { store: deps.store, embedder: deps.embedder, userFacts: deps.facts ?? null },
        DepreciationHelperInputSchema.parse(args),
      );
    case "bas_prep_checklist":
      return basPrepChecklist(
        { store: deps.store, embedder: deps.embedder, userFacts: deps.facts ?? null },
        BasPrepChecklistInputSchema.parse(args),
      );
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export function buildServerForTesting(deps: ServerDeps) {
  return {
    listToolNames(): string[] {
      return Object.keys(TOOLS);
    },
    async callTool(name: string, args: unknown): Promise<any> {
      return dispatch(name, args, deps);
    },
    close(): void {
      deps.store?.close();
    },
  };
}

function readFactsFromConfig(cfg: Config): UserFacts | null {
  if (!cfg.facts) return null;
  const parsed = UserFactsSchema.safeParse(cfg.facts);
  if (!parsed.success) {
    process.stderr.write(
      `[ato-mcp] Warning: facts in config.json failed validation: ${parsed.error.message}\n`,
    );
    return null;
  }
  return parsed.data;
}

export async function runMcp(): Promise<void> {
  const cfg = readConfig();
  const mode: "local" | "hosted" = cfg.mode === "hosted" ? "hosted" : "local";

  const server = new Server(
    { name: "ato-mcp", version: "0.3.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Object.entries(TOOLS).map(([name, def]) => ({
      name,
      description: def.description,
      inputSchema: def.inputSchema,
    })),
  }));

  if (mode === "hosted") {
    // Hosted mode: every tool call is forwarded over HTTPS. No local
    // Store/Embedder/SQLite. The backend runs the shared tool code
    // server-side against Supabase.
    if (!cfg.api_endpoint || !cfg.bearer_token) {
      throw new Error("Hosted mode configured but api_endpoint/bearer_token missing in config");
    }
    const forwarder = new RemoteToolForwarder(cfg.api_endpoint, cfg.bearer_token);

    server.setRequestHandler(CallToolRequestSchema, async (req) => {
      const { name, arguments: args } = req.params;
      try {
        const result = await forwarder.call(name, args ?? {});
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ kind: "error", message }, null, 2) }],
        };
      }
    });
  } else {
    // Local mode: open SQLite + ONNX, dispatch tools locally.
    const dbPath = corpusPath();
    const store: Store | null = fs.existsSync(dbPath) ? new SqliteStore(dbPath) : null;
    const facts = readFactsFromConfig(cfg);
    const embedder = await OnnxEmbedder.load();

    server.setRequestHandler(CallToolRequestSchema, async (req) => {
      const { name, arguments: args } = req.params;
      try {
        const result = await dispatch(name, args ?? {}, { store, embedder, facts, mode });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ kind: "error", message }, null, 2) }],
        };
      }
    });
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
