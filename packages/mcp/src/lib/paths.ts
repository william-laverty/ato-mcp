import os from "node:os";
import path from "node:path";

function defaultDataDir(): string {
  const home = os.homedir();
  const platform = process.platform;
  if (platform === "darwin") return path.join(home, "Library", "Application Support", "ato-mcp");
  if (platform === "win32") return path.join(process.env.APPDATA ?? path.join(home, "AppData", "Roaming"), "ato-mcp");
  return path.join(process.env.XDG_DATA_HOME ?? path.join(home, ".local", "share"), "ato-mcp");
}

export function dataDir(): string {
  return process.env.ATO_MCP_DATA_DIR || defaultDataDir();
}

export function corpusPath(): string {
  return path.join(dataDir(), "live", "ato.sqlite");
}

export function configPath(): string {
  return path.join(dataDir(), "config.json");
}
