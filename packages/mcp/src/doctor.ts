import tls from "node:tls";

const TIMEOUT_MS = 10_000;

export interface Check {
  ok: boolean;
  message: string;
}

export interface Diagnosis {
  checks: Check[];
  hint: string | null;
}

/** RFC 9728 protected-resource metadata URL: the document clients fetch to start sign-in. */
export function metadataUrl(endpoint: string): string {
  const url = new URL(endpoint);
  const path = url.pathname === "/" ? "" : url.pathname;
  return `${url.origin}/.well-known/oauth-protected-resource${path}`;
}

// Verified against Node's bundled public roots only, so a locally trusted
// interception CA (antivirus HTTPS scanning, corporate proxy) is reported
// even when NODE_EXTRA_CA_CERTS or the system store trusts it. Verification
// is reported rather than enforced so the interceptor's name can be shown;
// nothing is sent over the socket.
function checkCertificate(url: URL): Promise<Check & { intercepted: boolean }> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: url.hostname,
        port: Number(url.port) || 443,
        servername: url.hostname,
        ca: [...tls.rootCertificates],
        rejectUnauthorized: false,
        timeout: TIMEOUT_MS,
      },
      () => {
        const issuer = socket.getPeerCertificate().issuer;
        const name = issuer?.O ?? issuer?.CN ?? "an unknown issuer";
        socket.end();
        resolve(
          socket.authorized
            ? { ok: true, intercepted: false, message: `HTTPS certificate issued by ${name}` }
            : {
                ok: false,
                intercepted: true,
                message: `HTTPS certificate issued by ${name}, not a public certificate authority (${socket.authorizationError})`,
              },
        );
      },
    );
    socket.on("timeout", () => socket.destroy(new Error("timed out")));
    socket.on("error", (err) =>
      resolve({ ok: false, intercepted: false, message: `HTTPS connection failed: ${err.message}` }),
    );
  });
}

async function checkMetadata(endpoint: string): Promise<Check> {
  const target = metadataUrl(endpoint);
  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = await res.text();
    if (!res.ok) return { ok: false, message: `Sign-in metadata returned HTTP ${res.status} (${target})` };
    const doc = JSON.parse(body) as { resource?: unknown };
    if (typeof doc.resource !== "string") {
      return { ok: false, message: `Sign-in metadata has no resource field (${target})` };
    }
    return { ok: true, message: `Sign-in metadata readable (${target})` };
  } catch (err) {
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause : err;
    const reason = cause instanceof Error ? cause.message : String(cause);
    return { ok: false, message: `Sign-in metadata unreadable: ${reason} (${target})` };
  }
}

/** Checks the connection to the hosted endpoint from this machine. */
export async function diagnose(endpoint: string): Promise<Diagnosis> {
  const url = new URL(endpoint);
  const cert = url.protocol === "https:" ? await checkCertificate(url) : null;
  const metadata = await checkMetadata(endpoint);
  const checks = cert ? [cert, metadata] : [metadata];

  let hint: string | null = null;
  if (cert?.intercepted) {
    hint =
      `Something on this machine or network is intercepting HTTPS to ${url.hostname}, usually ` +
      `antivirus HTTPS scanning (a "web shield") or a corporate proxy. It can rewrite responses ` +
      `so MCP clients can't sign in. Exclude ${url.hostname} from HTTPS scanning, then sign in again.`;
  } else if (cert?.ok && !metadata.ok) {
    hint =
      "The connection looks clean, so this may be on our side. Please open an issue with this " +
      "output: https://github.com/william-laverty/ato-mcp/issues";
  }
  return { checks, hint };
}
