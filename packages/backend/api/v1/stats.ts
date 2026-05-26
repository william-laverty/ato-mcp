import { authMiddleware } from "../_middleware.js";
import { stats } from "@ato-pro/shared/tools/stats";
import { SupabaseStore } from "../../src/supabase-store.js";

const store = new SupabaseStore();

export default async function handler(req: Request): Promise<Response> {
  const auth = await authMiddleware(req);
  if (auth instanceof Response) return auth;
  try {
    const result = await stats({ store });
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ kind: "error", message: msg }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
