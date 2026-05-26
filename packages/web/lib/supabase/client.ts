"use client";

import { createBrowserClient } from "@supabase/ssr";

function mockClient(): ReturnType<typeof createBrowserClient> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    auth: {
      signInWithOtp: async () => ({ data: {}, error: null }),
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
      signOut: async () => ({ error: null }),
    },
    from: (_table: string) => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
      upsert: async () => ({ data: null, error: null }),
      insert: async () => ({ data: null, error: null }),
    }),
  } as unknown as ReturnType<typeof createBrowserClient>;
}

export function makeBrowserClient() {
  if (
    process.env.MOCK_SUPABASE === "1" ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  ) {
    return mockClient();
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
