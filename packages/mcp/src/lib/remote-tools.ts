// Hosted-mode tool forwarder.
//
// When the local MCP is configured for hosted mode, every tool call goes
// over HTTPS to api.ato-mcp.com.au. The backend runs the same shared tool
// code we'd otherwise run locally, against Supabase Postgres + pgvector.
//
// One forwarder per MCP process. No local Store/Embedder needed.

/**
 * Every error a user can act on must say how — a bare status code leaves them
 * stuck. 401s point at token recovery; 400s are collapsed into readable
 * validation messages instead of raw serialized schema output.
 */
function formatHttpError(toolName: string, status: number, detail: string): string {
  if (status === 401) {
    return (
      `Backend ${toolName}: HTTP 401 — your ATO_MCP_TOKEN is invalid or has been revoked (${detail}). ` +
      `Manage tokens at https://ato-mcp.com.au/account, or set up a new one at https://ato-mcp.com.au/onboard`
    );
  }
  if (status === 429) {
    return `Backend ${toolName}: HTTP 429 — rate limited. Wait a minute, then retry.`;
  }
  if (status === 400) {
    return `Backend ${toolName}: HTTP 400 — ${humaniseValidation(detail)}`;
  }
  return `Backend ${toolName}: HTTP ${status} — ${detail}`;
}

/** Older backends returned raw serialized Zod issue arrays; collapse them. */
function humaniseValidation(detail: string): string {
  const trimmed = detail.trim();
  if (!trimmed.startsWith("[")) return trimmed;
  try {
    const issues = JSON.parse(trimmed) as Array<{
      path?: Array<string | number>;
      message?: string;
    }>;
    if (Array.isArray(issues)) {
      const parts = issues
        .filter((i) => i && typeof i.message === "string")
        .map((i) => `${(i.path ?? []).join(".") || "input"}: ${i.message}`);
      if (parts.length > 0) return `invalid input — ${parts.join("; ")}`;
    }
  } catch {
    // not a Zod issue array — fall through to the raw detail
  }
  return trimmed;
}

export class RemoteToolForwarder {
  constructor(
    private readonly endpoint: string,
    private readonly bearerToken: string,
  ) {}

  /**
   * POST {endpoint}/{toolName} with args as JSON body.
   * Returns the parsed JSON response.
   * Throws on non-2xx status with a descriptive message.
   */
  async call(toolName: string, args: unknown): Promise<unknown> {
    const url = `${this.endpoint.replace(/\/$/, "")}/${toolName}`;
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.bearerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Backend unreachable (${url}): ${msg}`);
    }

    const text = await resp.text();

    if (!resp.ok) {
      // Try to surface the structured error payload if the backend returned JSON
      let detail = text.slice(0, 500);
      try {
        const parsed = JSON.parse(text) as { message?: string };
        if (parsed.message) detail = parsed.message;
      } catch {
        // not JSON, use the raw text
      }
      throw new Error(formatHttpError(toolName, resp.status, detail));
    }

    if (resp.status === 204 || text.length === 0) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch (e) {
      throw new Error(`Backend ${toolName}: invalid JSON response: ${text.slice(0, 200)}`);
    }
  }
}
