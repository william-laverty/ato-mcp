import crypto from "node:crypto";

const BASE_URL = process.env.ATO_MCP_WEB_URL ?? "https://ato-mcp.com.au";
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1_000; // 5 minutes

/**
 * runOnboard — CLI-driven onboarding flow.
 *
 * 1. Generates a one-time code
 * 2. Opens the browser to /onboard?code=<code>
 * 3. Polls /api/onboard/poll?code=<code> until the user completes setup
 * 4. Writes the returned config bundle to stdout for the user to copy
 */
export async function runOnboard(): Promise<void> {
  const code = crypto.randomBytes(16).toString("hex");
  const url = `${BASE_URL}/onboard?cli_code=${encodeURIComponent(code)}`;

  process.stdout.write(`\nato-pro-mcp onboard\n`);
  process.stdout.write(`─────────────────────────────────────────\n`);
  process.stdout.write(`Opening browser to:\n  ${url}\n\n`);
  process.stdout.write(
    `Complete the setup in your browser, then return here.\n`,
  );
  process.stdout.write(`Waiting for you to finish… (Ctrl-C to cancel)\n\n`);

  // Dynamically import `open` (ESM-only package)
  const { default: open } = await import("open");
  await open(url);

  // Poll until complete or timeout
  const started = Date.now();
  let configBundle: unknown = null;

  while (Date.now() - started < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);

    try {
      const res = await fetch(
        `${BASE_URL}/api/onboard/poll?code=${encodeURIComponent(code)}`,
      );
      if (res.ok) {
        const body = (await res.json()) as {
          ready: boolean;
          config: unknown;
        };
        if (body.ready) {
          configBundle = body.config;
          break;
        }
      }
    } catch {
      // Network errors during polling are transient — keep going
    }

    process.stdout.write(".");
  }

  process.stdout.write("\n");

  if (!configBundle) {
    process.stderr.write(
      `\nOnboarding timed out or was not completed in the browser.\n` +
        `You can complete setup at: ${BASE_URL}/onboard\n`,
    );
    process.exit(1);
  }

  process.stdout.write(`\n✓ Setup complete! Add this to your AI client config:\n\n`);
  process.stdout.write(JSON.stringify(configBundle, null, 2) + "\n\n");
  process.stdout.write(
    `For help, visit: ${BASE_URL}/account\n`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
