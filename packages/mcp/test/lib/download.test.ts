import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { installFromLocalFile, fetchLatestRelease, runUpdateFromGitHub } from "../../src/lib/download.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal fake GitHub releases/latest response. */
function fakeRelease(extraAssets: Array<{ name: string; browser_download_url: string }> = []) {
  return {
    tag_name: "v0.2.2026.05",
    assets: [
      {
        name: "ato-corpus-v2026.05.sqlite.zst",
        browser_download_url: "https://github.example.com/releases/download/v0.2.2026.05/ato-corpus-v2026.05.sqlite.zst",
      },
      {
        name: "manifest.json",
        browser_download_url: "https://github.example.com/releases/download/v0.2.2026.05/manifest.json",
      },
      ...extraAssets,
    ],
  };
}

/** Build a manifest whose corpus_sha256 matches the provided bytes. */
function fakeManifest(corpusBytes: Uint8Array) {
  return {
    schema_version: "0.2.0",
    generated_at: "2026-05-01T03:00:00Z",
    embedding_model: "ibm-granite/granite-embedding-small-english-r2",
    embedding_dim: 384,
    corpus_sha256: crypto.createHash("sha256").update(corpusBytes).digest("hex"),
    uncompressed_size: corpusBytes.length,
    compressed_size: 50,
  };
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// installFromLocalFile (existing tests — must stay green)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// fetchLatestRelease
// ---------------------------------------------------------------------------

describe("fetchLatestRelease", () => {
  it("returns corpus_url, manifest_url, and parsed manifest", async () => {
    const corpusBytes = new TextEncoder().encode("fake corpus data");
    const manifest = fakeManifest(corpusBytes);
    const release = fakeRelease();

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(release), { status: 200, headers: { "content-type": "application/json" } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(manifest), { status: 200, headers: { "content-type": "application/json" } }),
      ) as unknown as typeof fetch;

    const result = await fetchLatestRelease("williaml/ato-mcp");
    expect(result.corpus_url).toContain("ato-corpus-v2026.05.sqlite.zst");
    expect(result.manifest.embedding_model).toBe("ibm-granite/granite-embedding-small-english-r2");
  });

  it("throws on 403 with rate-limit message", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response("rate limited", { status: 403 }),
    ) as unknown as typeof fetch;

    await expect(fetchLatestRelease("williaml/ato-mcp")).rejects.toThrow(/rate.limit/i);
  });

  it("throws when corpus asset is missing", async () => {
    const manifest = fakeManifest(new TextEncoder().encode("x"));
    const releaseNoCorpus = {
      tag_name: "v0.2.2026.05",
      assets: [
        {
          name: "manifest.json",
          browser_download_url: "https://github.example.com/manifest.json",
        },
      ],
    };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(releaseNoCorpus), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(manifest), { status: 200 }),
      ) as unknown as typeof fetch;

    await expect(fetchLatestRelease("williaml/ato-mcp")).rejects.toThrow(/missing a corpus asset/i);
  });

  it("throws when manifest.json asset is missing", async () => {
    const releaseNoManifest = {
      tag_name: "v0.2.2026.05",
      assets: [
        {
          name: "ato-corpus-v2026.05.sqlite.zst",
          browser_download_url: "https://github.example.com/corpus.zst",
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(releaseNoManifest), { status: 200 }),
    ) as unknown as typeof fetch;

    await expect(fetchLatestRelease("williaml/ato-mcp")).rejects.toThrow(/missing manifest/i);
  });

  it("throws on non-200 GitHub API response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response("Not Found", { status: 404 }),
    ) as unknown as typeof fetch;

    await expect(fetchLatestRelease("williaml/ato-mcp")).rejects.toThrow(/404/);
  });
});

// ---------------------------------------------------------------------------
// runUpdateFromGitHub — mocked end-to-end
// ---------------------------------------------------------------------------

describe("runUpdateFromGitHub", () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "atotest-ghupdate-"));
  });

  /**
   * Build a tiny valid-looking zst file using the zstd CLI (if available),
   * otherwise skip the full roundtrip test.
   */
  async function makeZst(content: Uint8Array): Promise<{ zstBytes: Uint8Array; sha256: string }> {
    const tmpIn = path.join(os.tmpdir(), `ghtest-in-${process.pid}.bin`);
    const tmpOut = `${tmpIn}.zst`;
    fs.writeFileSync(tmpIn, content);
    const { execFileSync } = await import("node:child_process");
    execFileSync("zstd", ["-19", tmpIn, "-o", tmpOut, "--force"], { stdio: "ignore" });
    const zstBytes = fs.readFileSync(tmpOut);
    fs.unlinkSync(tmpIn);
    fs.unlinkSync(tmpOut);
    const sha256 = crypto.createHash("sha256").update(content).digest("hex");
    return { zstBytes, sha256 };
  }

  it("installs corpus to live/ato.sqlite and writes installed_manifest.json", async () => {
    // Build a tiny compressed corpus
    const corpusContent = new TextEncoder().encode("tiny corpus bytes");
    let zstBytes: Uint8Array;
    let sha256: string;
    try {
      ({ zstBytes, sha256 } = await makeZst(corpusContent));
    } catch {
      // zstd not available — skip decompression roundtrip
      return;
    }

    const manifest = {
      schema_version: "0.2.0",
      generated_at: "2026-05-01T03:00:00Z",
      embedding_model: "ibm-granite/granite-embedding-small-english-r2",
      embedding_dim: 384,
      corpus_sha256: sha256,
      uncompressed_size: corpusContent.length,
      compressed_size: zstBytes.length,
    };

    const release = fakeRelease();

    globalThis.fetch = vi.fn()
      // 1. GitHub API
      .mockResolvedValueOnce(
        new Response(JSON.stringify(release), { status: 200, headers: { "content-type": "application/json" } }),
      )
      // 2. manifest.json download
      .mockResolvedValueOnce(
        new Response(JSON.stringify(manifest), { status: 200, headers: { "content-type": "application/json" } }),
      )
      // 3. corpus .zst download — must return a ReadableStream of bytes
      .mockResolvedValueOnce(
        new Response(zstBytes, { status: 200, headers: { "content-type": "application/octet-stream" } }),
      ) as unknown as typeof fetch;

    const origRepo = process.env.ATO_MCP_RELEASE_REPO;
    process.env.ATO_MCP_RELEASE_REPO = "williaml/ato-mcp";
    try {
      await runUpdateFromGitHub(dataDir);
    } finally {
      if (origRepo === undefined) delete process.env.ATO_MCP_RELEASE_REPO;
      else process.env.ATO_MCP_RELEASE_REPO = origRepo;
    }

    const livePath = path.join(dataDir, "live", "ato.sqlite");
    expect(fs.existsSync(livePath)).toBe(true);
    expect(fs.readFileSync(livePath)).toEqual(Buffer.from(corpusContent));

    const manifestPath = path.join(dataDir, "installed_manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(saved.corpus_sha256).toBe(sha256);
  });

  it("throws on sha256 mismatch", async () => {
    // Build a tiny zst file whose sha256 we will lie about in the manifest
    const corpusContent = new TextEncoder().encode("mismatch bytes");
    let zstBytes: Uint8Array;
    try {
      ({ zstBytes } = await makeZst(corpusContent));
    } catch {
      return; // zstd not available
    }

    const manifest = {
      schema_version: "0.2.0",
      generated_at: "2026-05-01T03:00:00Z",
      embedding_model: "ibm-granite/granite-embedding-small-english-r2",
      embedding_dim: 384,
      corpus_sha256: "0000000000000000000000000000000000000000000000000000000000000000",
      uncompressed_size: corpusContent.length,
      compressed_size: zstBytes.length,
    };

    const release = fakeRelease();

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(release), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(manifest), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(zstBytes, { status: 200 }),
      ) as unknown as typeof fetch;

    process.env.ATO_MCP_RELEASE_REPO = "williaml/ato-mcp";
    await expect(runUpdateFromGitHub(dataDir)).rejects.toThrow(/sha256 mismatch/i);
    delete process.env.ATO_MCP_RELEASE_REPO;
  });

  it("throws when embedding model does not match", async () => {
    const corpusContent = new TextEncoder().encode("model mismatch");
    let zstBytes: Uint8Array;
    let sha256: string;
    try {
      ({ zstBytes, sha256 } = await makeZst(corpusContent));
    } catch {
      return; // zstd not available
    }

    const manifest = {
      schema_version: "0.2.0",
      generated_at: "2026-05-01T03:00:00Z",
      embedding_model: "openai/text-embedding-3-small",  // wrong model
      embedding_dim: 1536,
      corpus_sha256: sha256,
      uncompressed_size: corpusContent.length,
      compressed_size: zstBytes.length,
    };

    const release = fakeRelease();

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(release), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(manifest), { status: 200 })) as unknown as typeof fetch;

    process.env.ATO_MCP_RELEASE_REPO = "williaml/ato-mcp";
    await expect(runUpdateFromGitHub(dataDir)).rejects.toThrow(/embedding model mismatch/i);
    delete process.env.ATO_MCP_RELEASE_REPO;
  });
});
