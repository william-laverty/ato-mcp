import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { authMiddleware } from "../api/_middleware.js";

// ---------------------------------------------------------------------------
// Helper to create a minimal Request with an Authorization header
// ---------------------------------------------------------------------------
function makeRequest(authorization?: string): Request {
  return new Request("https://api.ato-mcp.com.au/v1/stats", {
    method: "POST",
    headers: authorization ? { authorization } : {},
    body: "{}",
  });
}

describe("authMiddleware (mock mode)", () => {
  beforeEach(() => {
    // Force mock mode so we don't need a real Supabase instance
    process.env["MOCK_SUPABASE"] = "1";
  });

  afterEach(() => {
    delete process.env["MOCK_SUPABASE"];
    delete process.env["SUPABASE_URL"];
  });

  it("returns 401 when Authorization header is missing", async () => {
    const result = await authMiddleware(makeRequest());
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    const body = await (result as Response).json() as { message: string };
    expect(body.message).toBe("missing_token");
  });

  it("returns 401 when token is empty string", async () => {
    const result = await authMiddleware(makeRequest("Bearer "));
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it("accepts atompro_v1_ prefixed token and returns u_mock user_id", async () => {
    const result = await authMiddleware(makeRequest("Bearer atompro_v1_testtoken"));
    expect(result).not.toBeInstanceOf(Response);
    const ctx = result as { user_id: string };
    expect(ctx.user_id).toBe("u_mock");
  });

  it("rejects non-prefixed token in mock mode", async () => {
    const result = await authMiddleware(makeRequest("Bearer some_random_token"));
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    const body = await (result as Response).json() as { message: string };
    expect(body.message).toBe("invalid_token");
  });

  it("also triggers mock mode when SUPABASE_URL is absent", async () => {
    delete process.env["MOCK_SUPABASE"];
    // SUPABASE_URL is not set in test env → should still use mock path
    const result = await authMiddleware(makeRequest("Bearer atompro_v1_testtoken"));
    expect(result).not.toBeInstanceOf(Response);
    const ctx = result as { user_id: string };
    expect(ctx.user_id).toBe("u_mock");
  });
});

describe("authMiddleware rate limiting", () => {
  beforeEach(() => {
    process.env["MOCK_SUPABASE"] = "1";
    vi.useFakeTimers();
  });

  afterEach(() => {
    delete process.env["MOCK_SUPABASE"];
    vi.useRealTimers();
  });

  it("allows requests within the per-minute limit", async () => {
    // 5 requests should all succeed
    for (let i = 0; i < 5; i++) {
      const result = await authMiddleware(makeRequest("Bearer atompro_v1_ratelimituser"));
      expect(result).not.toBeInstanceOf(Response);
    }
  });
});
