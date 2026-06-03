import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildServerForTesting } from "../../src/server.js";
import { makeStore } from "../helpers/make-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(__dirname, "..", "fixtures", "seed.sql");

const stubEmbedder = { embed: async () => new Float32Array(384) };

describe("MCP tool registration", () => {
  let server: ReturnType<typeof buildServerForTesting>;

  beforeAll(() => {
    const store = makeStore(SEED);
    server = buildServerForTesting({ store, embedder: stubEmbedder });
  });

  afterAll(() => {
    server.close();
  });

  it("exposes all v0.2 tools plus get_user_facts, deduction_discovery, depreciation_helper and bas_prep_checklist", () => {
    expect(server.listToolNames().sort()).toEqual(["bas_prep_checklist", "deduction_discovery", "depreciation_helper", "fetch", "get_chunks", "get_definition", "get_doc", "get_doc_anchors", "get_threshold", "get_user_facts", "search", "stats"]);
  });

  it("calls the stats tool", async () => {
    const out = await server.callTool("stats", {});
    expect(out.installed).toBe(true);
    expect(out.docs).toBe(5);
  });

  it("calls the search tool", async () => {
    const out = await server.callTool("search", { query: "uniform", k: 3, mode: "keyword", include_old: false });
    expect(out.hits.length).toBeGreaterThan(0);
  });
});
