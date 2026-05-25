import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import type { SearchHit } from "@ato-pro/shared";
import type { Store } from "./types.js";

interface ChunkRow {
  chunk_id: string;
  doc_id: string;
  ord: number;
  text: string;
  heading_path: string;
  title: string;
  url: string;
  doc_type: string;
}

export class SqliteStore implements Store {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { readonly: true, fileMustExist: true });
    sqliteVec.load(this.db);
    this.db.pragma("query_only = ON");
  }

  async stats() {
    const sv = this.db.prepare("SELECT value FROM meta WHERE key='schema_version'").get() as { value?: string } | undefined;
    const docs = this.db.prepare("SELECT COUNT(*) as c FROM docs").get() as { c: number };
    const chunks = this.db.prepare("SELECT COUNT(*) as c FROM chunks").get() as { c: number };
    return {
      installed: true,
      schema_version: sv?.value ?? null,
      docs: docs.c,
      chunks: chunks.c,
      staleness_days: null,
    };
  }

  async keywordSearch(query: string, k: number): Promise<SearchHit[]> {
    const sanitised = query.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
    if (!sanitised) return [];
    const sql = `
      SELECT c.chunk_id, c.doc_id, c.ord, c.text, c.heading_path,
             d.title, d.url, d.doc_type,
             bm25(fts_chunks) AS bm25_score
      FROM fts_chunks
      JOIN chunks c ON c.chunk_id = fts_chunks.chunk_id
      JOIN docs   d ON d.doc_id  = c.doc_id
      WHERE fts_chunks MATCH ?
      ORDER BY bm25_score
      LIMIT ?`;
    const rows = this.db.prepare(sql).all(sanitised, k) as Array<ChunkRow & { bm25_score: number }>;
    return rows.map((r, i) => this.rowToHit(r, 1.0 / (1 + i)));
  }

  async vectorSearch(vector: Float32Array, k: number): Promise<SearchHit[]> {
    const buf = Buffer.from(vector.buffer);
    // sqlite-vec vec0 requires `AND k=?` constraint for knn queries
    const sql = `
      SELECT c.chunk_id, c.doc_id, c.ord, c.text, c.heading_path,
             d.title, d.url, d.doc_type,
             vec_chunks.distance AS distance
      FROM vec_chunks
      JOIN chunks c ON c.chunk_id = vec_chunks.chunk_id
      JOIN docs   d ON d.doc_id  = c.doc_id
      WHERE vec_chunks.embedding MATCH ?
        AND k = ?
      ORDER BY distance`;
    const rows = this.db.prepare(sql).all(buf, k) as Array<ChunkRow & { distance: number }>;
    return rows.map((r) => this.rowToHit(r, 1 - r.distance));
  }

  async getChunks(chunkIds: string[], neighbours: number): Promise<SearchHit[]> {
    if (chunkIds.length === 0) return [];
    const targets = this.db
      .prepare("SELECT chunk_id, doc_id, ord FROM chunks WHERE chunk_id IN (" + chunkIds.map(() => "?").join(",") + ")")
      .all(...chunkIds) as Array<{ chunk_id: string; doc_id: string; ord: number }>;

    const wanted = new Set<string>();
    for (const t of targets) {
      wanted.add(t.chunk_id);
      for (let n = 1; n <= neighbours; n++) {
        wanted.add(`${t.doc_id}#${t.ord - n}`);
        wanted.add(`${t.doc_id}#${t.ord + n}`);
      }
    }
    const idsList = [...wanted];
    if (idsList.length === 0) return [];
    const sql = `
      SELECT c.chunk_id, c.doc_id, c.ord, c.text, c.heading_path,
             d.title, d.url, d.doc_type
      FROM chunks c JOIN docs d ON d.doc_id = c.doc_id
      WHERE c.chunk_id IN (${idsList.map(() => "?").join(",")})
      ORDER BY c.doc_id, c.ord`;
    const rows = this.db.prepare(sql).all(...idsList) as ChunkRow[];
    return rows.map((r) => this.rowToHit(r, 0));
  }

  close(): void {
    this.db.close();
  }

  private rowToHit(r: ChunkRow, score: number): SearchHit {
    const headingPath = JSON.parse(r.heading_path || "[]") as string[];
    return {
      chunk_id: r.chunk_id,
      doc_id: r.doc_id,
      ord: r.ord,
      text: r.text,
      heading_path: headingPath,
      score,
      title: r.title,
      url: r.url,
      doc_type: r.doc_type,
      snippet: r.text.slice(0, 280),
    };
  }
}
