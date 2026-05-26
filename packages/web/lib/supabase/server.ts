import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockServerClient(): SupabaseClient {
  return {
    auth: {
      getSession: async () => ({
        data: {
          session: {
            user: { id: "u_mock", email: "mock@example.com" },
            access_token: "mock_token",
            refresh_token: "mock_refresh",
            expires_in: 3600,
            token_type: "bearer",
          },
        },
        error: null,
      }),
      getUser: async () => ({
        data: { user: { id: "u_mock", email: "mock@example.com" } },
        error: null,
      }),
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
    }),
  } as unknown as SupabaseClient;
}

export async function makeServerClient() {
  if (
    process.env.MOCK_SUPABASE === "1" ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  ) {
    return mockServerClient();
  }
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server component — cookies may not be settable
          }
        },
      },
    },
  );
}
