import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readVersion } from "../src/index.js";

const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");
const cliEntry = fileURLToPath(new URL("../src/cli.ts", import.meta.url));

function run(...args: string[]) {
  const result = spawnSync(process.execPath, [tsxCli, cliEntry, ...args], {
    encoding: "utf8",
    env: { ...process.env, ATO_MCP_URL: "http://127.0.0.1:9/mcp" },
    timeout: 20_000,
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("ato-mcp CLI", () => {
  it("prints help and exits 0", () => {
    for (const flag of ["help", "--help", "-h"]) {
      const { code, stdout } = run(flag);
      expect(code).toBe(0);
      expect(stdout).toContain("https://api.ato-mcp.com.au/mcp");
      expect(stdout).toContain("ato-mcp.com.au/install");
    }
  });

  it("prints the package version and exits 0", () => {
    for (const flag of ["version", "--version", "-v"]) {
      const { code, stdout } = run(flag);
      expect(code).toBe(0);
      expect(stdout.trim()).toBe(readVersion());
    }
  });

  it("rejects unknown commands with exit 2 and never starts the proxy", () => {
    const { code, stderr } = run("bogus");
    expect(code).toBe(2);
    expect(stderr).toContain("Unknown command: bogus");
    expect(stderr).toContain("ato-mcp help");
  });
});

describe("library entrypoint", () => {
  it("has no side effects on import", () => {
    // Importing index.ts must not spawn the proxy; run it in a child so a
    // regression can't hang or hit the network from inside the test worker.
    const indexEntry = fileURLToPath(new URL("../src/index.ts", import.meta.url));
    const result = spawnSync(
      process.execPath,
      [tsxCli, "--eval", `import(${JSON.stringify(indexEntry)}).then(() => process.stdout.write("ok"))`],
      { encoding: "utf8", timeout: 20_000 },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("ok");
    expect(result.stderr).toBe("");
  });

  it("reports a semver version", () => {
    expect(readVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
