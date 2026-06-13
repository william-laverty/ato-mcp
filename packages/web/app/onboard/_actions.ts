"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { UserFactsSchema } from "@ato-mcp/shared";
import { makeServiceClient } from "@/lib/supabase/service";
import { makeServerClient } from "@/lib/supabase/server";

export async function saveFacts(userId: string, raw: unknown) {
  const parsed = UserFactsSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten() };
  }
  const service = makeServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (service.from("user_facts") as any).upsert({
    user_id: userId,
    facts: parsed.data,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: { formErrors: [(error as { message: string }).message], fieldErrors: {} } };
  revalidatePath("/account");
  return { success: true };
}

export async function issueToken(
  userId: string,
): Promise<{ token: string; tokenHash: string }> {
  const rawBytes = crypto.randomBytes(20);
  const token = rawBytes.toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const service = makeServiceClient();
  // Persist into bearer_tokens — the table the API auth middleware reads.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (service.from("bearer_tokens") as any).insert({
    user_id: userId,
    token_hash: tokenHash,
    created_at: new Date().toISOString(),
  });
  if (error) {
    throw new Error(`Failed to issue token: ${(error as { message: string }).message}`);
  }

  return { token, tokenHash };
}

export async function deleteAccount(userId: string) {
  const service = makeServiceClient();

  // Delete user_facts first (cascade handles in real Supabase, but be explicit)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (service.from("user_facts") as any).delete().eq("user_id", userId);

  // Delete users row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (service.from("users") as any).delete().eq("id", userId);

  redirect("/");
}

export async function getCurrentUserId(): Promise<string | null> {
  const client = await makeServerClient();
  const { data } = await client.auth.getSession();
  return data?.session?.user?.id ?? null;
}
