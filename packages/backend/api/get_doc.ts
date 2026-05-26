import { adapt } from "./_adapter.js";

import { authMiddleware } from "./_middleware.js";
import { getDoc } from "@ato-pro/shared/tools/get_doc";
import { GetDocInputSchema } from "@ato-pro/shared";
import { SupabaseStore } from "../src/supabase-store.js";

const store = new SupabaseStore();

async function handler(req: Request): Promise<Response> {
  const auth = await authMiddleware(req);
  if (auth instanceof Response) return auth;
  try {
    const body = await req.json() as unknown;
    const args = GetDocInputSchema.parse(body);
    const result = await getDoc({ store }, args);
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ kind: "error", message: msg }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}

export default adapt(handler);
