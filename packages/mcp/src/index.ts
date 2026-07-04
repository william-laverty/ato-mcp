#!/usr/bin/env node
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

const DEFAULT_URL = "https://api.ato-mcp.com.au/mcp";

const HELP_TEXT = `ato-mcp - stdio proxy for the hosted ATO tax MCP server (ato-mcp.com.au)

Speaks MCP over stdio to your AI client and proxies every tool call to the
hosted endpoint. First run opens your browser to sign in (OAuth); after that,
credentials are cached under ~/.mcp-auth and refreshed automatically. Delete
that folder to sign out.

Usage:
  ato-mcp                 # start the proxy (default)
  ato-mcp mcp [args...]   # same as above; extra args are passed through to
                           # the bundled mcp-remote proxy (e.g. --transport
                           # http-only, a callback port)
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
 * Pure helper: given the raw CLI argv (process.argv.slice(2)) and env,
 * resolve the hosted endpoint URL and the args to forward to mcp-remote.
 * Exported so it's testable without spawning a child process.
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

function runProxy({ url, passthrough }: ProxyInvocation): Promise<number> {
  const proxyPath = resolveProxyPath();

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [proxyPath, url, ...passthrough], {
      stdio: "inherit",
    });

    const forwardSignal = (signal: NodeJS.Signals) => {
      child.kill(signal);
    };
    process.on("SIGINT", forwardSignal);
    process.on("SIGTERM", forwardSignal);

    const stopForwarding = () => {
      process.off("SIGINT", forwardSignal);
      process.off("SIGTERM", forwardSignal);
    };

    child.on("exit", (code, signal) => {
      stopForwarding();
      resolve(code ?? (signal ? 1 : 0));
    });
    child.on("error", (err) => {
      stopForwarding();
      process.stderr.write(`fatal: failed to start mcp-remote proxy: ${err.message}\n`);
      resolve(1);
    });
  });
}

async function main(): Promise<number> {
  const rawArgs = process.argv.slice(2);
  const cmd = rawArgs[0];

  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    process.stdout.write(HELP_TEXT);
    return 0;
  }

  if (cmd !== undefined && cmd !== "mcp") {
    process.stderr.write(`Unknown command: ${cmd}\n`);
    return 2;
  }

  return runProxy(resolveProxyArgs(rawArgs, process.env));
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
