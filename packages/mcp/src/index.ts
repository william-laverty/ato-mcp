#!/usr/bin/env node
import { dataDir } from "./lib/paths.js";

function main() {
  const cmd = process.argv[2] ?? "help";
  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    process.stdout.write(`ato-mcp - MCP server for the Australian Taxation Office corpus

Usage:
  ato-mcp mcp       # start the MCP stdio server (used by Claude Code)
  ato-mcp onboard   # set up your account and get a config snippet
  ato-mcp update    # download/update the local corpus
  ato-mcp stats     # print corpus stats and exit
  ato-mcp help      # this message

Data directory: ${dataDir()}
`);
    return;
  }
  if (cmd === "mcp") {
    return import("./server.js").then((m) => m.runMcp());
  }
  if (cmd === "update") {
    return import("./lib/download.js").then((m) => m.runUpdate());
  }
  if (cmd === "stats") {
    return import("./lib/stats-cli.js").then(async (m) => {
      const out = await m.statsCli();
      process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    });
  }
  if (cmd === "onboard") {
    return import("./lib/onboard.js").then((m) => m.runOnboard());
  }
  process.stderr.write(`Unknown command: ${cmd}\n`);
  process.exit(2);
}

Promise.resolve(main()).catch((err) => {
  process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
