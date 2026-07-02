import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RemoteToolForwarder } from "../../src/lib/remote-tools.js";

const originalFetch = globalThis.fetch;

describe("RemoteToolForwarder", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("posts to {endpoint}/{toolName} with bearer + JSON body", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ installed: true, docs: 5 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const f = new RemoteToolForwarder("https://api.example.com", "tok123");
    const result = await f.call("stats", {});

    expect(result).toEqual({ installed: true, docs: 5 });
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("https://api.example.com/stats");
    expect(call[1].method).toBe("POST");
    expect(call[1].headers["Authorization"]).toBe("Bearer tok123");
    expect(call[1].headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(call[1].body)).toEqual({});
  });

  it("strips trailing slash from endpoint", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("null", { status: 200 }),
    );
    const f = new RemoteToolForwarder("https://api.example.com/", "tok");
    await f.call("search", { query: "x" });
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("https://api.example.com/search");
  });

  it("returns null on 204 No Content", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );
    const f = new RemoteToolForwarder("https://api.example.com", "tok");
    const result = await f.call("usage_event", { event_type: "mcp_started" });
    expect(result).toBeNull();
  });

  it("throws with structured message on backend error response", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ kind: "error", message: "invalid_token" }), { status: 401 }),
    );
    const f = new RemoteToolForwarder("https://api.example.com", "bad");
    await expect(f.call("stats", {})).rejects.toThrow(/invalid_token/);
  });

  it("throws with HTTP status on non-JSON error body", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("internal error", { status: 500 }),
    );
    const f = new RemoteToolForwarder("https://api.example.com", "tok");
    await expect(f.call("stats", {})).rejects.toThrow(/HTTP 500/);
  });

  it("surfaces network failures as 'Backend unreachable'", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TypeError("fetch failed"));
    const f = new RemoteToolForwarder("https://api.example.com", "tok");
    await expect(f.call("stats", {})).rejects.toThrow(/Backend unreachable/);
  });

  it("401 carries token-recovery guidance", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ kind: "error", message: "invalid_token" }), { status: 401 }),
    );
    const f = new RemoteToolForwarder("https://api.example.com", "bad");
    await expect(f.call("stats", {})).rejects.toThrow(/ato-mcp\.com\.au\/account/);
  });

  it("429 tells the caller to retry", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ kind: "error", message: "rate_limited" }), { status: 429 }),
    );
    const f = new RemoteToolForwarder("https://api.example.com", "tok");
    await expect(f.call("stats", {})).rejects.toThrow(/rate limited.*retry/i);
  });

  it("collapses raw Zod issue arrays on 400 into readable messages", async () => {
    const zodBlob = JSON.stringify([
      { code: "invalid_type", expected: "string", received: "undefined", path: ["query"], message: "Required" },
      { code: "too_big", maximum: 50, path: ["k"], message: "Number must be less than or equal to 50" },
    ]);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ kind: "error", message: zodBlob }), { status: 400 }),
    );
    const f = new RemoteToolForwarder("https://api.example.com", "tok");
    await expect(f.call("search", {})).rejects.toThrow(
      /query: Required; k: Number must be less than or equal to 50/,
    );
  });

  it("passes already-readable 400 messages through untouched", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ kind: "error", message: "invalid_input — query: Required" }), {
        status: 400,
      }),
    );
    const f = new RemoteToolForwarder("https://api.example.com", "tok");
    await expect(f.call("search", {})).rejects.toThrow(/invalid_input — query: Required/);
  });
});
