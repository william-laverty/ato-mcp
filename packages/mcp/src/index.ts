#!/usr/bin/env node
import { dataDir } from "./lib/paths.js";

function main() {
  const cmd = process.argv[2] ?? "help";
  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    process.stdout.write(`ato-pro-mcp - MCP server for the Australian Taxation Office corpus

Usage:
  ato-pro-mcp mcp       # start the MCP stdio server (used by Claude Code)
  ato-pro-mcp update    # download/update the local corpus
  ato-pro-mcp stats     # print corpus stats and exit
  ato-pro-mcp help      # this message

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
    return import("./tools/stats.js").then(async (m) => {
      const out = await m.statsCli();
      process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    });
  }
  process.stderr.write(`Unknown command: ${cmd}\n`);
  process.exit(2);
}

Promise.resolve(main()).catch((err) => {
  process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
