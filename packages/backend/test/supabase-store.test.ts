import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseStore } from "../src/supabase-store.js";

// ---------------------------------------------------------------------------
// Build a spy-able mock Supabase client that records which RPCs were called.
// ---------------------------------------------------------------------------

interface RpcCall { name: string; params: Record<string, unknown> }

function makeMockClient(overrides?: {
  rpcResult?: unknown;
  docsCount?: number;
  chunksCount?: number;
}) {
  const rpcCalls: RpcCall[] = [];

  const defaults = {
    docsCount: overrides?.docsCount ?? 42,
    chunksCount: overrides?.chunksCount ?? 420,
    // Use explicit check so callers can pass null to simulate missing rows
    rpcResult: "rpcResult" in (overrides ?? {}) ? overrides!.rpcResult : [],
  };

  const rpc = vi.fn((name: string, params: Record<string, unknown>) => {
    rpcCalls.push({ name, params });
    return Promise.resolve({ data: defaults.rpcResult, error: null });
  });

  // Helper: a select() chain that resolves with a { count, error } shaped value
  function makeCountSelect(count: number) {
    return {
      select: vi.fn(() => ({ count, error: null })),
      // Allow .select("*", { count: "exact", head: true }) to be awaited directly
      then: (resolve: (v: { count: number; error: null }) => unknown) =>
        Promise.resolve(resolve({ count, error: null })),
    };
  }

  const fromSpy = vi.fn((table: string) => {
    if (table === "docs")   return makeCountSelect(defaults.docsCount);
    if (table === "chunks") return makeCountSelect(defaults.chunksCount);
    return makeCountSelect(0);
  });

  const client = {
    rpc,
    from: fromSpy,
  } as unknown as SupabaseClient;

  return { client, rpcCalls, rpc, fromSpy };
}

// ---------------------------------------------------------------------------
// stats()
// ---------------------------------------------------------------------------
describe("SupabaseStore.stats()", () => {
  it("returns installed=true with doc/chunk counts from the 'docs' and 'chunks' tables", async () => {
    const { client } = makeMockClient({ docsCount: 99, chunksCount: 999 });
    const store = new SupabaseStore(client);
    const result = await store.stats();
    expect(result.installed).toBe(true);
    expect(result.schema_version).toBe("0.3.0");
    expect(result.docs).toBe(99);
    expect(result.chunks).toBe(999);
    expect(result.staleness_days).toBeNull();
  });

  it("returns canned stats from mock client when no credentials supplied", async () => {
    // SupabaseStore constructed without explicit client; falls through to makeServiceClient()
    // which returns the mock (MOCK_SUPABASE is not set but SUPABASE_URL is missing in test env)
    const store = new SupabaseStore();
    const result = await store.stats();
    expect(result.installed).toBe(true);
    expect(typeof result.docs).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// keywordSearch()
// ---------------------------------------------------------------------------
describe("SupabaseStore.keywordSearch()", () => {
  it("calls ato_keyword_search RPC with correct params", async () => {
    const { client, rpcCalls } = makeMockClient({ rpcResult: [] });
    const store = new SupabaseStore(client);
    await store.keywordSearch("small business deduction", 10);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]!.name).toBe("ato_keyword_search");
    expect(rpcCalls[0]!.params).toMatchObject({ q: "small business deduction", k: 10, pit_date: null });
  });

  it("passes pit_date when provided", async () => {
    const { client, rpcCalls } = makeMockClient({ rpcResult: [] });
    const store = new SupabaseStore(client);
    await store.keywordSearch("fringe benefits", 5, "2025-06-30");
    expect(rpcCalls[0]!.params).toMatchObject({ pit_date: "2025-06-30" });
  });

  it("returns empty array when RPC returns null data", async () => {
    const { client } = makeMockClient({ rpcResult: null });
    const store = new SupabaseStore(client);
    const hits = await store.keywordSearch("anything", 5);
    expect(hits).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// vectorSearch()
// ---------------------------------------------------------------------------
describe("SupabaseStore.vectorSearch()", () => {
  it("calls ato_vector_search RPC with embedding array", async () => {
    const { client, rpcCalls } = makeMockClient({ rpcResult: [] });
    const store = new SupabaseStore(client);
    const vec = new Float32Array(384);
    vec[0] = 0.5;
    await store.vectorSearch(vec, 8);
    expect(rpcCalls[0]!.name).toBe("ato_vector_search");
    const params = rpcCalls[0]!.params as { q_embedding: number[] };
    expect(params.q_embedding).toHaveLength(384);
    expect(params.q_embedding[0]).toBeCloseTo(0.5);
  });
});

// ---------------------------------------------------------------------------
// getChunks()
// ---------------------------------------------------------------------------
describe("SupabaseStore.getChunks()", () => {
  it("calls ato_get_chunks RPC with chunk_ids and neighbours", async () => {
    const { client, rpcCalls } = makeMockClient({ rpcResult: [] });
    const store = new SupabaseStore(client);
    await store.getChunks(["doc1#0", "doc1#1"], 2);
    expect(rpcCalls[0]!.name).toBe("ato_get_chunks");
    expect(rpcCalls[0]!.params).toMatchObject({
      chunk_ids: ["doc1#0", "doc1#1"],
      neighbours: 2,
      pit_date: null,
    });
  });
});

// ---------------------------------------------------------------------------
// getDoc()
// ---------------------------------------------------------------------------
describe("SupabaseStore.getDoc()", () => {
  it("calls ato_get_doc RPC with doc_id", async () => {
    const docResult = { doc: { doc_id: "ato:test" }, cleaned_html: null, anchors: [] };
    const { client, rpcCalls } = makeMockClient({ rpcResult: docResult });
    const store = new SupabaseStore(client);
    const result = await store.getDoc("ato:test");
    expect(rpcCalls[0]!.name).toBe("ato_get_doc");
    expect(rpcCalls[0]!.params).toMatchObject({ doc_id: "ato:test" });
    expect(result).toEqual(docResult);
  });

  it("returns null when RPC returns null data", async () => {
    const { client } = makeMockClient({ rpcResult: null });
    const store = new SupabaseStore(client);
    const result = await store.getDoc("nonexistent");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getDocAnchors()
// ---------------------------------------------------------------------------
describe("SupabaseStore.getDocAnchors()", () => {
  it("calls ato_get_doc_anchors RPC and normalises empty arrays", async () => {
    const { client, rpcCalls } = makeMockClient({ rpcResult: null });
    const store = new SupabaseStore(client);
    const result = await store.getDocAnchors("ato:test");
    expect(rpcCalls[0]!.name).toBe("ato_get_doc_anchors");
    expect(result).toEqual({ anchors: [], inbound: [], outbound: [] });
  });

  it("returns populated anchors from RPC data", async () => {
    const graph = {
      anchors: [{ anchor_id: "a1", doc_id: "d1", anchor_name: "s1", chunk_id: "d1#0" }],
      inbound: [],
      outbound: [],
    };
    const { client } = makeMockClient({ rpcResult: graph });
    const store = new SupabaseStore(client);
    const result = await store.getDocAnchors("d1");
    expect(result.anchors).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getDefinition()
// ---------------------------------------------------------------------------
describe("SupabaseStore.getDefinition()", () => {
  it("calls ato_get_definition RPC with term and pit_date", async () => {
    const { client, rpcCalls } = makeMockClient({ rpcResult: [] });
    const store = new SupabaseStore(client);
    await store.getDefinition("resident", "2025-06-30");
    expect(rpcCalls[0]!.name).toBe("ato_get_definition");
    expect(rpcCalls[0]!.params).toMatchObject({ p_term: "resident", pit_date: "2025-06-30" });
  });

  it("passes null pit_date when not provided", async () => {
    const { client, rpcCalls } = makeMockClient({ rpcResult: [] });
    const store = new SupabaseStore(client);
    await store.getDefinition("income", null);
    expect(rpcCalls[0]!.params).toMatchObject({ pit_date: null });
  });
});

// ---------------------------------------------------------------------------
// getThreshold()
// ---------------------------------------------------------------------------
describe("SupabaseStore.getThreshold()", () => {
  it("calls ato_get_threshold RPC with name and pit_date", async () => {
    const row = { name: "hecs_repayment_threshold", value: 54435, unit: "AUD",
                  effective_from: "2025-07-01", effective_to: null,
                  source_doc_id: null, source_anchor: null };
    const { client, rpcCalls } = makeMockClient({ rpcResult: row });
    const store = new SupabaseStore(client);
    const result = await store.getThreshold("hecs_repayment_threshold", "2025-10-01");
    expect(rpcCalls[0]!.name).toBe("ato_get_threshold");
    expect(rpcCalls[0]!.params).toMatchObject({ p_name: "hecs_repayment_threshold", pit_date: "2025-10-01" });
    expect(result).toEqual(row);
  });

  it("returns null when RPC returns null data", async () => {
    const { client } = makeMockClient({ rpcResult: null });
    const store = new SupabaseStore(client);
    const result = await store.getThreshold("unknown", null);
    expect(result).toBeNull();
  });

  // Regression (found live 2026-06-06): ato_get_threshold is a SETOF RPC, so
  // PostgREST returns an ARRAY. The store must unwrap to the single row — the
  // un-unwrapped array reached depreciation_helper in prod and made
  // `threshold.value` undefined.
  it("unwraps the SETOF array shape PostgREST actually returns", async () => {
    const row = { name: "instant_asset_write_off", value: 20000, unit: "AUD",
                  effective_from: "2023-07-01", effective_to: null,
                  source_doc_id: null, source_anchor: null };
    const { client } = makeMockClient({ rpcResult: [row] });
    const store = new SupabaseStore(client);
    const result = await store.getThreshold("instant_asset_write_off", "2026-06-30");
    expect(Array.isArray(result)).toBe(false);
    expect(result).toEqual(row);
    expect(result!.value).toBe(20000);
  });

  it("returns null for an empty SETOF array (threshold not found)", async () => {
    const { client } = makeMockClient({ rpcResult: [] });
    const store = new SupabaseStore(client);
    const result = await store.getThreshold("nonexistent", null);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// close()
// ---------------------------------------------------------------------------
describe("SupabaseStore.close()", () => {
  it("is a no-op and does not throw", () => {
    const { client } = makeMockClient();
    const store = new SupabaseStore(client);
    expect(() => store.close()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// vector RPC selection
// ---------------------------------------------------------------------------
describe("SupabaseStore vector RPC selection", () => {
  function spyClient() {
    const calls: string[] = [];
    const client = {
      rpc: (name: string) => { calls.push(name); return Promise.resolve({ data: [], error: null }); },
      from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }),
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    return { client, calls };
  }

  it("uses ato_vector_search", async () => {
    const { client, calls } = spyClient();
    await new SupabaseStore(client).vectorSearch(new Float32Array(3), 5);
    expect(calls).toContain("ato_vector_search");
  });
});
