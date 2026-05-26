import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Mock client — used when MOCK_SUPABASE=1 or credentials are absent.
// Returns canned empty/null responses for unit tests.
// The mock needs to satisfy SupabaseClient's .rpc() and .from() call patterns.
// ---------------------------------------------------------------------------

const MOCK_RPC_DATA: Record<string, unknown> = {
  ato_keyword_search: [],
  ato_vector_search: [],
  ato_get_chunks: [],
  ato_get_doc: null,
  ato_get_doc_anchors: { anchors: [], inbound: [], outbound: [] },
  ato_get_definition: [],
  ato_get_threshold: null,
};

function mockSupabaseClient(): SupabaseClient {
  // rpc returns a Promise<{ data, error }> — Supabase's PostgrestFilterBuilder
  // is thenable, so we return a plain Promise which is awaitable the same way.
  const rpc = (name: string, _params?: unknown) =>
    Promise.resolve({ data: MOCK_RPC_DATA[name] ?? null, error: null });

  // from() returns a chainable builder; the mock supports the patterns used
  // in SupabaseStore and the handler functions.
  const from = (_table: string) => {
    const singleResult = { data: null, error: null };
    const countResult = { count: 0, error: null, data: null };

    const eqChain = {
      single: () => Promise.resolve(singleResult),
      maybeSingle: () => Promise.resolve(singleResult),
      limit: (_n: number) => ({
        single: () => Promise.resolve(singleResult),
      }),
    };

    return {
      select: (_cols?: string, _opts?: unknown) => ({
        ...countResult,
        eq: (_col: string, _val: unknown) => eqChain,
      }),
      upsert: (_data: unknown) => Promise.resolve({ data: null, error: null }),
      insert: (_data: unknown) => Promise.resolve({ data: null, error: null }),
      update: (_data: unknown) => ({
        eq: (_col: string, _val: unknown) => ({
          single: () => Promise.resolve(singleResult),
        }),
      }),
      delete: () => ({
        eq: (_col: string, _val: unknown) => ({
          single: () => Promise.resolve(singleResult),
        }),
      }),
    };
  };

  return { rpc, from, auth: { getSession: async () => ({ data: { session: null }, error: null }) } } as unknown as SupabaseClient;
}

// ---------------------------------------------------------------------------
// Exported factory — returns real or mock client based on environment
// ---------------------------------------------------------------------------

export function makeServiceClient(): SupabaseClient {
  if (
    process.env["MOCK_SUPABASE"] === "1" ||
    !process.env["SUPABASE_URL"] ||
    !process.env["SUPABASE_SECRET_KEY"]
  ) {
    return mockSupabaseClient();
  }
  return createClient(
    process.env["SUPABASE_URL"],
    process.env["SUPABASE_SECRET_KEY"],
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
