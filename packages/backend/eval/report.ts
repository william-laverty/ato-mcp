import { recallAtK, reciprocalRank, ndcgAtK, mean } from "./metrics.js";
import type { CaseResult } from "./runner.js";

export interface KMetrics {
  recall: number;
  ndcg: number;
}

export interface Aggregate {
  searchCount: number;
  mrr: number;
  perK: Record<string, KMetrics>;
  exactCount: number;
  exactPassRate: number;
  errorCount: number;
}

export interface Baseline {
  mrr: number;
  perK: Record<string, KMetrics>;
  exactPassRate: number;
}

export function scoreResults(results: CaseResult[], ks: number[]): Aggregate {
  const searchCases = results.filter((r) => r.kind === "search");
  const exactCases = results.filter((r) => r.kind !== "search");

  const perK: Record<string, KMetrics> = {};
  for (const k of ks) {
    perK[String(k)] = {
      recall: mean(searchCases.map((r) => recallAtK(r.rankedDocs, r.expectedDocs, k))),
      ndcg: mean(searchCases.map((r) => ndcgAtK(r.rankedDocs, r.expectedDocs, k))),
    };
  }

  return {
    searchCount: searchCases.length,
    mrr: mean(searchCases.map((r) => reciprocalRank(r.rankedDocs, r.expectedDocs))),
    perK,
    exactCount: exactCases.length,
    exactPassRate: mean(exactCases.map((r) => (r.exactPass ? 1 : 0))),
    errorCount: results.filter((r) => r.error).length,
  };
}

export function diffBaseline(
  agg: Aggregate,
  base: Baseline,
  tolerance: number,
): { regressed: boolean; lines: string[] } {
  const lines: string[] = [];
  let regressed = false;

  const check = (label: string, now: number, was: number) => {
    const delta = now - was;
    if (delta < -tolerance) {
      regressed = true;
      lines.push(`REGRESSION ${label}: ${was.toFixed(3)} -> ${now.toFixed(3)} (${delta.toFixed(3)})`);
    } else {
      const sign = delta >= 0 ? "+" : "";
      lines.push(`ok         ${label}: ${was.toFixed(3)} -> ${now.toFixed(3)} (${sign}${delta.toFixed(3)})`);
    }
  };

  check("mrr", agg.mrr, base.mrr);
  check("exactPassRate", agg.exactPassRate, base.exactPassRate);
  for (const k of Object.keys(agg.perK)) {
    const b = base.perK[k];
    if (!b) continue;
    check(`recall@${k}`, agg.perK[k]!.recall, b.recall);
    check(`ndcg@${k}`, agg.perK[k]!.ndcg, b.ndcg);
  }

  return { regressed, lines };
}

export function formatTable(results: CaseResult[], agg: Aggregate): string {
  const rows: string[] = [];
  rows.push("id".padEnd(32) + "kind".padEnd(12) + "result");
  rows.push("-".repeat(60));
  for (const r of results) {
    let outcome: string;
    if (r.error) outcome = `ERROR: ${r.error}`;
    else if (r.kind === "search") outcome = `hit=${r.rankedDocs.some((d) => r.expectedDocs.includes(d)) ? "Y" : "N"} top=${r.rankedDocs.slice(0, 3).join(",")}`;
    else outcome = r.exactPass ? "PASS" : "FAIL";
    rows.push(r.id.padEnd(32) + r.kind.padEnd(12) + outcome);
  }
  rows.push("-".repeat(60));
  rows.push(`search cases: ${agg.searchCount}   exact cases: ${agg.exactCount}   errors: ${agg.errorCount}`);
  rows.push(`MRR: ${agg.mrr.toFixed(3)}   exactPassRate: ${agg.exactPassRate.toFixed(3)}`);
  for (const k of Object.keys(agg.perK)) {
    rows.push(`recall@${k}: ${agg.perK[k]!.recall.toFixed(3)}   ndcg@${k}: ${agg.perK[k]!.ndcg.toFixed(3)}`);
  }
  return rows.join("\n");
}
