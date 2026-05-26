// Auth middleware for Vercel functions
//
// Validates the Bearer token against the bearer_tokens table (sha256 lookup).
// In mock mode (MOCK_SUPABASE=1 or no credentials), any token beginning with
// "atompro_v1_" is accepted as user "u_mock" — suitable for unit testing.
//
// Rate limiting: in-memory Map<userId, { count, resetAt }> keyed by one-minute
// windows. TODO: swap for Vercel KV once credentials are available so the limit
// persists across function instances.

import { createHash } from "node:crypto";
import { makeServiceClient } from "../src/supabase.js";

// ---------------------------------------------------------------------------
// In-memory rate limit (dev/test fallback; replace with KV in production)
// ---------------------------------------------------------------------------
interface RateBucket { count: number; resetAt: number }
const RATE: Map<string, RateBucket> = new Map();
const RATE_LIMIT_PER_MINUTE = 60;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowKey = `${userId}:${Math.floor(now / 60_000)}`;
  const bucket = RATE.get(windowKey);
  if (!bucket) {
    RATE.set(windowKey, { count: 1, resetAt: now + 70_000 });
    return true; // under limit
  }
  if (bucket.count >= RATE_LIMIT_PER_MINUTE) return false;
  bucket.count += 1;
  return true;
}

// Periodic clean-up so the Map doesn't grow unboundedly in long-lived instances
function pruneExpiredBuckets(): void {
  const now = Date.now();
  for (const [key, bucket] of RATE.entries()) {
    if (now > bucket.resetAt) RATE.delete(key);
  }
}

// ---------------------------------------------------------------------------
// authMiddleware
// ---------------------------------------------------------------------------
export interface AuthContext {
  user_id: string;
}

export async function authMiddleware(
  req: Request,
): Promise<AuthContext | Response> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    return new Response(JSON.stringify({ kind: "error", message: "missing_token" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  // Mock mode: accept any token prefixed "atompro_v1_" as test user
  if (
    process.env["MOCK_SUPABASE"] === "1" ||
    !process.env["SUPABASE_URL"]
  ) {
    if (token.startsWith("atompro_v1_")) {
      return { user_id: "u_mock" };
    }
    return new Response(JSON.stringify({ kind: "error", message: "invalid_token" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  // Production: sha256 hash lookup
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const svc = makeServiceClient();
  const { data, error } = await svc
    .from("bearer_tokens")
    .select("user_id, revoked_at")
    .eq("token_hash", tokenHash)
    .single();

  if (error || !data) {
    return new Response(JSON.stringify({ kind: "error", message: "invalid_token" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const row = data as { user_id: string; revoked_at: string | null };
  if (row.revoked_at) {
    return new Response(JSON.stringify({ kind: "error", message: "revoked_token" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  pruneExpiredBuckets();
  if (!checkRateLimit(row.user_id)) {
    return new Response(JSON.stringify({ kind: "error", message: "rate_limited" }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
  }

  return { user_id: row.user_id };
}
