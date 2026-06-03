// Integration tests for Vercel function handlers using mock auth + mock store.
// Each test:
//   1. Sets MOCK_SUPABASE=1 so the handler uses mock clients
//   2. Passes a valid "atompro_v1_" token
//   3. Asserts the response shape

import { describe, it, expect, beforeEach, afterEach } from "vitest";

const MOCK_TOKEN = "atompro_v1_testtoken";
const AUTH_HEADER = `Bearer ${MOCK_TOKEN}`;

function makePostRequest(body: unknown): Request {
  return new Request("https://api.ato-mcp.com.au/test", {
    method: "POST",
    headers: { authorization: AUTH_HEADER, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(path: string): Request {
  return new Request(`https://api.ato-mcp.com.au${path}`, {
    method: "GET",
    headers: { authorization: AUTH_HEADER },
  });
}

beforeEach(() => {
  process.env["MOCK_SUPABASE"] = "1";
});

afterEach(() => {
  delete process.env["MOCK_SUPABASE"];
});

// ---------------------------------------------------------------------------
// stats handler
// ---------------------------------------------------------------------------
describe("GET /stats", () => {
  it("returns stats with installed=true", async () => {
    const { handler } = await import("../api/stats.js");
    const resp = await handler(makePostRequest({}));
    expect(resp.status).toBe(200);
    const body = await resp.json() as { installed: boolean; docs: number };
    expect(body.installed).toBe(true);
    expect(typeof body.docs).toBe("number");
  });

  it("returns 401 without auth", async () => {
    const { handler } = await import("../api/stats.js");
    const req = new Request("https://api.ato-mcp.com.au/stats", { method: "POST", body: "{}" });
    const resp = await handler(req);
    expect(resp.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// search handler
// ---------------------------------------------------------------------------
describe("POST /search", () => {
  it("returns search result with hits array", async () => {
    const { handler } = await import("../api/search.js");
    const resp = await handler(makePostRequest({ query: "small business deduction", k: 5, mode: "keyword", include_old: false }));
    // Mock keyword search returns [] → fused = []
    expect(resp.status).toBe(200);
    const body = await resp.json() as { hits: unknown[]; query: string };
    expect(Array.isArray(body.hits)).toBe(true);
    expect(body.query).toBe("small business deduction");
  });

  it("returns 400 on invalid input", async () => {
    const { handler } = await import("../api/search.js");
    const resp = await handler(makePostRequest({ query: "" })); // query too short
    expect(resp.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// get_chunks handler
// ---------------------------------------------------------------------------
describe("POST /get_chunks", () => {
  it("returns chunks object", async () => {
    const { handler } = await import("../api/get_chunks.js");
    const resp = await handler(makePostRequest({ chunk_ids: ["ato:test#0"], neighbours: 0 }));
    expect(resp.status).toBe(200);
    const body = await resp.json() as { chunks: unknown[] };
    expect(Array.isArray(body.chunks)).toBe(true);
  });

  it("returns 400 when chunk_ids is empty", async () => {
    const { handler } = await import("../api/get_chunks.js");
    const resp = await handler(makePostRequest({ chunk_ids: [] }));
    expect(resp.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// get_definition handler
// ---------------------------------------------------------------------------
describe("POST /get_definition", () => {
  it("returns ordinary definition when no statutory match", async () => {
    const { handler } = await import("../api/get_definition.js");
    const resp = await handler(makePostRequest({ term: "resident", jurisdiction: "AU" }));
    expect(resp.status).toBe(200);
    const body = await resp.json() as { term: string; kind: string };
    expect(body.term).toBe("resident");
    // Mock store returns [] → falls through to ordinary
    expect(["statutory", "ordinary"]).toContain(body.kind);
  });
});

// ---------------------------------------------------------------------------
// get_threshold handler
// ---------------------------------------------------------------------------
describe("POST /get_threshold", () => {
  it("returns 400 when threshold not found (mock returns null)", async () => {
    const { handler } = await import("../api/get_threshold.js");
    const resp = await handler(makePostRequest({ name: "hecs_repayment_threshold" }));
    // Mock store returns null → getThreshold throws
    expect(resp.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// get_doc handler
// ---------------------------------------------------------------------------
describe("POST /get_doc", () => {
  it("returns 400 when doc not found (mock returns null)", async () => {
    const { handler } = await import("../api/get_doc.js");
    const resp = await handler(makePostRequest({ doc_id: "ato:some-doc" }));
    // Mock getDoc returns null → getDoc tool throws
    expect(resp.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// get_doc_anchors handler
// ---------------------------------------------------------------------------
describe("POST /get_doc_anchors", () => {
  it("returns empty anchor graph from mock store", async () => {
    const { handler } = await import("../api/get_doc_anchors.js");
    const resp = await handler(makePostRequest({ doc_id: "ato:some-doc" }));
    expect(resp.status).toBe(200);
    const body = await resp.json() as { anchors: unknown[]; inbound: unknown[]; outbound: unknown[] };
    expect(Array.isArray(body.anchors)).toBe(true);
    expect(Array.isArray(body.inbound)).toBe(true);
    expect(Array.isArray(body.outbound)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// usage_event handler
// ---------------------------------------------------------------------------
describe("POST /usage_event", () => {
  it("returns 204 for valid event", async () => {
    const { handler } = await import("../api/usage_event.js");
    const resp = await handler(makePostRequest({ event_type: "mcp_started", mode: "hosted" }));
    expect(resp.status).toBe(204);
  });

  it("returns 400 for unknown event_type", async () => {
    const { handler } = await import("../api/usage_event.js");
    const resp = await handler(makePostRequest({ event_type: "unknown_event", mode: "hosted" }));
    expect(resp.status).toBe(400);
  });

  it("returns 405 for GET method", async () => {
    const { handler } = await import("../api/usage_event.js");
    const resp = await handler(makeGetRequest("/usage_event"));
    expect(resp.status).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// facts handler (PUT)
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

// ---------------------------------------------------------------------------
// deduction_discovery handler
// ---------------------------------------------------------------------------
describe("POST /deduction_discovery", () => {
  it("returns a structured onboard error when the user has no facts (mock store)", async () => {
    const { handler } = await import("../api/deduction_discovery.js");
    const resp = await handler(makePostRequest({}));
    // Mock user_facts returns null → tool throws the onboard message → handled
    expect(resp.status).toBe(400);
    const body = await resp.json() as { kind: string; message: string };
    expect(body.kind).toBe("error");
    expect(body.message).toMatch(/onboard/i);
  });

  it("returns 401 without auth", async () => {
    const { handler } = await import("../api/deduction_discovery.js");
    const req = new Request("https://api.ato-mcp.com.au/deduction_discovery", { method: "POST", body: "{}" });
    const resp = await handler(req);
    expect(resp.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// depreciation_helper handler
// ---------------------------------------------------------------------------
describe("POST /depreciation_helper", () => {
  it("returns a structured onboard error when the user has no facts (mock store)", async () => {
    const { handler } = await import("../api/depreciation_helper.js");
    const resp = await handler(makePostRequest({ asset_cost: 1000, acquisition_date: "2025-07-01" }));
    expect(resp.status).toBe(400);
    const body = await resp.json() as { kind: string; message: string };
    expect(body.kind).toBe("error");
    expect(body.message).toMatch(/onboard/i);
  });
  it("returns 400 on invalid input", async () => {
    const { handler } = await import("../api/depreciation_helper.js");
    const resp = await handler(makePostRequest({ asset_cost: -5, acquisition_date: "2025-07-01" }));
    expect(resp.status).toBe(400);
  });
  it("returns 401 without auth", async () => {
    const { handler } = await import("../api/depreciation_helper.js");
    const req = new Request("https://api.ato-mcp.com.au/depreciation_helper", { method: "POST", body: "{}" });
    const resp = await handler(req);
    expect(resp.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// bas_prep_checklist handler
// ---------------------------------------------------------------------------
describe("POST /bas_prep_checklist", () => {
  it("returns a structured onboard error when the user has no facts (mock store)", async () => {
    const { handler } = await import("../api/bas_prep_checklist.js");
    const resp = await handler(makePostRequest({}));
    expect(resp.status).toBe(400);
    const body = await resp.json() as { kind: string; message: string };
    expect(body.kind).toBe("error");
    expect(body.message).toMatch(/onboard/i);
  });
  it("returns 401 without auth", async () => {
    const { handler } = await import("../api/bas_prep_checklist.js");
    const req = new Request("https://api.ato-mcp.com.au/bas_prep_checklist", { method: "POST", body: "{}" });
    const resp = await handler(req);
    expect(resp.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// onboard/poll handler
// ---------------------------------------------------------------------------
describe("GET /api/onboard_poll", () => {
  it("returns ready=false for unknown code", async () => {
    const { handler } = await import("../api/onboard_poll.js");
    const req = new Request("https://api.ato-mcp.com.au/api/onboard_poll?code=abcd1234", {
      method: "GET",
      headers: { authorization: AUTH_HEADER },
    });
    const resp = await handler(req);
    expect(resp.status).toBe(200);
    const body = await resp.json() as { ready: boolean };
    expect(body.ready).toBe(false);
  });

  it("returns 400 for missing code", async () => {
    const { handler } = await import("../api/onboard_poll.js");
    const req = new Request("https://api.ato-mcp.com.au/api/onboard_poll", {
      method: "GET",
      headers: { authorization: AUTH_HEADER },
    });
    const resp = await handler(req);
    expect(resp.status).toBe(400);
  });

  it("returns 400 for invalid code format", async () => {
    const { handler } = await import("../api/onboard_poll.js");
    const req = new Request("https://api.ato-mcp.com.au/api/onboard_poll?code=toolong12345", {
      method: "GET",
      headers: { authorization: AUTH_HEADER },
    });
    const resp = await handler(req);
    expect(resp.status).toBe(400);
  });
});
