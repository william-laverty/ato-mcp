import { adapt } from "./_adapter.js";

import { authMiddleware } from "./_middleware.js";
import { getDefinition } from "@ato-mcp/shared/tools/get_definition";
import { GetDefinitionInputSchema } from "@ato-mcp/shared";
import { SupabaseStore } from "../src/supabase-store.js";

const store = new SupabaseStore();

export async function handler(req: Request): Promise<Response> {
  const auth = await authMiddleware(req);
  if (auth instanceof Response) return auth;
  try {
    const body = await req.json() as unknown;
    const args = GetDefinitionInputSchema.parse(body);
    const result = await getDefinition({ store }, args);
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
