export const runtime = 'edge';

import { authMiddleware } from "./_middleware.js";
import { getUserFacts } from "@ato-pro/shared/tools/get_user_facts";
import { UserFactsSchema } from "@ato-pro/shared";
import type { UserFacts } from "@ato-pro/shared";
import { makeServiceClient } from "../src/supabase.js";

export default async function handler(req: Request): Promise<Response> {
  const auth = await authMiddleware(req);
  if (auth instanceof Response) return auth;
  try {
    const svc = makeServiceClient();
    const { data, error } = await svc
      .from("user_facts")
      .select("facts")
      .eq("user_id", auth.user_id)
      .single();

    if (error || !data) {
      // No facts yet — getUserFacts will throw with onboard message
      const result = await getUserFacts(
        { facts: null, fetchedFrom: "hosted_api", mode: "hosted" },
        {},
      );
      return Response.json(result);
    }

    const row = data as { facts: unknown };
    const parsed = UserFactsSchema.safeParse(row.facts);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ kind: "error", message: "stored facts failed validation" }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }
    const result = await getUserFacts(
      { facts: parsed.data as UserFacts, fetchedFrom: "hosted_api", mode: "hosted" },
      {},
    );
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ kind: "error", message: msg }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}
