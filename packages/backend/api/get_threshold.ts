export const runtime = 'edge';

import { authMiddleware } from "./_middleware.js";
import { getThreshold } from "@ato-pro/shared/tools/get_threshold";
import { GetThresholdInputSchema } from "@ato-pro/shared";
import { SupabaseStore } from "../src/supabase-store.js";

const store = new SupabaseStore();

export default async function handler(req: Request): Promise<Response> {
  const auth = await authMiddleware(req);
  if (auth instanceof Response) return auth;
  try {
    const body = await req.json() as unknown;
    const args = GetThresholdInputSchema.parse(body);
    const result = await getThreshold({ store }, args);
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ kind: "error", message: msg }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}
