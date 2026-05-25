import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { SqliteStore } from "../../src/store/sqlite.js";

const SCHEMA_SQL = `
  CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE docs(
    doc_id TEXT PRIMARY KEY, source TEXT NOT NULL, url TEXT NOT NULL, title TEXT NOT NULL,
    jurisdiction TEXT NOT NULL DEFAULT 'AU', doc_type TEXT NOT NULL,
    effective_from TEXT, effective_to TEXT, published_at TEXT, retrieved_at TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE chunks(
    chunk_id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    ord INTEGER NOT NULL,
    text TEXT NOT NULL,
    heading_path TEXT NOT NULL DEFAULT '[]',
    effective_from TEXT, effective_to TEXT,
    char_start INTEGER NOT NULL DEFAULT 0,
    char_end INTEGER NOT NULL DEFAULT 0
  );
  CREATE VIRTUAL TABLE vec_chunks USING vec0(chunk_id TEXT PRIMARY KEY, embedding FLOAT[384]);
  CREATE VIRTUAL TABLE fts_chunks USING fts5(chunk_id UNINDEXED, text, tokenize='porter unicode61');
  CREATE TABLE anchors(
    anchor_id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    anchor_name TEXT NOT NULL,
    chunk_id TEXT NOT NULL
  );
  CREATE INDEX idx_anchors_doc ON anchors(doc_id);
  CREATE TABLE citations(
    from_chunk_id TEXT NOT NULL,
    to_doc_id TEXT NOT NULL,
    to_anchor TEXT,
    citation_kind TEXT NOT NULL,
    PRIMARY KEY (from_chunk_id, to_doc_id, to_anchor, citation_kind)
  );
  CREATE INDEX idx_citations_from ON citations(from_chunk_id);
  CREATE INDEX idx_citations_to ON citations(to_doc_id);
  CREATE TABLE definitions(
    term TEXT NOT NULL,
    doc_id TEXT NOT NULL,
    anchor_id TEXT,
    body TEXT NOT NULL,
    effective_from TEXT,
    effective_to TEXT,
    PRIMARY KEY (term, doc_id, effective_from)
  );
  CREATE INDEX idx_definitions_term ON definitions(term);
  CREATE TABLE thresholds(
    name TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    effective_from TEXT,
    effective_to TEXT,
    source_doc_id TEXT,
    source_anchor TEXT,
    PRIMARY KEY (name, effective_from)
  );
  CREATE INDEX idx_thresholds_name ON thresholds(name);
`;

export function makeStore(seedSqlPath: string, embeddings?: Map<string, Float32Array>): SqliteStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atotest-"));
  const dbPath = path.join(dir, "test.sqlite");
  const db = new Database(dbPath);
  sqliteVec.load(db);
  db.exec(SCHEMA_SQL);
  const seed = fs.readFileSync(seedSqlPath, "utf8");
  db.exec(seed);
  // Insert deterministic embeddings (or zeros) for each chunk
  const chunks = db.prepare("SELECT chunk_id FROM chunks").all() as { chunk_id: string }[];
  const insertVec = db.prepare("INSERT INTO vec_chunks(chunk_id, embedding) VALUES (?, ?)");
  for (const { chunk_id } of chunks) {
    const vec = embeddings?.get(chunk_id) ?? new Float32Array(384);
    if (!embeddings) {
      // simple deterministic vector: hash(chunk_id) seeded
      let seed = 0;
      for (const ch of chunk_id) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
      for (let i = 0; i < 384; i++) vec[i] = Math.sin(seed + i) * 0.05;
      // normalise
      let norm = 0;
      for (let i = 0; i < 384; i++) norm += vec[i] * vec[i];
      norm = Math.sqrt(norm) || 1;
      for (let i = 0; i < 384; i++) vec[i] /= norm;
    }
    insertVec.run(chunk_id, Buffer.from(vec.buffer));
  }
  db.close();
  return new SqliteStore(dbPath);
}
