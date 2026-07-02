import { redirect } from "next/navigation";
import { makeServerClient } from "@/lib/supabase/server";
import { makeServiceClient } from "@/lib/supabase/service";

type EmailOtpType =
  | "email"
  | "magiclink"
  | "recovery"
  | "invite"
  | "email_change";

interface VerifyParams {
  // PKCE magic-link flow (Supabase default since 2024)
  token_hash?: string;
  type?: string;
  // OAuth code-exchange flow (kept for compatibility)
  code?: string;
  // Error params Supabase appends on failure
  error?: string;
  error_description?: string;
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<VerifyParams>;
}) {
  const params = await searchParams;
  const client = await makeServerClient();

  // If Supabase appended an auth error (expired link, etc.), bail back to start
  // with a hint. /onboard reads ?error= and surfaces it to the user.
  if (params.error) {
    const reason = encodeURIComponent(params.error_description ?? params.error);
    redirect(`/onboard?error=${reason}`);
  }

  // Magic-link callback: exchange token_hash → session cookies.
  // The link Supabase sends has ?token_hash=...&type=magiclink (or =email).
  if (params.token_hash && params.type) {
    const { error } = await client.auth.verifyOtp({
      token_hash: params.token_hash,
      type: params.type as EmailOtpType,
    });
    if (error) {
      redirect(`/onboard?error=${encodeURIComponent(error.message)}`);
    }
  } else if (params.code) {
    // OAuth / PKCE code flow fallback
    const { error } = await client.auth.exchangeCodeForSession(params.code);
    if (error) {
      redirect(`/onboard?error=${encodeURIComponent(error.message)}`);
    }
  }

  const { data: sessionData } = await client.auth.getSession();
  const session = sessionData?.session;

  if (!session?.user) {
    // No session and no callback params — direct navigation.
    redirect("/onboard");
  }

  // Upsert the users row so user_facts FK targets exist before the next step.
  const user = session.user;
  const service = makeServiceClient();
  await service.from("users").upsert({
    id: user.id,
    email: user.email ?? "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  redirect("/onboard/facts");
}
