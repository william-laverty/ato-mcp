import { authMiddleware } from "../_middleware.js";
import { fetchUri } from "@ato-pro/shared/tools/fetch";
import { FetchInputSchema } from "@ato-pro/shared";

export default async function handler(req: Request): Promise<Response> {
  const auth = await authMiddleware(req);
  if (auth instanceof Response) return auth;
  try {
    const body = await req.json() as unknown;
    const args = FetchInputSchema.parse(body);
    const result = await fetchUri(args);
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ kind: "error", message: msg }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}
