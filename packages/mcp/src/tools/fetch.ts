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
    return await fetchHttp(uri, `https://www.ato.gov.au/${tail}`);
  }
  if (uri.startsWith("ato-law:")) {
    const tail = uri.slice("ato-law:".length).replace(/^\/+/, "");
    return await fetchHttp(uri, `https://www.ato.gov.au/law/view.htm?docid=${tail}`);
  }
  if (uri.startsWith("legis:")) {
    const legisPath = uri.slice("legis:".length);
    const slashIdx = legisPath.indexOf("/");
    const actKey = slashIdx >= 0 ? legisPath.slice(0, slashIdx) : legisPath;
    const section = slashIdx >= 0 ? legisPath.slice(slashIdx + 1) : "";
    return await fetchHttp(uri, `https://www.legislation.gov.au/Latest/${actKey}/${section}`);
  }
  if (uri.startsWith("staterev-")) {
    const m = uri.match(/^staterev-([a-z]+):(.+)$/);
    if (m) {
      const [, juris, path] = m;
      const host = stateRevenueHost(juris!);
      if (host) return await fetchHttp(uri, `${host}/${path}`);
    }
  }
  throw new Error(`Unsupported URI scheme: ${uri}`);
}

function stateRevenueHost(juris: string): string | null {
  const hosts: Record<string, string> = {
    nsw: "https://www.revenue.nsw.gov.au",
    vic: "https://www.sro.vic.gov.au",
    qld: "https://qro.qld.gov.au",
    sa:  "https://www.revenuesa.sa.gov.au",
    wa:  "https://www.wa.gov.au/organisation/department-of-finance/state-revenue",
    tas: "https://www.sro.tas.gov.au",
    act: "https://www.revenue.act.gov.au",
    nt:  "https://nt.gov.au/employ/for-employers-in-nt/territory-revenue-office",
  };
  return hosts[juris] ?? null;
}

async function fetchHttp(uri: string, url: string): Promise<FetchOutput> {
  const resp = await fetch(url, { headers: { "user-agent": "ato-pro/0.2" } });
  const text = resp.status === 200 ? await resp.text() : "";
  return {
    uri,
    url,
    status: resp.status,
    content_type: resp.headers.get("content-type"),
    body: text,
  };
}
