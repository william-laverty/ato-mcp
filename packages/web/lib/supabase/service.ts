import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockServiceClient(): SupabaseClient {
  return {
    auth: {
      admin: {
        deleteUser: async (_id: string) => ({ data: null, error: null }),
      },
    },
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: null }),
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
      upsert: async () => ({ data: null, error: null }),
      insert: async () => ({ data: null, error: null }),
      update: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      delete: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
    }),
  } as unknown as SupabaseClient;
}

export function makeServiceClient(): SupabaseClient {
  if (
    process.env.MOCK_SUPABASE === "1" ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return mockServiceClient();
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
