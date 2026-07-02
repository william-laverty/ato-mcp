import { createRequire } from "node:module";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { RemoteToolForwarder } from "./lib/remote-tools.js";

const DEFAULT_API = "https://api.ato-mcp.com.au";

// serverInfo.version must track the released package — read it from
// package.json instead of hardcoding (which drifted: 1.1.0 vs 1.1.1).
// Resolves from both src/ (dev) and dist/ (published) since each sits one
// level below the package root.
function packageVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    return (require("../package.json") as { version: string }).version;
  } catch {
    return "unknown";
  }
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
      "Live-fetch a document by URI. Supports `ato:`, `ato-law:`, `legis:`, and `staterev-<juris>:` schemes. If the source site blocks automated access, `ato:`/`ato-law:` URIs are served from the stored corpus copy (`served_from: \"corpus\"`, with `retrieved_at`).",
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
  audit_risk_check: {
    description:
      "Flag patterns the ATO is known to scrutinise, given the user's facts + a draft return summary (income, deductions, rental). Returns qualitative red-flag findings with a risk band, why-flagged, what-to-do and ATO guidance citations. A heuristic indicator, NOT an audit prediction and NOT numeric benchmarking. Optional inputs: income, deductions [{category, amount}], rental {income, interest, repairs, capital_works}, business_income, fy.",
    inputSchema: {
      type: "object",
      properties: {
        income: { type: "number", minimum: 0 },
        deductions: { type: "array", items: { type: "object", properties: { category: { type: "string" }, amount: { type: "number", minimum: 0 } }, required: ["category", "amount"], additionalProperties: false } },
        rental: { type: "object", properties: { income: { type: "number", minimum: 0 }, interest: { type: "number", minimum: 0 }, repairs: { type: "number", minimum: 0 }, capital_works: { type: "number", minimum: 0 } }, additionalProperties: false },
        business_income: { type: "number" },
        fy: { type: "string" },
      },
      additionalProperties: false,
    },
  },
} as const;

interface Forwarder {
  call(toolName: string, args: unknown): Promise<unknown>;
}

/** Test seam: inject a fake forwarder to exercise listing + dispatch. */
export function buildServerForTesting(deps: { forwarder: Forwarder }) {
  return {
    listToolNames(): string[] {
      return Object.keys(TOOLS);
    },
    async callTool(name: string, args: unknown): Promise<any> {
      return deps.forwarder.call(name, args ?? {});
    },
  };
}

export async function runMcp(): Promise<void> {
  const token = process.env.ATO_MCP_TOKEN;
  if (!token) {
    process.stderr.write(
      "ato-mcp: ATO_MCP_TOKEN is not set.\n" +
        "Get your token and config snippet at https://ato-mcp.com.au/onboard\n",
    );
    process.exit(1);
  }
  const endpoint = process.env.ATO_MCP_API ?? DEFAULT_API;
  const forwarder = new RemoteToolForwarder(endpoint, token);

  const server = new Server(
    { name: "ato-mcp", version: packageVersion() },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Object.entries(TOOLS).map(([name, def]) => ({
      name,
      description: def.description,
      inputSchema: def.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      const result = await forwarder.call(name, args ?? {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({ kind: "error", message }, null, 2) }],
      };
    }
  });

  // Fire-and-forget connection ping so the web onboarding page can show "connected". Failures (network or transient backend) are intentionally ignored.
  void forwarder.call("usage_event", { event_type: "mcp_started" }).catch(() => {});

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
