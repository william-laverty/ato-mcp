import { adapt } from "./_adapter.js";

// POST /v1/usage_event — Privacy-safe analytics ingest.
// Records one of the allowed event types; does NOT log query text or results.

import { z } from "zod";
import { authMiddleware } from "./_middleware.js";
import { makeServiceClient } from "../src/supabase.js";

const UsageEventSchema = z.object({
  event_type: z.enum([
    "mcp_started",
    "heartbeat",
    "update_check",
    "update_applied",
    "facts_pulled",
  ]),
  mode: z.enum(["local", "hosted"]),
});

async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ kind: "error", message: "method_not_allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  const auth = await authMiddleware(req);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json() as unknown;
    const { event_type, mode } = UsageEventSchema.parse(body);
    const svc = makeServiceClient();

    // Insert usage event
    const { error: evErr } = await svc.from("usage_events").insert({
      user_id: auth.user_id,
      event_type,
      mode,
      event_time: new Date().toISOString(),
    });
    if (evErr) throw new Error((evErr as { message: string }).message);

    // On first mcp_started, upsert mcp_connections row
    if (event_type === "mcp_started") {
      await svc.from("mcp_connections").upsert({
        user_id: auth.user_id,
        last_seen_at: new Date().toISOString(),
      });
    }

    return new Response(null, { status: 204 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ kind: "error", message: msg }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}

export default adapt(handler);
