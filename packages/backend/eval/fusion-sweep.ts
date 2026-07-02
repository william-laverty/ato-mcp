// Offline hybrid-fusion sweep: fetches keyword + vector lists once per golden
// search case (overfetch 100), then fuses in-memory across a parameter grid.
// Run: tsx eval/fusion-sweep.ts   (needs OPENAI_API_KEY + Supabase env)
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { rrfFuse } from "@ato-mcp/shared/lib/rrf";
import type { SearchHit } from "@ato-mcp/shared";
import { SupabaseStore } from "../src/supabase-store.js";
import { OpenAIEmbedder } from "../src/openai-embedder.js";
import { loadGolden } from "./golden-schema.js";
import { extractRankedDocs } from "./runner.js";

const here = dirname(fileURLToPath(import.meta.url));
const FETCH_N = Number(process.env["FETCH_N"] ?? 100);

interface CaseLists {
  expected: string[];
  kw: SearchHit[];
  vec: SearchHit[];
}

function score(cases: CaseLists[], w: number, rrfK: number, of: number) {
  let hit5 = 0,
    hit10 = 0,
    mrr = 0;
  for (const c of cases) {
    // Mirror the serving path + eval exactly: fuse, slice to k=10 CHUNKS
    // (duplicate-doc chunks consume slots), then dedupe to ranked docs.
    const fused = rrfFuse([c.kw.slice(0, of), c.vec.slice(0, of)], (h) => h.chunk_id, rrfK, [1, w]).slice(0, 10);
    const ranked = extractRankedDocs(fused, 10);
    const rank = ranked.findIndex((d) => c.expected.includes(d));
    if (rank >= 0 && rank < 5) hit5++;
    if (rank >= 0) {
      hit10++;
      mrr += 1 / (rank + 1);
    }
  }
  const n = cases.length;
  return { r5: hit5 / n, r10: hit10 / n, mrr: mrr / n };
}

async function main(): Promise<void> {
  const golden = loadGolden(join(here, "golden.json")).filter((c) => c.kind === "search");
  const store = new SupabaseStore();
  const embedder = await OpenAIEmbedder.load();

  const cases: CaseLists[] = [];
  for (const c of golden) {
    if (c.kind !== "search") continue;
    const [kw, vec] = await Promise.all([
      store.keywordSearch(c.query, FETCH_N),
      embedder.embed(c.query).then((v) => store.vectorSearch(v, FETCH_N)),
    ]);
    cases.push({ expected: c.expected_docs, kw, vec });
    process.stdout.write(".");
  }
  process.stdout.write("\n");

  console.log(`n=${cases.length}  (fused in-memory)\n`);
  console.log("w      rrfK  of    recall@5  recall@10  MRR");
  for (const w of [1, 1.5, 2, 3, 5]) {
    for (const rrfK of [20, 60]) {
      for (const of of [30, 50, 100]) {
        const s = score(cases, w, rrfK, of);
        console.log(
          `${String(w).padEnd(6)} ${String(rrfK).padEnd(5)} ${String(of).padEnd(5)} ` +
            `${s.r5.toFixed(3)}     ${s.r10.toFixed(3)}      ${s.mrr.toFixed(3)}`,
        );
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
