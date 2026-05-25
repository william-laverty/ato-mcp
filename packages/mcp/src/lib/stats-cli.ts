import fs from "node:fs";
import { stats } from "@ato-pro/shared/tools/stats";
import { corpusPath, dataDir } from "./paths.js";

export async function statsCli() {
  const path = corpusPath();
  if (!fs.existsSync(path)) return stats({ store: null, data_dir: dataDir(), corpus_path: path });
  const { SqliteStore } = await import("../store/sqlite.js");
  const store = new SqliteStore(path);
  try {
    return await stats({ store, data_dir: dataDir(), corpus_path: path });
  } finally {
    store.close();
  }
}
