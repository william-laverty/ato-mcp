import { describe, it, expect } from "vitest";
import { resolveProxyArgs, resolveProxyPath } from "../src/index.js";

describe("resolveProxyPath", () => {
  it("resolves the bundled mcp-remote proxy entrypoint", () => {
    // Throws if mcp-remote isn't installed or its layout changed underneath us.
    const path = resolveProxyPath();
    expect(path).toMatch(/mcp-remote[\\/]dist[\\/]proxy\.js$/);
  });
});

describe("resolveProxyArgs", () => {
  it("defaults to the hosted endpoint with no passthrough args", () => {
    expect(resolveProxyArgs([], {})).toEqual({
      url: "https://api.ato-mcp.com.au/mcp",
      passthrough: [],
    });
  });

  it("strips a leading explicit 'mcp' command and forwards the rest", () => {
    expect(resolveProxyArgs(["mcp", "--transport", "http-only"], {})).toEqual({
      url: "https://api.ato-mcp.com.au/mcp",
      passthrough: ["--transport", "http-only"],
    });
  });

  it("forwards args as-is when no explicit command is present", () => {
    expect(resolveProxyArgs(["8090"], {})).toEqual({
      url: "https://api.ato-mcp.com.au/mcp",
      passthrough: ["8090"],
    });
  });

  it("honours ATO_MCP_URL override", () => {
    expect(resolveProxyArgs([], { ATO_MCP_URL: "https://staging.example.com/mcp" })).toEqual({
      url: "https://staging.example.com/mcp",
      passthrough: [],
    });
  });

  it("prefers ATO_MCP_URL even when passthrough args are present", () => {
    expect(
      resolveProxyArgs(["mcp", "--debug"], { ATO_MCP_URL: "https://staging.example.com/mcp" }),
    ).toEqual({
      url: "https://staging.example.com/mcp",
      passthrough: ["--debug"],
    });
  });
});
