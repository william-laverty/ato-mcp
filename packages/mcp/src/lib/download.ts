import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { dataDir as defaultDataDir } from "./paths.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXPECTED_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const DEFAULT_RELEASE_REPO = "william-laverty/ato-mcp";
const CORPUS_ASSET_RE = /^ato-corpus-v.*\.sqlite\.zst$/;

// ---------------------------------------------------------------------------
// installFromLocalFile — unchanged from v0.1
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// GitHub release helpers
// ---------------------------------------------------------------------------

export interface ReleaseAssets {
  corpus_url: string;
  manifest_url: string;
  manifest: Record<string, unknown>;
  /** Extra headers required to download the corpus asset (private repos). */
  corpus_headers?: Record<string, string>;
}

interface GithubRelease {
  tag_name?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets: Array<{ name: string; browser_download_url: string; url?: string }>;
}

/**
 * Pick the download URL + headers for a release asset. Public repos serve
 * `browser_download_url` unauthenticated; private repos (self-hosted forks via
 * ATO_MCP_RELEASE_REPO) require the asset *API* URL with a token and an
 * octet-stream Accept header.
 */
function assetRequest(asset: { browser_download_url: string; url?: string }): {
  url: string;
  headers: Record<string, string>;
} {
  const token = process.env.GH_TOKEN;
  if (token && asset.url) {
    return {
      url: asset.url,
      headers: {
        "User-Agent": "ato-mcp",
        Accept: "application/octet-stream",
        Authorization: `Bearer ${token}`,
      },
    };
  }
  return { url: asset.browser_download_url, headers: { "User-Agent": "ato-mcp" } };
}

/**
 * Find the newest GitHub release that actually carries a corpus asset and
 * return corpus + manifest download URLs.
 *
 * Deliberately NOT `releases/latest`: this repository also publishes software
 * releases (v1.x.x) that carry no corpus, and corpus releases must keep
 * resolving regardless of which release is marked "latest".
 */
export async function fetchLatestRelease(repo: string): Promise<ReleaseAssets> {
  const apiUrl = `https://api.github.com/repos/${repo}/releases?per_page=30`;
  const headers: Record<string, string> = {
    "User-Agent": "ato-mcp",
    Accept: "application/vnd.github+json",
  };
  if (process.env.GH_TOKEN) headers["Authorization"] = `Bearer ${process.env.GH_TOKEN}`;

  const resp = await fetch(apiUrl, { headers });
  if (!resp.ok) {
    if (resp.status === 403 || resp.status === 429) {
      throw new Error(
        `GitHub API rate-limited (${resp.status}). Set GH_TOKEN env var to authenticate.`,
      );
    }
    throw new Error(`GitHub API returned ${resp.status} for ${apiUrl}`);
  }

  const releases = (await resp.json()) as GithubRelease[];
  // Releases are returned newest-first; take the first non-draft release with
  // both a corpus asset and its manifest.
  const release = releases.find(
    (r) =>
      !r.draft &&
      r.assets.some((a) => CORPUS_ASSET_RE.test(a.name)) &&
      r.assets.some((a) => a.name === "manifest.json"),
  );
  if (!release) {
    throw new Error(
      `No release in ${repo} contains a corpus asset matching ${CORPUS_ASSET_RE} ` +
        `plus manifest.json. Releases seen: ${releases.map((r) => r.tag_name).join(", ") || "(none)"}`,
    );
  }

  const corpusAsset = release.assets.find((a) => CORPUS_ASSET_RE.test(a.name))!;
  const manifestAsset = release.assets.find((a) => a.name === "manifest.json")!;

  const manifestReq = assetRequest(manifestAsset);
  const manifestResp = await fetch(manifestReq.url, { headers: manifestReq.headers });
  if (!manifestResp.ok) {
    throw new Error(`Failed to download manifest.json: ${manifestResp.status}`);
  }
  const manifest = (await manifestResp.json()) as Record<string, unknown>;

  const corpusReq = assetRequest(corpusAsset);
  return {
    corpus_url: corpusReq.url,
    manifest_url: manifestReq.url,
    manifest,
    corpus_headers: corpusReq.headers,
  };
}

/** Stream *url* to *destPath*. */
async function streamDownload(
  url: string,
  destPath: string,
  headers: Record<string, string> = {},
): Promise<void> {
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    throw new Error(`Failed to download ${url}: ${resp.status}`);
  }
  if (!resp.body) {
    throw new Error(`Response body is null for ${url}`);
  }

  const writer = fs.createWriteStream(destPath);

  const reader = resp.body.getReader();
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await new Promise<void>((resolve, reject) => {
        writer.write(value, (err) => (err ? reject(err) : resolve()));
      });
    }
  } finally {
    reader.releaseLock();
    await new Promise<void>((resolve, reject) => {
      writer.end((err: unknown) => (err ? reject(err) : resolve()));
    });
  }
}

/** Compute sha256 hex digest of a file on disk. */
function sha256File(filePath: string): string {
  const hash = crypto.createHash("sha256");
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest("hex");
}

/** Decompress a .zst file to *outPath* using the system `zstd` binary. */
function decompressZst(zstPath: string, outPath: string): void {
  try {
    execFileSync("zstd", ["-d", zstPath, "-o", outPath, "--force"], {
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      throw new Error(
        "`zstd` binary not found. Install it (e.g. `brew install zstd` / `apt install zstd`) " +
          "and try again.",
      );
    }
    throw new Error(`zstd decompression failed: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// runUpdateFromGitHub
// ---------------------------------------------------------------------------

/**
 * Download the latest corpus release from GitHub, verify sha256, decompress,
 * and atomic-rename into the live directory.
 *
 * Writes `<dataDir>/installed_manifest.json` on success.
 */
export async function runUpdateFromGitHub(dataDir?: string): Promise<void> {
  const repo = process.env.ATO_MCP_RELEASE_REPO ?? DEFAULT_RELEASE_REPO;
  const dir = dataDir ?? defaultDataDir();

  process.stdout.write(`Fetching latest release from github.com/${repo} ...\n`);
  const { corpus_url, manifest, corpus_headers } = await fetchLatestRelease(repo);

  // Validate embedding model compatibility
  const manifestModel = manifest["embedding_model"] as string | undefined;
  if (manifestModel && manifestModel !== EXPECTED_EMBEDDING_MODEL) {
    throw new Error(
      `Embedding model mismatch: manifest has "${manifestModel}" but this MCP server ` +
        `requires "${EXPECTED_EMBEDDING_MODEL}". Refusing to install incompatible corpus.`,
    );
  }

  const expectedSha = manifest["corpus_sha256"] as string | undefined;
  if (!expectedSha) {
    throw new Error("manifest.json is missing corpus_sha256 field.");
  }

  // Set up staging directory
  const stagingDir = path.join(dir, "staging");
  fs.mkdirSync(stagingDir, { recursive: true });
  const zstStagingPath = path.join(stagingDir, "ato.sqlite.zst");
  const sqliteStagingPath = path.join(stagingDir, "ato.sqlite");

  // Clean up any previous staging artefacts
  for (const p of [zstStagingPath, sqliteStagingPath]) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  // Download compressed corpus
  process.stdout.write(`Downloading corpus from ${corpus_url} ...\n`);
  await streamDownload(corpus_url, zstStagingPath, corpus_headers);

  // Decompress first, then verify sha256 of uncompressed bytes
  // (corpus_sha256 in manifest is of the uncompressed SQLite, not the .zst)
  process.stdout.write("Decompressing corpus ...\n");
  decompressZst(zstStagingPath, sqliteStagingPath);
  fs.unlinkSync(zstStagingPath);

  // Verify sha256 of uncompressed SQLite
  const actualSha = sha256File(sqliteStagingPath);
  if (actualSha !== expectedSha) {
    fs.unlinkSync(sqliteStagingPath);
    throw new Error(
      `sha256 mismatch: expected ${expectedSha} but got ${actualSha}. ` +
        `Download may be corrupt.`,
    );
  }
  process.stdout.write(`sha256 verified: ${actualSha}\n`);

  // Atomic rename into live/
  const liveDir = path.join(dir, "live");
  fs.mkdirSync(liveDir, { recursive: true });
  const livePath = path.join(liveDir, "ato.sqlite");
  const tmpLivePath = path.join(liveDir, `ato.sqlite.tmp.${process.pid}`);
  fs.renameSync(sqliteStagingPath, tmpLivePath);
  fs.renameSync(tmpLivePath, livePath);

  // Write installed_manifest.json
  const manifestPath = path.join(dir, "installed_manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  process.stdout.write(`Corpus installed to ${livePath}\n`);
  process.stdout.write(`Manifest written to ${manifestPath}\n`);
}

// ---------------------------------------------------------------------------
// runUpdate — dispatcher
// ---------------------------------------------------------------------------

export async function runUpdate(): Promise<void> {
  const arg = process.argv[3];
  if (arg && arg !== "--help" && arg !== "-h") {
    // Explicit path provided — local install (v0.1 behaviour)
    const dst = await installFromLocalFile(arg);
    process.stdout.write(`Installed corpus to ${dst}\n`);
    return;
  }
  if (!arg || arg === "--help" || arg === "-h") {
    // No arg at all → GitHub update (v0.2)
    if (!arg) {
      await runUpdateFromGitHub();
      return;
    }
    process.stdout.write(`Usage: ato-mcp update [path-to-local-corpus.sqlite]

Without a path argument, downloads the latest corpus release from GitHub.
With a path argument, installs directly from a locally-built corpus file.

The Python pipeline at packages/pipeline produces a local corpus file:

  cd packages/pipeline && uv run ato-pipeline build --out-dir corpus-out

Then:

  ato-mcp update ./packages/pipeline/corpus-out/ato.sqlite

Or to download latest from GitHub:

  ato-mcp update

Set ATO_MCP_RELEASE_REPO=owner/repo to use a custom release repository.
Set GH_TOKEN to avoid GitHub API rate-limits.
`);
  }
}
