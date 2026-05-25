import { describe, it, expect, beforeEach, afterEach } from "vitest";
import os from "node:os";
import path from "node:path";
import { dataDir, corpusPath, configPath } from "../../src/lib/paths.js";

describe("paths", () => {
  const ORIG_ENV = process.env.ATO_PRO_DATA_DIR;

  beforeEach(() => {
    delete process.env.ATO_PRO_DATA_DIR;
  });

  afterEach(() => {
    if (ORIG_ENV) process.env.ATO_PRO_DATA_DIR = ORIG_ENV;
  });

  it("returns the platform-default data dir on linux/macOS/windows", () => {
    const got = dataDir();
    expect(typeof got).toBe("string");
    expect(got.length).toBeGreaterThan(0);
  });

  it("honours ATO_PRO_DATA_DIR env override", () => {
    process.env.ATO_PRO_DATA_DIR = "/tmp/atotest";
    expect(dataDir()).toBe("/tmp/atotest");
    expect(corpusPath()).toBe(path.join("/tmp/atotest", "live", "ato.sqlite"));
    expect(configPath()).toBe(path.join("/tmp/atotest", "config.json"));
  });
});
