import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer as createHttpsServer } from "node:https";
import { createServer as createTcpServer, type AddressInfo, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diagnose, metadataUrl } from "../src/doctor.js";

const METADATA = JSON.stringify({ resource: "https://api.ato-mcp.com.au/mcp" });

// Raw HTTP/1.1 so the framing is exactly what a client receives.
function rawServer(response: string): Promise<Server> {
  const server = createTcpServer((socket) => socket.once("data", () => socket.end(response)));
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function endpoint(server: Server, scheme: string, host = "127.0.0.1"): string {
  return `${scheme}://${host}:${(server.address() as AddressInfo).port}/mcp`;
}

describe("metadataUrl", () => {
  it("inserts the well-known path before the endpoint path", () => {
    expect(metadataUrl("https://api.ato-mcp.com.au/mcp")).toBe(
      "https://api.ato-mcp.com.au/.well-known/oauth-protected-resource/mcp",
    );
  });

  it("uses the bare well-known path for a root endpoint", () => {
    expect(metadataUrl("https://example.com/")).toBe("https://example.com/.well-known/oauth-protected-resource");
  });
});

describe("diagnose", () => {
  const servers: Server[] = [];
  afterAll(() => servers.forEach((s) => s.close()));

  it("passes a well-formed metadata response", async () => {
    const server = await rawServer(
      `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${METADATA.length}\r\n\r\n${METADATA}`,
    );
    servers.push(server);
    const { checks, hint } = await diagnose(endpoint(server, "http"));
    expect(checks).toEqual([{ ok: true, message: expect.stringContaining("Sign-in metadata readable") }]);
    expect(hint).toBeNull();
  });

  it("reports a body declared chunked but sent unframed", async () => {
    const server = await rawServer(
      `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n${METADATA}`,
    );
    servers.push(server);
    const { checks } = await diagnose(endpoint(server, "http"));
    expect(checks[0]?.ok).toBe(false);
    expect(checks[0]?.message).toContain("Invalid character in chunk size");
  });

  it("reports an HTTP error status", async () => {
    const server = await rawServer("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n");
    servers.push(server);
    const { checks } = await diagnose(endpoint(server, "http"));
    expect(checks[0]).toEqual({ ok: false, message: expect.stringContaining("HTTP 404") });
  });

  describe("behind a certificate no public authority issued", () => {
    let dir: string;
    let server: ReturnType<typeof createHttpsServer>;

    beforeAll(async () => {
      dir = mkdtempSync(join(tmpdir(), "ato-mcp-doctor-"));
      execFileSync("openssl", [
        "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
        "-subj", "/O=Test Web Shield/CN=Test Web Shield Root",
        "-addext", "subjectAltName=DNS:localhost",
        "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem"),
      ], { stdio: "ignore" });
      server = createHttpsServer(
        { key: readFileSync(join(dir, "key.pem")), cert: readFileSync(join(dir, "cert.pem")) },
        (_req, res) => res.end(METADATA),
      );
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    });

    afterAll(() => {
      server.close();
      rmSync(dir, { recursive: true, force: true });
    });

    it("names the issuer and explains the interception", async () => {
      const { checks, hint } = await diagnose(endpoint(server as unknown as Server, "https", "localhost"));
      expect(checks[0]?.ok).toBe(false);
      expect(checks[0]?.message).toContain("issued by Test Web Shield, not a public certificate authority");
      expect(hint).toContain("intercepting HTTPS to localhost");
      expect(hint).toContain("Exclude localhost from HTTPS scanning");
    });
  });
});
