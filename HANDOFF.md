# v0.1 handoff

Everything's working. Here's what to test and how.

## Status

- **22 commits on `main`** (run `git log --oneline` to see)
- **58 tests passing** across the three packages
- **Real ATO corpus built and installed** (99 docs, 993 chunks, ~4 MB)
- **MCP stdio protocol verified end-to-end** — query "can a sole trader claim home office expenses" returned the correct ATO "Working from home expenses" page

## Test it yourself in 30 seconds

The MCP server already has a corpus installed at the default macOS data dir:

```bash
node /Users/williamlaverty/Projects/Websites/ato-pro/packages/mcp/bin/ato-pro-mcp.js stats
```

Expected output: `{"installed": true, "docs": 99, "chunks": 993, ...}`

## Add to Claude Code

Edit `~/.claude/settings.json` (or your workspace settings) to add:

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

Restart Claude Code. The MCP should appear with 4 tools: `stats`, `search`, `get_chunks`, `fetch`.

Try asking Claude things like:

- "Can a sole trader claim a portion of their home internet?"
- "What's the GST registration threshold?"
- "What records do I need to keep for vehicle expense claims?"

Claude should call the `search` tool, get cited ATO chunks back, and answer from them.

## What's in v0.1

This is **just the scaffolding release** — the foundation everything else builds on. v0.1 is parity-plus with the reference `ato-mcp`:

- `search` — hybrid BM25 + vector retrieval over the ATO corpus
- `get_chunks` — pull chunks by id with optional neighbour context
- `fetch` — live-fetch a page by `ato:<path>` URI when the corpus doesn't have it
- `stats` — corpus version / counts / staleness

**Corpus**: 99 ATO pages scraped from 5 seed URLs (deductions, business income, GST, BAS, contractors). Limited on purpose for v0.1 — the production crawler in v0.2 will go much wider.

**Embedding model**: `sentence-transformers/all-MiniLM-L6-v2` (384-dim, 22M params, ~80 MB ONNX). Same model used by pipeline and runtime so vectors match exactly. Plan was Granite Small R2; swapped to MiniLM for reliability — works identically in Python (`sentence-transformers`) and Node (`@xenova/transformers` ONNX). Easy to swap later.

## What's deliberately NOT in v0.1

Saved for later phases per the design spec at `docs/superpowers/specs/2026-05-25-ato-pro-mcp-design.md`:

- v0.2: wider corpus (legislation, AAT/FCA case law, ATO rulings re-indexed by type, state revenue offices), point-in-time queries first-class, `get_definition` / `get_doc_anchors` / `get_threshold` / GitHub-release-based update
- v0.3: web onboarding, Supabase, personal facts, `get_user_facts`, hosted mode
- v0.4: hero workflow tools (`deduction_discovery`, `bas_prep_checklist`, `audit_risk_check`, `depreciation_helper`)
- v1.0: privacy policy, OSS launch, plugin marketplace listing

## Known issues / open questions

1. **Sharp dependency patch** — `@xenova/transformers` requires `sharp@0.32.6` which has no Node 23 ABI prebuilt binary. We applied a pnpm patch (in `patches/sharp@0.32.6.patch`, registered in `pnpm-workspace.yaml`) that stubs the missing native binary for text-only pipelines. It's durable across `pnpm install`. If you upgrade `@xenova/transformers` or Node major, regenerate this patch.

2. **`get_sentence_embedding_dimension` FutureWarning** — sentence-transformers renamed this method. Cosmetic, non-blocking. Fix is `get_embedding_dimension()` in `packages/pipeline/src/ato_pipeline/embed.py:14`. One-line v0.2 fix.

3. **Typer single-command quirk** — `uv run ato-pipeline` takes `--out-dir` directly (no `build` subcommand). The plan and earlier READMEs said `ato-pipeline build`; corrected throughout. If you see "Got unexpected extra argument" it's the CLI not being called this way.

4. **Pages.jsonl scrape cache size** — `packages/pipeline/corpus-real/pages.jsonl` was 33 MB and accidentally committed in commit `4b50cd5`. Removed from HEAD in the next commit and added to `.gitignore`. The blob is still in history; clean up with `git filter-repo` or squash later if you care.

5. **Crawler dedupes by canonical doc_id** — Two URLs from the BFS crawl can canonicalise to the same doc_id (e.g. trailing-slash variants). The CLI now dedupes at chunking time so we don't fail on `UNIQUE constraint`. v0.2 should fix at the crawler level (canonicalise before adding to visited set).

## Reproducing the corpus build

If you ever blow away the data dir or want a bigger corpus:

```bash
cd packages/pipeline
uv run ato-pipeline --out-dir corpus-real --max-total-pages 200
cd ../..
node packages/mcp/bin/ato-pro-mcp.js update packages/pipeline/corpus-real/ato.sqlite
```

100 pages takes ~90 seconds (mostly the 0.5s/host crawl delay). 200 pages ~3 minutes. 500 pages ~7 minutes.

## Reading the work that went into this

- **Design spec**: `docs/superpowers/specs/2026-05-25-ato-pro-mcp-design.md` — full v1.0 vision (10 sections, ~600 lines)
- **v0.1 plan**: `docs/superpowers/plans/2026-05-25-v0.1-scaffolding.md` — 18 tasks with TDD discipline (~2300 lines)
- **Commit history**: `git log --oneline` shows the phased execution (Phase 1 → 4)

## Quick verification commands

```bash
# All tests
pnpm test                              # 35 Node tests (shared + mcp)
cd packages/pipeline && uv run pytest  # 23 Python tests

# Smoke (mocked, no network)
bash scripts/smoke.sh                  # builds tiny corpus + installs + stats

# Stats against the installed corpus
node packages/mcp/bin/ato-pro-mcp.js stats

# Type checks
pnpm -r typecheck
```

## What I'd recommend for tomorrow

If you like what's here:

1. **Test it in Claude Code** with the config snippet above. Ask it a handful of sole-trader tax questions and see how the citations land.
2. **If quality is good**, kick off v0.2 (wider corpus + point-in-time) with a fresh brainstorm + plan in the same `docs/superpowers/` directory.
3. **If retrieval feels weak**, the easiest knob is the embedding model — Granite Small R2 or BGE-small-en-v1.5 may give better tax-domain recall than MiniLM. One-line change in `config.py` plus pipeline rebuild.

If something's broken or feels off, the spec/plan are the source of truth for what was *intended*. Diff against current behaviour.
