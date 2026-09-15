import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

export const DEFAULT_URL = "https://api.ato-mcp.com.au/mcp";

export const HELP_TEXT = `ato-mcp - stdio proxy for the hosted ATO tax MCP server (ato-mcp.com.au)

Speaks MCP over stdio to your AI client and proxies every tool call to the
hosted endpoint. First run opens your browser to sign in (OAuth); after that,
credentials are cached under ~/.mcp-auth and refreshed automatically. Delete
that folder to sign out.

Usage:
  ato-mcp                 # start the proxy (default)
  ato-mcp mcp [args...]   # same as above; extra args are passed through to
                           # the bundled mcp-remote proxy (e.g. --debug,
                           # --transport http-only, a callback port)
  ato-mcp version          # print the installed version
  ato-mcp help             # this message

Environment:
  ATO_MCP_URL   override the hosted endpoint (default: ${DEFAULT_URL})

Install instructions for every MCP client: https://ato-mcp.com.au/install
`;

export interface ProxyInvocation {
  url: string;
  passthrough: string[];
}

/**
 * Given the raw CLI argv (process.argv.slice(2)) and env, resolve the hosted
 * endpoint URL and the args to forward to mcp-remote.
 */
export function resolveProxyArgs(argv: string[], env: NodeJS.ProcessEnv): ProxyInvocation {
  const url = env["ATO_MCP_URL"] ?? DEFAULT_URL;
  const passthrough = argv[0] === "mcp" ? argv.slice(1) : argv;
  return { url, passthrough };
}

/** Resolve the bundled mcp-remote proxy entrypoint. Throws if unresolvable. */
export function resolveProxyPath(): string {
  const require = createRequire(import.meta.url);
  return require.resolve("mcp-remote/dist/proxy.js");
}

/** The installed package version, read from package.json. */
export function readVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string;
  };
  return pkg.version;
}
