const BASE_URL = process.env.ATO_MCP_WEB_URL ?? "https://ato-mcp.com.au";

/**
 * runOnboard — opens the browser to the onboarding page where the user
 * can sign in, complete the facts wizard, and copy their ATO_MCP_TOKEN.
 */
export async function runOnboard(): Promise<void> {
  const url = `${BASE_URL}/onboard`;

  process.stdout.write(`\nato-mcp onboard\n`);
  process.stdout.write(`─────────────────────────────────────────\n`);
  process.stdout.write(`Opening browser to:\n  ${url}\n\n`);
  process.stdout.write(`Sign in, complete the setup wizard, then copy\n`);
  process.stdout.write(`the ATO_MCP_TOKEN into your AI client config.\n`);

  // Dynamically import `open` (ESM-only package)
  const { default: open } = await import("open");
  await open(url);
}
