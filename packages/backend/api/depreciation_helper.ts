import { adapt } from "./_adapter.js";
import { authMiddleware } from "./_middleware.js";
import { depreciationHelper } from "@ato-mcp/shared/tools/depreciation_helper";
import { DepreciationHelperInputSchema, UserFactsSchema } from "@ato-mcp/shared";
import type { UserFacts } from "@ato-mcp/shared";
import { SupabaseStore } from "../src/supabase-store.js";
import { WasmEmbedder } from "../src/wasm-embedder.js";
import { makeServiceClient } from "../src/supabase.js";

const store = new SupabaseStore();
let embedder: WasmEmbedder | null = null;

export async function handler(req: Request): Promise<Response> {
  const auth = await authMiddleware(req);
  if (auth instanceof Response) return auth;
  try {
    const args = DepreciationHelperInputSchema.parse((await req.json()) as unknown);

    const svc = makeServiceClient();
    const { data } = await svc.from("user_facts").select("facts").eq("user_id", auth.user_id).single();
    let userFacts: UserFacts | null = null;
    if (data) {
      const parsed = UserFactsSchema.safeParse((data as { facts: unknown }).facts);
      if (parsed.success) userFacts = parsed.data as UserFacts;
    }

    embedder ??= await WasmEmbedder.load();
    const result = await depreciationHelper({ store, embedder, userFacts }, args);
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
