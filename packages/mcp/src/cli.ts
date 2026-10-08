#!/usr/bin/env node
import { spawn } from "node:child_process";
import { diagnose } from "./doctor.js";
import {
  HELP_TEXT,
  readVersion,
  resolveProxyArgs,
  resolveProxyPath,
  type ProxyInvocation,
} from "./index.js";

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

async function runDoctor(url: string): Promise<number> {
  process.stdout.write(`Checking ${url}\n\n`);
  const { checks, hint } = await diagnose(url);
  for (const check of checks) {
    process.stdout.write(`  ${check.ok ? "ok  " : "FAIL"}  ${check.message}\n`);
  }
  if (hint) process.stdout.write(`\n${hint}\n`);
  return checks.every((check) => check.ok) ? 0 : 1;
}

export async function main(argv: string[], env: NodeJS.ProcessEnv): Promise<number> {
  const cmd = argv[0];

  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    process.stdout.write(HELP_TEXT);
    return 0;
  }

  if (cmd === "version" || cmd === "--version" || cmd === "-v") {
    process.stdout.write(`${readVersion()}\n`);
    return 0;
  }

  if (cmd === "doctor") {
    return runDoctor(resolveProxyArgs([], env).url);
  }

  if (cmd !== undefined && cmd !== "mcp") {
    process.stderr.write(`Unknown command: ${cmd}\nRun "ato-mcp help" for usage.\n`);
    return 2;
  }

  return runProxy(resolveProxyArgs(argv, env));
}

main(process.argv.slice(2), process.env)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
