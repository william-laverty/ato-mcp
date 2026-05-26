import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchUri } from "@ato-mcp/shared/tools/fetch";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetch tool", () => {
  it("rejects unsupported URI schemes", async () => {
    await expect(fetchUri({ uri: "http://example.com" })).rejects.toThrow(/scheme/i);
  });

  it("ato: scheme fetches via https and returns html", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("<html><body><main><h1>Test</h1></main></body></html>", { status: 200, headers: { "content-type": "text/html" } }),
    ) as unknown as typeof fetch;
    const out = await fetchUri({ uri: "ato:individuals/deductions" });
    expect(out.status).toBe(200);
    expect(out.url).toContain("ato.gov.au");
    expect(out.body).toContain("<h1>Test</h1>");
  });

  it("surfaces a 404 as a structured error result", async () => {
    globalThis.fetch = vi.fn(async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    const out = await fetchUri({ uri: "ato:missing/page" });
    expect(out.status).toBe(404);
    expect(out.body).toBe("");
  });

  it("ato-law: scheme maps to ATO law viewer URL", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("<html><body>Ruling content</body></html>", { status: 200, headers: { "content-type": "text/html" } }),
    ) as unknown as typeof fetch;
    const out = await fetchUri({ uri: "ato-law:TXR/TR2024-5" });
    expect(out.status).toBe(200);
    expect(out.url).toContain("law/view.htm?docid=TXR/TR2024-5");
  });

  it("legis: scheme maps to legislation.gov.au URL", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("<html><body>Legislation</body></html>", { status: 200, headers: { "content-type": "text/html" } }),
    ) as unknown as typeof fetch;
    const out = await fetchUri({ uri: "legis:C2004A05138/8-1" });
    expect(out.status).toBe(200);
    expect(out.url).toContain("legislation.gov.au");
  });

  it("staterev-nsw: scheme maps to revenue.nsw.gov.au", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("<html><body>NSW</body></html>", { status: 200, headers: { "content-type": "text/html" } }),
    ) as unknown as typeof fetch;
    const out = await fetchUri({ uri: "staterev-nsw:payroll-tax/rates" });
    expect(out.status).toBe(200);
    expect(out.url).toContain("revenue.nsw.gov.au");
  });
});
