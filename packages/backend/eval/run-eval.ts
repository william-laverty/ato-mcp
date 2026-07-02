import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SupabaseStore } from "../src/supabase-store.js";
import { WasmEmbedder } from "../src/wasm-embedder.js";
import { OpenAIEmbedder } from "../src/openai-embedder.js";
import { embedProvider } from "../src/embed-provider.js";
import { loadGolden } from "./golden-schema.js";
import { runCase, type CaseResult } from "./runner.js";
import { scoreResults, diffBaseline, formatTable, type Baseline } from "./report.js";

const here = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  if (!process.env["SUPABASE_URL"] || !process.env["SUPABASE_SECRET_KEY"]) {
    console.error("Missing SUPABASE_URL / SUPABASE_SECRET_KEY — the eval runs against the live corpus.");
    process.exit(2);
  }

  if (embedProvider() === "openai" && !process.env["OPENAI_API_KEY"]) {
    console.error("EMBED_PROVIDER=openai but OPENAI_API_KEY is not set.");
    process.exit(2);
  }

  const argv = process.argv.slice(2);
  const updateBaseline = argv.includes("--update-baseline");
  const kArg = argv.find((a) => a.startsWith("--k="));
  const ks = kArg ? kArg.slice(4).split(",").map((s) => Number(s.trim())) : [5, 10];
  const maxK = Math.max(...ks);

  const golden = loadGolden(join(here, "golden.json"));
  const store = new SupabaseStore();
  const embedder =
    embedProvider() === "openai" ? await OpenAIEmbedder.load() : await WasmEmbedder.load();

  const results: CaseResult[] = [];
  for (const c of golden) {
    const r = await runCase({ store, embedder }, c, maxK);
    results.push(r);
    process.stdout.write(r.error ? "E" : ".");
  }
  process.stdout.write("\n\n");

  const agg = scoreResults(results, ks);
  console.log(formatTable(results, agg));

  const resultsDir = join(here, "results");
  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(join(resultsDir, "latest.json"), JSON.stringify({ agg, results }, null, 2));

  // Hard-fail on any errored cases — a baseline derived from errored runs is invalid,
  // and regressions are meaningless when some cases never ran.
  if (agg.errorCount > 0) {
    const errored = results.filter((r) => r.error);
    console.error(`\nERROR: ${agg.errorCount} case(s) errored during eval:`);
    for (const r of errored) {
      console.error(`  [${r.id}] ${r.error}`);
    }
    console.error("\nFix the errors above before updating baseline or comparing against it.");
    process.exit(1);
  }

  const baselinePath = join(here, "baseline.json");
  const baseline: Baseline = { mrr: agg.mrr, perK: agg.perK, exactPassRate: agg.exactPassRate };

  if (updateBaseline) {
    writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + "\n");
    console.log("\nbaseline.json updated.");
    return;
  }

  if (!existsSync(baselinePath)) {
    console.error("\nNo baseline.json found. Run once with --update-baseline to create it.");
    process.exit(2);
  }

  const base = JSON.parse(readFileSync(baselinePath, "utf8")) as Baseline;
  const { regressed, lines } = diffBaseline(agg, base, 0.02);
  console.log("\nBaseline diff:\n" + lines.join("\n"));
  if (regressed) {
    console.error("\nFAIL: retrieval quality regressed beyond tolerance (0.02).");
    process.exit(1);
  }
  console.log("\nOK: no regression.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
