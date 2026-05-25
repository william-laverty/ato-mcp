import type { Store } from "../store/types.js";
import { corpusPath, dataDir } from "../lib/paths.js";
import fs from "node:fs";

export interface StatsArgs {
  store: Store | null;
}

export interface StatsOutput {
  installed: boolean;
  schema_version: string | null;
  docs: number;
  chunks: number;
  data_dir: string;
  corpus_path: string;
  staleness_days: number | null;
}

export async function stats(args: StatsArgs): Promise<StatsOutput> {
  if (!args.store) {
    return {
      installed: false,
      schema_version: null,
      docs: 0,
      chunks: 0,
      data_dir: dataDir(),
      corpus_path: corpusPath(),
      staleness_days: null,
    };
  }
  const s = await args.store.stats();
  return {
    installed: s.installed,
    schema_version: s.schema_version,
    docs: s.docs,
    chunks: s.chunks,
    data_dir: dataDir(),
    corpus_path: corpusPath(),
    staleness_days: s.staleness_days,
  };
}

/** Used by the `ato-pro-mcp stats` CLI command. */
export async function statsCli(): Promise<StatsOutput> {
  const path = corpusPath();
  if (!fs.existsSync(path)) return stats({ store: null });
  const { SqliteStore } = await import("../store/sqlite.js");
  const store = new SqliteStore(path);
  try {
    return await stats({ store });
  } finally {
    store.close();
  }
}
