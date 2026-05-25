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
  UserFactsSchema,
} from "@ato-pro/shared";
import type { Store, Embedder, UserFacts } from "@ato-pro/shared";
import { SqliteStore } from "./store/sqlite.js";
import { RemoteStore } from "./store/remote.js";
import { OnnxEmbedder } from "./embed/onnx.js";
import { stats } from "@ato-pro/shared/tools/stats";
import { search } from "@ato-pro/shared/tools/search";
import { getChunks } from "@ato-pro/shared/tools/get_chunks";
import { fetchUri } from "@ato-pro/shared/tools/fetch";
import { getDefinition } from "@ato-pro/shared/tools/get_definition";
import { getDoc } from "@ato-pro/shared/tools/get_doc";
import { getDocAnchors } from "@ato-pro/shared/tools/get_doc_anchors";
import { getThreshold } from "@ato-pro/shared/tools/get_threshold";
import { getUserFacts } from "@ato-pro/shared/tools/get_user_facts";
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
      `[ato-pro] Warning: facts in config.json failed validation: ${parsed.error.message}\n`,
    );
    return null;
  }
  return parsed.data;
}

export async function runMcp(): Promise<void> {
  const cfg = readConfig();
  let store: Store | null;
  const mode: "local" | "hosted" = cfg.mode === "hosted" ? "hosted" : "local";

  if (cfg.mode === "hosted") {
    if (!cfg.api_endpoint || !cfg.bearer_token) {
      throw new Error("Hosted mode configured but api_endpoint/bearer_token missing in config");
    }
    store = new RemoteStore(cfg.api_endpoint, cfg.bearer_token);
    // TODO(hosted): fetch facts from https://api.ato-mcp.com/v1/facts once at startup
    // and cache for the session once the hosted backend exists.
  } else {
    const dbPath = corpusPath();
    store = fs.existsSync(dbPath) ? new SqliteStore(dbPath) : null;
  }

  const facts = readFactsFromConfig(cfg);
  const embedder = await OnnxEmbedder.load();

  const server = new Server(
    { name: "ato-pro", version: "0.2.0" },
    {
      capabilities: { tools: {} },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Object.entries(TOOLS).map(([name, def]) => ({ name, description: def.description, inputSchema: def.inputSchema })),
  }));

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

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
