// GET /api/onboard/poll?code=<8-hex-char-code>
//
// Polled by the CLI onboard command after opening the browser. Returns
// { ready: true, config: { mode, api_endpoint, bearer_token, facts } }
// once the user has completed the web onboarding flow and the session is ready.
//
// Short-lived sessions are stored in the onboard_sessions table and expire
// after 15 minutes (enforced by the expires_at column + DB constraint).

import { makeServiceClient } from "../../src/supabase.js";

interface OnboardSession {
  code: string;
  user_id: string | null;
  mode: string | null;
  bearer_token: string | null;
  facts_snapshot: unknown;
  completed_at: string | null;
  expires_at: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ kind: "error", message: "method_not_allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code || !/^[0-9a-f]{8}$/.test(code)) {
    return new Response(JSON.stringify({ kind: "error", message: "invalid_code" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const svc = makeServiceClient();
  const { data, error } = await svc
    .from("onboard_sessions")
    .select("*")
    .eq("code", code)
    .single();

  if (error || !data) {
    return Response.json({ ready: false });
  }

  const session = data as OnboardSession;

  // Expired session
  if (new Date(session.expires_at) < new Date()) {
    return Response.json({ ready: false, expired: true });
  }

  // Not yet completed
  if (!session.completed_at || !session.bearer_token) {
    return Response.json({ ready: false });
  }

  // Completed — return config and delete the session (bearer_token is one-time)
  await svc.from("onboard_sessions").delete().eq("code", code);

  const apiEndpoint =
    process.env["ATO_PRO_API_ENDPOINT"] ?? "https://api.ato-mcp.com.au";

  return Response.json({
    ready: true,
    config: {
      mode: session.mode ?? "hosted",
      api_endpoint: apiEndpoint,
      bearer_token: session.bearer_token,
      facts: session.facts_snapshot ?? null,
    },
  });
}
