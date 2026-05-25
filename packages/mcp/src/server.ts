import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs";
import {
  SearchInputSchema,
  GetChunksInputSchema,
  FetchInputSchema,
} from "@ato-pro/shared";
import { SqliteStore } from "./store/sqlite.js";
import type { Store } from "./store/types.js";
import { OnnxEmbedder } from "./embed/onnx.js";
import { stats } from "./tools/stats.js";
import { search } from "./tools/search.js";
import { getChunks } from "./tools/get_chunks.js";
import { fetchUri } from "./tools/fetch.js";
import { corpusPath } from "./lib/paths.js";

interface EmbedderLike { embed(text: string): Promise<Float32Array> }

interface ServerDeps {
  store: Store | null;
  embedder: EmbedderLike;
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
      },
      required: ["chunk_ids"],
      additionalProperties: false,
    },
  },
  fetch: {
    description:
      "Live-fetch a document by URI (v0.1 supports `ato:<path>`). Use when the corpus doesn't have the page.",
    inputSchema: {
      type: "object",
      properties: { uri: { type: "string", minLength: 1 } },
      required: ["uri"],
      additionalProperties: false,
    },
  },
} as const;

async function dispatch(name: string, args: unknown, deps: ServerDeps): Promise<unknown> {
  switch (name) {
    case "stats":
      return stats({ store: deps.store });
    case "search":
      return search(deps, SearchInputSchema.parse(args));
    case "get_chunks":
      return getChunks(deps, GetChunksInputSchema.parse(args));
    case "fetch":
      return fetchUri(FetchInputSchema.parse(args));
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

export async function runMcp(): Promise<void> {
  const dbPath = corpusPath();
  const store: Store | null = fs.existsSync(dbPath) ? new SqliteStore(dbPath) : null;
  const embedder = await OnnxEmbedder.load();

  const server = new Server(
    { name: "ato-pro", version: "0.1.0" },
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
      const result = await dispatch(name, args ?? {}, { store, embedder });
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
