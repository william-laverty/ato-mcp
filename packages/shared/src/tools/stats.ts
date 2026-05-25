import type { Store } from "../store/types.js";

export interface StatsArgs {
  store: Store | null;
  data_dir?: string;
  corpus_path?: string;
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
  const data_dir = args.data_dir ?? "";
  const corpus_path = args.corpus_path ?? "";
  if (!args.store) {
    return {
      installed: false,
      schema_version: null,
      docs: 0,
      chunks: 0,
      data_dir,
      corpus_path,
      staleness_days: null,
    };
  }
  const s = await args.store.stats();
  return {
    installed: s.installed,
    schema_version: s.schema_version,
    docs: s.docs,
    chunks: s.chunks,
    data_dir,
    corpus_path,
    staleness_days: s.staleness_days,
  };
}
