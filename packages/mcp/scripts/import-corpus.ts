/**
 * import-corpus — copy the local ato.sqlite corpus into Supabase Postgres.
 *
 * Usage:
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SECRET_KEY=sb_secret_... \
 *   pnpm --filter @ato-pro/mcp exec tsx scripts/import-corpus.ts \
 *     [--sqlite ~/Library/Application\ Support/ato-pro/live/ato.sqlite] \
 *     [--skip docs|chunks|anchors|definitions|thresholds] \
 *     [--batch 500]
 *
 * Idempotent for docs/chunks/anchors (upsert on PK). Definitions and
 * thresholds use BIGSERIAL PK so rerunning duplicates; truncate those
 * tables before rerunning if needed.
 */

import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import os from "node:os";
import path from "node:path";
import { argv, exit } from "node:process";

function arg(name: string, fallback?: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return argv[i + 1];
}

const DEFAULT_SQLITE = path.join(
  os.homedir(),
  "Library/Application Support/ato-pro/live/ato.sqlite",
);
const SQLITE = arg("sqlite", DEFAULT_SQLITE)!;
const BATCH = Number(arg("batch", "500"));
const SKIP = new Set((arg("skip", "") ?? "").split(",").filter(Boolean));

const SUPABASE_URL = process.env["SUPABASE_URL"];
const SUPABASE_SECRET = process.env["SUPABASE_SECRET_KEY"];
if (!SUPABASE_URL || !SUPABASE_SECRET) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY env var");
  exit(2);
}

console.log(`Reading SQLite: ${SQLITE}`);
const db = new Database(SQLITE, { readonly: true });
sqliteVec.load(db);

const sb = createClient(SUPABASE_URL, SUPABASE_SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function parseHeadingPath(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function isoDateOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function bytesToPgVector(buf: Buffer | Uint8Array | null): string | null {
  if (!buf || buf.byteLength === 0) return null;
  const arrayBuf = buf instanceof Buffer
    ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    : buf.buffer;
  const floats = new Float32Array(arrayBuf as ArrayBuffer);
  if (floats.length !== 384) {
    throw new Error(`Expected 384-dim embedding, got ${floats.length}`);
  }
  return `[${Array.from(floats).join(",")}]`;
}

async function chunked<T>(rows: T[], size: number, label: string, fn: (batch: T[]) => Promise<void>) {
  const total = rows.length;
  for (let i = 0; i < total; i += size) {
    const batch = rows.slice(i, i + size);
    const t0 = Date.now();
    await fn(batch);
    const dur = Date.now() - t0;
    const pct = Math.round(((i + batch.length) / total) * 100);
    console.log(`  ${label}: ${i + batch.length}/${total} (${pct}%) — batch ${dur}ms`);
  }
}

async function importDocs() {
  if (SKIP.has("docs")) return console.log("Skipping docs");
  console.log("Importing docs...");
  const rows = db.prepare(`
    SELECT doc_id, source, url, title, jurisdiction, doc_type,
           effective_from, effective_to, published_at, retrieved_at,
           metadata_json
    FROM docs
  `).all() as Array<{
    doc_id: string; source: string; url: string; title: string;
    jurisdiction: string; doc_type: string;
    effective_from: string | null; effective_to: string | null;
    published_at: string | null; retrieved_at: string;
    metadata_json: string;
  }>;
  console.log(`  read ${rows.length} docs`);

  const payload = rows.map(r => ({
    doc_id: r.doc_id,
    source: r.source,
    url: r.url,
    title: r.title,
    jurisdiction: r.jurisdiction,
    doc_type: r.doc_type,
    effective_from: isoDateOrNull(r.effective_from),
    effective_to: isoDateOrNull(r.effective_to),
    published_at: isoDateOrNull(r.published_at),
    retrieved_at: r.retrieved_at,
    metadata: r.metadata_json ? JSON.parse(r.metadata_json) : {},
  }));

  await chunked(payload, BATCH, "docs", async batch => {
    const { error } = await sb.from("docs").upsert(batch, { onConflict: "doc_id" });
    if (error) throw error;
  });
}

async function importChunks() {
  if (SKIP.has("chunks")) return console.log("Skipping chunks");
  console.log("Importing chunks (with embeddings)...");
  const totalRow = db.prepare("SELECT COUNT(*) AS n FROM chunks").get() as { n: number };
  const total = totalRow.n;
  console.log(`  ${total} chunks to import`);

  const pageSize = BATCH;
  let offset = 0;
  const stmt = db.prepare(`
    SELECT c.chunk_id, c.doc_id, c.ord, c.text, c.heading_path,
           c.effective_from, c.effective_to, c.char_start, c.char_end,
           v.embedding AS embedding
    FROM chunks c
    LEFT JOIN vec_chunks v ON v.chunk_id = c.chunk_id
    ORDER BY c.doc_id, c.ord
    LIMIT ? OFFSET ?
  `);

  while (offset < total) {
    const rows = stmt.all(pageSize, offset) as Array<{
      chunk_id: string; doc_id: string; ord: number; text: string;
      heading_path: string;
      effective_from: string | null; effective_to: string | null;
      char_start: number; char_end: number;
      embedding: Buffer | null;
    }>;
    if (rows.length === 0) break;

    const payload = rows.map(r => ({
      chunk_id: r.chunk_id,
      doc_id: r.doc_id,
      ord: r.ord,
      text: r.text,
      heading_path: parseHeadingPath(r.heading_path),
      effective_from: isoDateOrNull(r.effective_from),
      effective_to: isoDateOrNull(r.effective_to),
      char_start: r.char_start,
      char_end: r.char_end,
      embedding: bytesToPgVector(r.embedding),
    }));

    const t0 = Date.now();
    const { error } = await sb.from("chunks").upsert(payload, { onConflict: "chunk_id" });
    if (error) {
      console.error(`  batch at offset ${offset} failed:`, error.message);
      throw error;
    }
    const dur = Date.now() - t0;
    offset += rows.length;
    const pct = Math.round((offset / total) * 100);
    console.log(`  chunks: ${offset}/${total} (${pct}%) — batch ${dur}ms`);
  }
}

async function importAnchors() {
  if (SKIP.has("anchors")) return console.log("Skipping anchors");
  console.log("Importing anchors...");
  const rows = db.prepare("SELECT anchor_id, doc_id, anchor_name, chunk_id FROM anchors").all() as Array<{
    anchor_id: string; doc_id: string; anchor_name: string; chunk_id: string;
  }>;
  console.log(`  read ${rows.length} anchors`);

  await chunked(rows, BATCH, "anchors", async batch => {
    const { error } = await sb.from("anchors").upsert(batch, { onConflict: "anchor_id" });
    if (error) throw error;
  });
}

async function importDefinitions() {
  if (SKIP.has("definitions")) return console.log("Skipping definitions");
  console.log("Importing definitions...");
  const rows = db.prepare(`
    SELECT term, doc_id, anchor_id, body, effective_from, effective_to
    FROM definitions
  `).all() as Array<{
    term: string; doc_id: string; anchor_id: string | null; body: string;
    effective_from: string | null; effective_to: string | null;
  }>;
  console.log(`  read ${rows.length} definitions`);

  const payload = rows.map(r => ({
    term: r.term,
    doc_id: r.doc_id,
    anchor_id: r.anchor_id,
    body: r.body,
    effective_from: isoDateOrNull(r.effective_from),
    effective_to: isoDateOrNull(r.effective_to),
  }));

  await chunked(payload, BATCH, "definitions", async batch => {
    const { error } = await sb.from("definitions").insert(batch);
    if (error) throw error;
  });
}

async function importThresholds() {
  if (SKIP.has("thresholds")) return console.log("Skipping thresholds");
  console.log("Importing thresholds...");
  const rows = db.prepare(`
    SELECT name, value, unit, effective_from, effective_to, source_doc_id, source_anchor
    FROM thresholds
  `).all() as Array<{
    name: string; value: number; unit: string;
    effective_from: string | null; effective_to: string | null;
    source_doc_id: string | null; source_anchor: string | null;
  }>;
  console.log(`  read ${rows.length} thresholds`);

  const payload = rows.map(r => ({
    name: r.name,
    value: r.value,
    unit: r.unit,
    effective_from: isoDateOrNull(r.effective_from),
    effective_to: isoDateOrNull(r.effective_to),
    source_doc_id: r.source_doc_id,
    source_anchor: r.source_anchor,
  }));

  await chunked(payload, BATCH, "thresholds", async batch => {
    const { error } = await sb.from("thresholds").insert(batch);
    if (error) throw error;
  });
}

async function main() {
  const t0 = Date.now();
  await importDocs();
  await importChunks();
  await importAnchors();
  await importDefinitions();
  await importThresholds();
  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nDone in ${dur}s`);
  db.close();
}

main().catch(e => {
  console.error("FAIL:", e);
  db.close();
  exit(1);
});
