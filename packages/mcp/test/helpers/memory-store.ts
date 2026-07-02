import type {
  SearchHit,
  Doc,
  Store,
  AnchorRow,
  CitationRow,
  DefinitionRow,
  ThresholdRow,
} from "@ato-mcp/shared";

interface ChunkFixture {
  chunk_id: string;
  doc_id: string;
  ord: number;
  text: string;
  heading_path: string[];
  effective_from?: string | null;
  effective_to?: string | null;
}

export interface MemoryFixture {
  schema_version: string;
  docs: Doc[];
  chunks: ChunkFixture[];
  anchors: AnchorRow[];
  citations: CitationRow[];
  definitions: DefinitionRow[];
  thresholds: ThresholdRow[];
}

function pitMatch(pit: string | null | undefined, from?: string | null, to?: string | null): boolean {
  if (!pit) return true;
  if (from && from > pit) return false;
  if (to && to <= pit) return false;
  return true;
}

/** Deterministic normalised 384-d vector derived from the chunk_id. */
function deterministicVector(chunkId: string): Float32Array {
  let seed = 0;
  for (const ch of chunkId) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
  const vec = new Float32Array(384);
  for (let i = 0; i < 384; i++) vec[i] = Math.sin(seed + i) * 0.05;
  let norm = 0;
  for (let i = 0; i < 384; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < 384; i++) vec[i] /= norm;
  return vec;
}

/**
 * MemoryStore — a pure in-memory `Store` implementation for tests.
 * Mirrors the hosted store's semantics (keyword/vector search, neighbour
 * expansion, point-in-time filtering) without any database dependency.
 */
export class MemoryStore implements Store {
  private embeddings = new Map<string, Float32Array>();

  constructor(private fixture: MemoryFixture, embeddings?: Map<string, Float32Array>) {
    for (const c of fixture.chunks) {
      this.embeddings.set(c.chunk_id, embeddings?.get(c.chunk_id) ?? deterministicVector(c.chunk_id));
    }
  }

  async stats() {
    return {
      installed: true,
      schema_version: this.fixture.schema_version,
      docs: this.fixture.docs.length,
      chunks: this.fixture.chunks.length,
      staleness_days: null,
    };
  }

  async keywordSearch(query: string, k: number, pit?: string): Promise<SearchHit[]> {
    const tokens = query
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean);
    if (tokens.length === 0) return [];
    const scored = this.fixture.chunks
      .filter((c) => pitMatch(pit, c.effective_from, c.effective_to))
      .map((c) => {
        const text = c.text.toLowerCase();
        let tf = 0;
        for (const t of tokens) {
          let idx = text.indexOf(t);
          while (idx !== -1) {
            tf++;
            idx = text.indexOf(t, idx + t.length);
          }
        }
        return { chunk: c, tf };
      })
      .filter((s) => s.tf > 0)
      .sort((a, b) => b.tf - a.tf)
      .slice(0, k);
    return scored.map((s, i) => this.toHit(s.chunk, 1.0 / (1 + i)));
  }

  async vectorSearch(vector: Float32Array, k: number, pit?: string): Promise<SearchHit[]> {
    const scored = this.fixture.chunks
      .filter((c) => pitMatch(pit, c.effective_from, c.effective_to))
      .map((c) => {
        const emb = this.embeddings.get(c.chunk_id)!;
        let dot = 0;
        for (let i = 0; i < Math.min(vector.length, emb.length); i++) dot += vector[i]! * emb[i]!;
        return { chunk: c, sim: dot };
      })
      .sort((a, b) => b.sim - a.sim)
      .slice(0, k);
    return scored.map((s) => this.toHit(s.chunk, s.sim));
  }

  async getChunks(chunkIds: string[], neighbours: number, pit?: string): Promise<SearchHit[]> {
    if (chunkIds.length === 0) return [];
    const byId = new Map(this.fixture.chunks.map((c) => [c.chunk_id, c]));
    const wanted = new Set<string>();
    for (const id of chunkIds) {
      const target = byId.get(id);
      if (!target) continue;
      wanted.add(target.chunk_id);
      for (let n = 1; n <= neighbours; n++) {
        wanted.add(`${target.doc_id}#${target.ord - n}`);
        wanted.add(`${target.doc_id}#${target.ord + n}`);
      }
    }
    return this.fixture.chunks
      .filter((c) => wanted.has(c.chunk_id) && pitMatch(pit, c.effective_from, c.effective_to))
      .sort((a, b) => (a.doc_id === b.doc_id ? a.ord - b.ord : a.doc_id.localeCompare(b.doc_id)))
      .map((c) => this.toHit(c, 0));
  }

  async getDoc(docId: string) {
    const doc = this.fixture.docs.find((d) => d.doc_id === docId);
    if (!doc) return null;
    const anchors = this.fixture.anchors.filter((a) => a.doc_id === docId);
    return { doc, cleaned_html: null, anchors };
  }

  async getDocAnchors(docId: string) {
    const anchors = this.fixture.anchors.filter((a) => a.doc_id === docId);
    const inbound = this.fixture.citations.filter((c) => c.to_doc_id === docId);
    const docChunkIds = new Set(this.fixture.chunks.filter((c) => c.doc_id === docId).map((c) => c.chunk_id));
    const outbound = this.fixture.citations.filter((c) => docChunkIds.has(c.from_chunk_id));
    return { anchors, inbound, outbound };
  }

  async getDefinition(term: string, pit: string | null): Promise<DefinitionRow[]> {
    const t = term.toLowerCase();
    return this.fixture.definitions.filter(
      (d) => d.term.toLowerCase() === t && pitMatch(pit, d.effective_from, d.effective_to),
    );
  }

  async getThreshold(name: string, pit: string | null): Promise<ThresholdRow | null> {
    const rows = this.fixture.thresholds
      .filter((th) => th.name === name && pitMatch(pit, th.effective_from, th.effective_to))
      .sort((a, b) => (b.effective_from ?? "").localeCompare(a.effective_from ?? ""));
    return rows[0] ?? null;
  }

  close(): void {}

  private toHit(c: ChunkFixture, score: number): SearchHit {
    const doc = this.fixture.docs.find((d) => d.doc_id === c.doc_id);
    return {
      chunk_id: c.chunk_id,
      doc_id: c.doc_id,
      ord: c.ord,
      text: c.text,
      heading_path: c.heading_path,
      score,
      title: doc?.title ?? "",
      url: doc?.url ?? "",
      doc_type: doc?.doc_type ?? "",
      snippet: c.text.slice(0, 280),
    };
  }
}

const RETRIEVED_AT = "2026-05-25T00:00:00Z";

export const SEED_FIXTURE: MemoryFixture = {
  schema_version: "0.1.0",
  docs: [
    { doc_id: "ato:test/deductions", source: "ato", url: "https://www.ato.gov.au/test/deductions", title: "Deductions you can claim", jurisdiction: "AU", doc_type: "ATO_GUIDE", retrieved_at: RETRIEVED_AT, metadata: {} },
    { doc_id: "ato:test/gst", source: "ato", url: "https://www.ato.gov.au/test/gst", title: "GST registration", jurisdiction: "AU", doc_type: "ATO_GUIDE", retrieved_at: RETRIEVED_AT, metadata: {} },
    { doc_id: "ato:test/vehicle", source: "ato", url: "https://www.ato.gov.au/test/vehicle", title: "Vehicle expenses", jurisdiction: "AU", doc_type: "ATO_GUIDE", retrieved_at: RETRIEVED_AT, metadata: {} },
    { doc_id: "legis:itaa1997/8-1", source: "legislation", url: "https://www.legislation.gov.au/itaa1997", title: "ITAA 1997 s 8-1 General deductions", jurisdiction: "AU", doc_type: "LEGISLATION_ITAA1997", retrieved_at: RETRIEVED_AT, metadata: {} },
    { doc_id: "legis:itaa1997/70-10", source: "legislation", url: "https://www.legislation.gov.au/itaa1997", title: "ITAA 1997 s 70-10 Trading stock", jurisdiction: "AU", doc_type: "LEGISLATION_ITAA1997", retrieved_at: RETRIEVED_AT, metadata: {} },
  ],
  chunks: [
    { chunk_id: "ato:test/deductions#0", doc_id: "ato:test/deductions", ord: 0, text: "You can claim a deduction for work uniform expenses if they are occupation specific.", heading_path: ["Deductions", "Uniforms"] },
    { chunk_id: "ato:test/deductions#1", doc_id: "ato:test/deductions", ord: 1, text: "Keep receipts for five years to substantiate your deduction claims.", heading_path: ["Deductions", "Records"] },
    { chunk_id: "ato:test/gst#0", doc_id: "ato:test/gst", ord: 0, text: "Register for GST when your annual turnover reaches 75000 dollars.", heading_path: ["GST", "Threshold"] },
    { chunk_id: "ato:test/vehicle#0", doc_id: "ato:test/vehicle", ord: 0, text: "You can claim vehicle expenses using the cents per kilometre method.", heading_path: ["Vehicle", "Methods"] },
  ],
  anchors: [
    { anchor_id: "a-uniform", doc_id: "ato:test/deductions", anchor_name: "Uniforms section", chunk_id: "ato:test/deductions#0" },
  ],
  citations: [
    { from_chunk_id: "ato:test/deductions#0", to_doc_id: "legis:itaa1997/8-1", to_anchor: null, citation_kind: "cites" },
  ],
  definitions: [
    { term: "trading stock", doc_id: "legis:itaa1997/70-10", anchor_id: null, body: "Trading stock includes anything produced, manufactured, acquired or purchased for purposes of manufacture, sale or exchange.", effective_from: null, effective_to: null },
  ],
  thresholds: [
    { name: "gst_registration_threshold", value: 75000, unit: "AUD", effective_from: "2007-07-01", effective_to: null, source_doc_id: null, source_anchor: null },
  ],
};

export function makeStore(embeddings?: Map<string, Float32Array>): MemoryStore {
  return new MemoryStore(SEED_FIXTURE, embeddings);
}
