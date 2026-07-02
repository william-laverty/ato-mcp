// Hosted-mode tool forwarder.
//
// When the local MCP is configured for hosted mode, every tool call goes
// over HTTPS to api.ato-mcp.com.au. The backend runs the same shared tool
// code we'd otherwise run locally, against Supabase Postgres + pgvector.
//
// One forwarder per MCP process. No local Store/Embedder needed.

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
      throw new Error(`Backend ${toolName}: HTTP ${resp.status} — ${detail}`);
    }

    if (resp.status === 204 || text.length === 0) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch (e) {
      throw new Error(`Backend ${toolName}: invalid JSON response: ${text.slice(0, 200)}`);
    }
  }
}
