import { adapt } from "./_adapter.js";

import { authMiddleware } from "./_middleware.js";
import { search } from "@ato-pro/shared/tools/search";
import { SearchInputSchema } from "@ato-pro/shared";
import { SupabaseStore } from "../src/supabase-store.js";
import { WasmEmbedder } from "../src/wasm-embedder.js";

const store = new SupabaseStore();
let embedder: WasmEmbedder | null = null;

async function handler(req: Request): Promise<Response> {
  const auth = await authMiddleware(req);
  if (auth instanceof Response) return auth;
  try {
    const body = await req.json() as unknown;
    const args = SearchInputSchema.parse(body);
    embedder ??= await WasmEmbedder.load();
    const result = await search({ store, embedder }, args);
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
