// Adapter that lets us write handlers in the Web Standard `(req: Request) => Response`
// style and expose them as Vercel Node functions. Vercel's default function runtime
// uses Node-style (req, res); the Edge runtime would allow native Web Standard but
// doesn't support some of our deps (sharp, onnxruntime-node transitively).
//
// Usage:
//   async function handler(req: Request): Promise<Response> { ... }
//   export default adapt(handler);

import type { VercelRequest, VercelResponse } from "@vercel/node";

export type WebHandler = (req: Request) => Promise<Response>;

export function adapt(handler: WebHandler) {
  return async function vercelHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
    try {
      const host = req.headers.host ?? "api.ato-mcp.com.au";
      const url = `https://${host}${req.url ?? "/"}`;

      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) headers.set(name, value.join(", "));
        else headers.set(name, String(value));
      }

      let body: BodyInit | undefined;
      if (req.method && req.method !== "GET" && req.method !== "HEAD") {
        // Vercel auto-parses JSON for content-type: application/json into req.body.
        // We need to forward the body to the Web Request as a string.
        if (req.body !== undefined && req.body !== null) {
          body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
        }
      }

      const webReq = new Request(url, {
        method: req.method ?? "GET",
        headers,
        body,
      });

      const webRes = await handler(webReq);

      res.status(webRes.status);
      webRes.headers.forEach((value, key) => res.setHeader(key, value));

      if (webRes.body) {
        const text = await webRes.text();
        res.send(text);
      } else {
        res.end();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("adapter error:", message);
      res.status(500).json({ kind: "error", message });
    }
  };
}
