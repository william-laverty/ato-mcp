// Integration tests for the Vercel function handlers using mock auth + mock store.
// Tool endpoints are served by the single dynamic dispatcher (api/[tool].ts);
// the non-tool endpoints (facts, usage_event) keep their own files.
//
// Each test:
//   1. Sets MOCK_SUPABASE=1 so the handlers use mock clients
//   2. Passes a valid "atompro_v1_" token
//   3. Drives the dispatcher with the tool name in the URL path
//   4. Asserts the response shape

import { describe, it, expect, beforeEach, afterEach } from "vitest";

const MOCK_TOKEN = "atompro_v1_testtoken";
const AUTH_HEADER = `Bearer ${MOCK_TOKEN}`;

function toolRequest(tool: string, body: unknown): Request {
  return new Request(`https://api.ato-mcp.com.au/api/${tool}`, {
    method: "POST",
    headers: { authorization: AUTH_HEADER, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function callTool(tool: string, body: unknown): Promise<Response> {
  const { handler } = await import("../api/[tool].js");
  return handler(toolRequest(tool, body));
}

beforeEach(() => {
  process.env["MOCK_SUPABASE"] = "1";
});

afterEach(() => {
  delete process.env["MOCK_SUPABASE"];
});

// ---------------------------------------------------------------------------
// Dispatcher fundamentals
// ---------------------------------------------------------------------------
describe("api/[tool] dispatcher", () => {
  it("returns 401 without auth", async () => {
    const { handler } = await import("../api/[tool].js");
    const req = new Request("https://api.ato-mcp.com.au/api/search", { method: "POST", body: "{}" });
    const resp = await handler(req);
    expect(resp.status).toBe(401);
  });

  it("returns 404 for an unknown tool", async () => {
    const resp = await callTool("not_a_tool", {});
    expect(resp.status).toBe(404);
    const body = await resp.json() as { kind: string; message: string };
    expect(body.kind).toBe("error");
    expect(body.message).toMatch(/unknown_tool/);
  });

  it("resolves the tool from the unprefixed public path too", async () => {
    const { handler } = await import("../api/[tool].js");
    const req = new Request("https://api.ato-mcp.com.au/stats", {
      method: "POST",
      headers: { authorization: AUTH_HEADER, "content-type": "application/json" },
      body: "{}",
    });
    const resp = await handler(req);
    expect(resp.status).toBe(200);
  });

  it("treats an empty body as {}", async () => {
    const { handler } = await import("../api/[tool].js");
    const req = new Request("https://api.ato-mcp.com.au/api/stats", {
      method: "POST",
      headers: { authorization: AUTH_HEADER },
    });
    const resp = await handler(req);
    expect(resp.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// stats
// ---------------------------------------------------------------------------
describe("tool: stats", () => {
  it("returns stats with installed=true", async () => {
    const resp = await callTool("stats", {});
    expect(resp.status).toBe(200);
    const body = await resp.json() as { installed: boolean; docs: number };
    expect(body.installed).toBe(true);
    expect(typeof body.docs).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------
describe("tool: search", () => {
  it("returns search result with hits array (keyword mode avoids the embedder)", async () => {
    const resp = await callTool("search", { query: "small business deduction", k: 5, mode: "keyword", include_old: false });
    expect(resp.status).toBe(200);
    const body = await resp.json() as { hits: unknown[]; query: string };
    expect(Array.isArray(body.hits)).toBe(true);
    expect(body.query).toBe("small business deduction");
  });

  it("returns 400 on invalid input", async () => {
    const resp = await callTool("search", { query: "" });
    expect(resp.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// get_chunks
// ---------------------------------------------------------------------------
describe("tool: get_chunks", () => {
  it("returns chunks object", async () => {
    const resp = await callTool("get_chunks", { chunk_ids: ["ato:test#0"], neighbours: 0 });
    expect(resp.status).toBe(200);
    const body = await resp.json() as { chunks: unknown[] };
    expect(Array.isArray(body.chunks)).toBe(true);
  });

  it("returns 400 when chunk_ids is empty", async () => {
    const resp = await callTool("get_chunks", { chunk_ids: [] });
    expect(resp.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// fetch
// ---------------------------------------------------------------------------
describe("tool: fetch", () => {
  it("returns 400 for an unsupported scheme without touching the network", async () => {
    const resp = await callTool("fetch", { uri: "bogus:not-a-real-scheme" });
    expect(resp.status).toBe(400);
    const body = await resp.json() as { kind: string };
    expect(body.kind).toBe("error");
  });
});

// ---------------------------------------------------------------------------
// get_definition
// ---------------------------------------------------------------------------
describe("tool: get_definition", () => {
  it("falls back to ordinary meaning when no statutory match (mock store is empty)", async () => {
    const resp = await callTool("get_definition", { term: "resident", jurisdiction: "AU" });
    expect(resp.status).toBe(200);
    const body = await resp.json() as { term: string; kind: string };
    expect(body.term).toBe("resident");
    expect(["statutory", "ordinary"]).toContain(body.kind);
  });

  it("returns 400 on missing term", async () => {
    const resp = await callTool("get_definition", {});
    expect(resp.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// get_threshold — regression guard for the SETOF unwrap (found live 2026-06-06)
// ---------------------------------------------------------------------------
describe("tool: get_threshold", () => {
  it("returns a structured not-found error when the mock SETOF is empty", async () => {
    const resp = await callTool("get_threshold", { name: "instant_asset_write_off" });
    expect(resp.status).toBe(400);
    const body = await resp.json() as { kind: string; message: string };
    expect(body.kind).toBe("error");
    expect(body.message).toMatch(/Threshold not found/);
  });
});

// ---------------------------------------------------------------------------
// get_doc / get_doc_anchors
// ---------------------------------------------------------------------------
describe("tool: get_doc", () => {
  it("returns 400 when doc not found (mock returns null)", async () => {
    const resp = await callTool("get_doc", { doc_id: "ato:some-doc" });
    expect(resp.status).toBe(400);
  });
});

describe("tool: get_doc_anchors", () => {
  it("returns an empty anchor graph from the mock", async () => {
    const resp = await callTool("get_doc_anchors", { doc_id: "ato:some-doc" });
    expect(resp.status).toBe(200);
    const body = await resp.json() as { anchors: unknown[]; inbound: unknown[]; outbound: unknown[] };
    expect(Array.isArray(body.anchors)).toBe(true);
    expect(Array.isArray(body.inbound)).toBe(true);
    expect(Array.isArray(body.outbound)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// get_user_facts + the four workflow tools — the mock user_facts row is null,
// so all of these exercise the actionable onboard-error path end-to-end.
// ---------------------------------------------------------------------------
describe("tool: get_user_facts", () => {
  it("returns the onboard error when the user has no facts", async () => {
    const resp = await callTool("get_user_facts", {});
    expect(resp.status).toBe(400);
    const body = await resp.json() as { kind: string; message: string };
    expect(body.kind).toBe("error");
    expect(body.message).toMatch(/onboard/i);
  });
});

for (const tool of ["deduction_discovery", "depreciation_helper", "bas_prep_checklist", "audit_risk_check"] as const) {
  describe(`tool: ${tool}`, () => {
    it("returns a structured onboard error when the user has no facts", async () => {
      const args = tool === "depreciation_helper"
        ? { asset_cost: 1000, acquisition_date: "2025-07-01" }
        : tool === "audit_risk_check"
          ? { income: 90000 }
          : {};
      const resp = await callTool(tool, args);
      expect(resp.status).toBe(400);
      const body = await resp.json() as { kind: string; message: string };
      expect(body.kind).toBe("error");
      expect(body.message).toMatch(/onboard/i);
    });

    it("returns 401 without auth", async () => {
      const { handler } = await import("../api/[tool].js");
      const req = new Request(`https://api.ato-mcp.com.au/api/${tool}`, { method: "POST", body: "{}" });
      const resp = await handler(req);
      expect(resp.status).toBe(401);
    });
  });
}

describe("tool: depreciation_helper input validation", () => {
  it("returns 400 on invalid input", async () => {
    const resp = await callTool("depreciation_helper", { asset_cost: -5, acquisition_date: "2025-07-01" });
    expect(resp.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// usage_event handler (separate function)
// ---------------------------------------------------------------------------
describe("POST /usage_event", () => {
  function usageRequest(body: unknown, method = "POST"): Request {
    return new Request("https://api.ato-mcp.com.au/usage_event", {
      method,
      headers: { authorization: AUTH_HEADER, "content-type": "application/json" },
      ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
    });
  }

  it("returns 204 for valid event", async () => {
    const { handler } = await import("../api/usage_event.js");
    const resp = await handler(usageRequest({ event_type: "mcp_started" }));
    expect(resp.status).toBe(204);
  });

  it("returns 400 for unknown event_type", async () => {
    const { handler } = await import("../api/usage_event.js");
    const resp = await handler(usageRequest({ event_type: "unknown_event" }));
    expect(resp.status).toBe(400);
  });

  it("returns 405 for GET method", async () => {
    const { handler } = await import("../api/usage_event.js");
    const resp = await handler(usageRequest({}, "GET"));
    expect(resp.status).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// facts handler (PUT, separate function)
// ---------------------------------------------------------------------------
describe("PUT /facts", () => {
  it("returns 204 for a valid facts payload", async () => {
    const { handler } = await import("../api/facts.js");
    const validFacts = {
      given_name: "Alice",
      state: "NSW",
      residency_status: "resident",
      has_abn: false,
      business_structure: "none",
      gst_registered: false,
      gst_period: "n/a",
      payg_instalments: false,
      fbt_payer: false,
      has_spouse: false,
      dependants: 0,
      hecs_help_debt: false,
      private_health_insurance: false,
      has_investment_property: false,
      has_shares_or_managed_funds: false,
      has_crypto: false,
      super_fund_type: "industry",
      current_fy: "2025-26",
      prior_fy_lodged: true,
      accepted_disclaimer_at: "2026-01-01T00:00:00Z",
      facts_updated_at: "2026-01-01T00:00:00Z",
      schema_version: 1,
    };
    const req = new Request("https://api.ato-mcp.com.au/facts", {
      method: "PUT",
      headers: { authorization: AUTH_HEADER, "content-type": "application/json" },
      body: JSON.stringify(validFacts),
    });
    const resp = await handler(req);
    expect(resp.status).toBe(204);
  });

  it("returns 422 for invalid facts payload", async () => {
    const { handler } = await import("../api/facts.js");
    const req = new Request("https://api.ato-mcp.com.au/facts", {
      method: "PUT",
      headers: { authorization: AUTH_HEADER, "content-type": "application/json" },
      body: JSON.stringify({ given_name: "" }), // fails min(1)
    });
    const resp = await handler(req);
    expect(resp.status).toBe(422);
  });
});

