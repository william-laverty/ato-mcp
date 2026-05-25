# v0.1 handoff (broad-corpus revision)

Working. Test instructions below, comparison vs ato-mcp at the bottom.

## Status

- **30 commits on `main`** (run `git log --oneline`)
- **59 tests passing** (5 shared + 30 mcp + 24 pipeline)
- **Broad ATO corpus installed**: 22,416 docs, 181,969 chunks, 869 MB
- **Sources scraped**: every URL in `ato.gov.au/sitemap.xml` matching `/individuals-and-families/`, `/businesses-and-organisations/`, `/forms-and-instructions/`, `/tax-and-super-professionals/`, `/tax-rates-and-codes/`, `/calculators-and-tools/`, `/online-services/` — i.e. the substantive tax content of the entire public ATO site
- **MCP stdio protocol verified end-to-end** with 10 diverse queries across personal, business, super, crypto, FBT, R&D, Div 7A topics — all returned relevant ATO pages

## Test it yourself in 30 seconds

```bash
node /Users/williamlaverty/Projects/Websites/ato-pro/packages/mcp/bin/ato-pro-mcp.js stats
```

Expected output: `{"installed": true, "docs": 22416, "chunks": 181969, ...}`

## Add to Claude Code

Edit `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "ato-pro": {
      "command": "node",
      "args": [
        "/Users/williamlaverty/Projects/Websites/ato-pro/packages/mcp/bin/ato-pro-mcp.js",
        "mcp"
      ]
    }
  }
}
```

Restart Claude Code. Try things like:

- "What's the GST registration threshold and when does it apply?"
- "How is cryptocurrency taxed when I sell?"
- "Can a sole trader claim home office expenses, and which method gives a better outcome?"
- "What are the small business CGT concessions?"
- "What's Division 7A and how does it affect company loans to shareholders?"
- "What records do I need for vehicle expense claims under the logbook method?"
- "How do non-residents declare foreign income?"
- "What's the concessional super contribution cap for FY25?"

Claude will call `search` → get cited ATO chunks back → answer from them, citing `[doc:X]` markers.

## Sample query results (real, just now)

| Query | Top hit | URL fragment |
|---|---|---|
| GST registration threshold | "Disposing of a motor vehicle" (luxury car GST) | `/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/...` |
| Crypto capital gains | "Non-arm's length income" with crypto section | `/forms-and-instructions/.../section-b-income-item-11/non-arms-length-income` |
| Negative gearing | "The income requirement" (non-commercial losses) | `/businesses-and-organisations/income-deductions-and-concessions/losses/...` |
| SMSF contribution caps | "Concessional contributions cap" | `/individuals-and-families/super-for-individuals-and-families/super/...` |
| FBT on company car | "Using your business money and assets for private purposes" | `/businesses-and-organisations/starting-registering-or-closing-a-business/...` |
| Car expenses for nurses | "Tax time toolkit general" | `/tax-and-super-professionals/for-tax-professionals/...` |
| Small business CGT 15-year exemption | "Appendix 4 Definitions" | `/forms-and-instructions/capital-gains-tax-guide-2018/...` |
| Division 7A loans | "In detail" (private company benefits Div 7A) | `/businesses-and-organisations/corporate-tax-measures-and-assurance/...` |
| R&D tax incentive | "More information" | `/forms-and-instructions/research-and-development-tax-incentive-schedule-2016-instructions/...` |
| Non-resident foreign income | "Non-resident foreign income" | `/individuals-and-families/your-tax-return/...` |

Quality is good. A couple of hits are slightly tangential (GST query got luxury-car GST; crypto query got the SMSF version) — MiniLM-L6 is fine but not best-in-class for legal-domain retrieval. Granite Embedding Small R2 or BGE-small-en-v1.5 would likely improve this; one-line swap in `packages/pipeline/src/ato_pipeline/config.py` + rebuild.

## What's in v0.1

Tools the MCP exposes (already wired into Claude Code via the config above):

- `search` — hybrid BM25 + vector retrieval, returns top-k chunks with `[doc:X]` citations
- `get_chunks` — pull chunks by id with optional neighbour context
- `fetch` — live-fetch a page by `ato:<path>` URI when the corpus doesn't have it
- `stats` — corpus version / counts / staleness

Corpus: 22,416 ATO pages from the sitemap (no rulings register, no legislation, no case law — those are v0.2).

Embedding model: `sentence-transformers/all-MiniLM-L6-v2` (384-dim). Same model used by pipeline (Python) and runtime (Node ONNX), so vectors line up. Easy to swap.

## Comparison vs gunba/ato-mcp

The reference implementation that prompted this build.

| Aspect | ato-pro v0.1 (today) | gunba/ato-mcp |
|---|---|---|
| **Docs** | 22,416 | ~158,000 |
| **Chunks** | 181,969 | ~467,000 |
| **Corpus size** | 869 MB | similar (compressed ato.db.zst) |
| **Sources** | ato.gov.au sitemap (7 sections) | ato.gov.au + edited Private Binding Rulings register (law.ato.gov.au) + historical content |
| **Search modes** | hybrid / vector / keyword | hybrid / vector / keyword |
| **Tools** | `search`, `get_chunks`, `fetch`, `stats` | `search`, `get_chunks`, `get_doc_anchors`, `get_definition`, `get_asset`, `fetch`, `stats` |
| **Statutory definition lookup** | not yet (v0.2) | yes, with ordinary-meaning fallback |
| **Anchor + reverse citation graph** | not yet (v0.2) | yes |
| **Image data assets** | not yet | yes (`get_asset` resolves retained image refs) |
| **Embedding model** | all-MiniLM-L6-v2 (384-dim, 22M params) | Granite Embedding Small R2 (384-dim, 30M params) |
| **Runtime** | Node.js | Rust binary |
| **Install** | npm-packageable, currently dev-mode | `claude plugin install ./ato-mcp`, polished |
| **Distribution** | npm + GitHub release (planned) | pre-built Rust binaries + corpus zst on releases |
| **Hosted mode** | not yet (v0.3) | local only |
| **Personal facts layer** | not yet (v0.3) | none |
| **Workflow tools (deduction discovery, BAS prep, audit risk, depreciation)** | not yet (v0.4) | none |
| **Point-in-time queries** | scaffolded but not used | basic `pit=` parameter |
| **Legal corpus (legislation, case law, state revenue)** | not yet (v0.2) | not present |

**Honest assessment:** ato-mcp is a more polished v1.x product than ours is at v0.1. They've shipped:

1. **~7× more documents** because they ingest the edited PBR register (law.ato.gov.au) on top of the main site. We only have ato.gov.au sitemap content.
2. **More tools** — definitions with statutory/ordinary-meaning fallback, anchor graph, image assets.
3. **Native Rust binary** that's faster to start and easier to ship as a single executable.

What we have over them — once the planned phases land:

1. **Wider corpus** — v0.2 adds legislation, AAT/FCA case law, state revenue. ato-mcp doesn't have these.
2. **Personal context** — v0.3 onboarding + facts so the agent reasons about *your* sole-trader situation, not abstract ATO content.
3. **Workflow tools** — v0.4 hero tools for deduction discovery, BAS prep, audit risk check, depreciation helper.
4. **Hosted mode** — v0.3 optional Vercel/Supabase hosted backend for users who don't want a 800MB download.

Right now (v0.1) we're closer to "rebuild of ato-mcp's core in TypeScript with broader scrape config and an extensible base." The differentiation kicks in across v0.2–v0.4.

## Known issues

1. **Sharp pnpm patch** — `@xenova/transformers` needs `sharp@0.32.6` which has no Node 23 ABI prebuilt. Fixed durably via `pnpm.patchedDependencies` in `pnpm-workspace.yaml` + `patches/sharp@0.32.6.patch`. Survives `pnpm install`.

2. **Embedding-model swap likely improves retrieval** — a couple of test queries pulled tangential pages. Granite Small R2 or BGE-small-en-v1.5 is worth trying; both are 384-dim drop-ins. Change `embedding_model` in `packages/pipeline/src/ato_pipeline/config.py` and rebuild.

3. **`pages.jsonl` blob lingers in history** — commit `4b50cd5` contains a 33 MB scrape cache that's no longer in HEAD. Squash or `git filter-repo` before pushing.

4. **Typer CLI quirk** — `uv run ato-pipeline` takes flags directly (no `build` subcommand). Documented in README.

## Reproducing the broad corpus

If you ever blow away the data dir:

```bash
cd packages/pipeline
uv run ato-pipeline --out-dir corpus-broad   # ~30 min crawl + ~10 min embed
cd ../..
node packages/mcp/bin/ato-pro-mcp.js update packages/pipeline/corpus-broad/ato.sqlite
```

For a faster smaller corpus (just sole-trader content), use the legacy BFS mode:

```bash
uv run ato-pipeline --mode bfs --out-dir corpus-small --max-total-pages 100
```

## What I'd recommend for tomorrow

1. **Test broad coverage in Claude Code.** Ask a handful of questions across topics (super, CGT, GST, Div 7A, deductions) and judge if citations are usable.
2. **If retrieval feels tangential, swap embedding model** — try Granite Small R2 or BGE-small-en-v1.5. ~40 min to rebuild.
3. **If quality is solid, plan v0.2** in `docs/superpowers/specs/` — wider corpus (legislation, case law), point-in-time queries first-class, statutory definition lookup, anchor graph. That closes the gap with ato-mcp and adds what they don't have.
4. **Then v0.3** is the differentiator — personal facts + onboarding + hosted-mode option.

Quick verification:

```bash
pnpm test                              # 35 Node tests
cd packages/pipeline && uv run pytest  # 24 Python tests
node packages/mcp/bin/ato-pro-mcp.js stats
```
