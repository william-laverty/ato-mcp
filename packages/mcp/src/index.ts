#!/usr/bin/env node

function main() {
  // Default action is to start the server, so `npx -y ato-mcp` just works.
  const cmd = process.argv[2] ?? "mcp";
  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    process.stdout.write(`ato-mcp - hosted MCP server for the Australian Taxation Office corpus

Usage:
  ato-mcp            # start the MCP stdio server (default; reads ATO_MCP_TOKEN)
  ato-mcp mcp        # same as above, explicit
  ato-mcp onboard    # open the browser to get your token + config snippet
  ato-mcp help       # this message

Set ATO_MCP_TOKEN in your MCP client config.
Get a token at https://ato-mcp.com.au/onboard
`);
    return;
  }
  if (cmd === "mcp") {
    return import("./server.js").then((m) => m.runMcp());
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
