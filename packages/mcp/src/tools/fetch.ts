import type { FetchInput } from "@ato-pro/shared";

export interface FetchOutput {
  uri: string;
  url: string;
  status: number;
  content_type: string | null;
  body: string;
}

export async function fetchUri(args: FetchInput): Promise<FetchOutput> {
  const uri = args.uri.trim();
  if (uri.startsWith("ato:")) {
    const tail = uri.slice("ato:".length).replace(/^\/+/, "");
    const url = `https://www.ato.gov.au/${tail}`;
    return await fetchHttp(uri, url);
  }
  throw new Error(`Unsupported URI scheme: ${uri}. v0.1 supports 'ato:' only.`);
}

async function fetchHttp(uri: string, url: string): Promise<FetchOutput> {
  const resp = await fetch(url, { headers: { "user-agent": "ato-pro/0.1" } });
  const text = resp.status === 200 ? await resp.text() : "";
  return {
    uri,
    url,
    status: resp.status,
    content_type: resp.headers.get("content-type"),
    body: text,
  };
}
