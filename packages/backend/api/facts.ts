import { adapt } from "./_adapter.js";

// PUT /v1/facts — Web app endpoint for saving/updating user facts.
// Called from the Next.js onboarding flow (packages/web) after the user
// completes the FactsWizard. Uses Bearer token auth (same as all other endpoints).

import { authMiddleware } from "./_middleware.js";
import { UserFactsSchema } from "@ato-pro/shared";
import { makeServiceClient } from "../src/supabase.js";

async function handler(req: Request): Promise<Response> {
  if (req.method !== "PUT" && req.method !== "POST") {
    return new Response(JSON.stringify({ kind: "error", message: "method_not_allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  const auth = await authMiddleware(req);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json() as unknown;
    const parsed = UserFactsSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ kind: "error", message: "validation_failed", issues: parsed.error.flatten() }),
        { status: 422, headers: { "content-type": "application/json" } },
      );
    }

    const svc = makeServiceClient();
    const { error } = await svc.from("user_facts").upsert({
      user_id: auth.user_id,
      facts: parsed.data,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error((error as { message: string }).message);
    }

    return new Response(null, { status: 204 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ kind: "error", message: msg }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export default adapt(handler);
