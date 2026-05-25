import fs from "node:fs";
import path from "node:path";
import { dataDir as defaultDataDir } from "./paths.js";

export async function installFromLocalFile(srcPath: string, dataDir?: string): Promise<string> {
  if (!fs.existsSync(srcPath)) throw new Error(`Source corpus file not found: ${srcPath}`);
  const dir = dataDir ?? defaultDataDir();
  const liveDir = path.join(dir, "live");
  fs.mkdirSync(liveDir, { recursive: true });
  const dstPath = path.join(liveDir, "ato.sqlite");
  const tmpPath = path.join(liveDir, `ato.sqlite.tmp.${process.pid}`);
  fs.copyFileSync(srcPath, tmpPath);
  fs.renameSync(tmpPath, dstPath);
  return dstPath;
}

export async function runUpdate(): Promise<void> {
  const arg = process.argv[3];
  if (!arg || arg === "--help" || arg === "-h") {
    process.stdout.write(`Usage: ato-pro-mcp update <path-to-local-corpus.sqlite>

v0.1 only supports installing from a locally-built corpus file. The Python
pipeline at packages/pipeline produces this file:

  cd packages/pipeline && uv run ato-pipeline build --out-dir corpus-out

Then:

  ato-pro-mcp update ./packages/pipeline/corpus-out/ato.sqlite

v0.2 will add download-from-GitHub-release.
`);
    return;
  }
  const dst = await installFromLocalFile(arg);
  process.stdout.write(`Installed corpus to ${dst}\n`);
}
