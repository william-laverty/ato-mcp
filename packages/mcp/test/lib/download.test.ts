import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { installFromLocalFile } from "../../src/lib/download.js";

describe("installFromLocalFile", () => {
  let dataDir: string;
  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "atotest-install-"));
  });

  it("atomically copies a corpus file into <dataDir>/live/ato.sqlite", async () => {
    const srcPath = path.join(dataDir, "src.sqlite");
    fs.writeFileSync(srcPath, "hello sqlite");
    await installFromLocalFile(srcPath, dataDir);
    const dst = path.join(dataDir, "live", "ato.sqlite");
    expect(fs.existsSync(dst)).toBe(true);
    expect(fs.readFileSync(dst, "utf8")).toBe("hello sqlite");
  });

  it("refuses to install a non-existent file", async () => {
    await expect(installFromLocalFile("/no/such/file", dataDir)).rejects.toThrow(/not found/i);
  });
});
