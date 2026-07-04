<div align="center">

# ato-mcp

**The Australian tax knowledge base for AI agents.**

Give Claude (or any MCP host) cited, current retrieval over 34,500+ ATO documents —
plus a personal-facts layer and four tax workflow tools that know *your* situation.

[ato-mcp.com.au](https://ato-mcp.com.au) · [Tool reference](docs/tools.md) · [Changelog](CHANGELOG.md)

[![CI](https://github.com/william-laverty/ato-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/william-laverty/ato-mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/ato-mcp)](https://www.npmjs.com/package/ato-mcp)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node 22+](https://img.shields.io/badge/node-%E2%89%A522-brightgreen)](https://nodejs.org)

</div>

---

Ask your agent *"can I claim my home office?"* and it answers from the actual ATO guidance,
the actual ITAA 1997 section, and the actual ruling — with citations you can resolve and read —
instead of from training-data vibes. Tell it once that you're a GST-registered sole trader with
crypto, and every answer is branched for *your* taxpayer shape.

## Quick start

First, install the ATO MCP server with your client.

**Standard config** works with most tools that run stdio servers:

```json
{
  "mcpServers": {
    "ato": {
      "command": "npx",
      "args": ["-y", "ato-mcp"]
    }
  }
}
```

```bash
npm install -g ato-mcp   # optional — npx works without installing
```

For hosts that natively support remote MCP servers, connect your client directly:

<details>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add --transport http ato https://api.ato-mcp.com.au/mcp
```

Then run `/mcp` inside Claude Code, select **ato**, and choose **Authenticate** —
your browser opens to sign in.

</details>

<details>
<summary><b>Codex CLI</b></summary>

```bash
codex mcp add ato --url https://api.ato-mcp.com.au/mcp
codex mcp login ato
```

`codex mcp login` opens your browser to sign in.

</details>

<details>
<summary><b>Gemini CLI</b></summary>

```bash
gemini mcp add --transport http ato https://api.ato-mcp.com.au/mcp
```

Gemini CLI detects the auth challenge on first use and opens your browser
automatically.

</details>

<details>
<summary><b>VS Code (Copilot)</b></summary>

[<img src="https://img.shields.io/badge/VS_Code-Install_ato--mcp-0098FF?style=flat-square&logo=vscodium&logoColor=white" alt="Install in VS Code">](https://insiders.vscode.dev/redirect/mcp/install?name=ato&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Fapi.ato-mcp.com.au%2Fmcp%22%7D)

Or from the command line:

```bash
code --add-mcp '{"name":"ato","type":"http","url":"https://api.ato-mcp.com.au/mcp"}'
```

VS Code prompts to authenticate in your browser when the server first connects.

</details>

<details>
<summary><b>Cursor</b></summary>

[<img src="https://img.shields.io/badge/Cursor-Install_ato--mcp-000000?style=flat-square" alt="Install in Cursor">](https://cursor.com/en/install-mcp?name=ato&config=eyJ1cmwiOiJodHRwczovL2FwaS5hdG8tbWNwLmNvbS5hdS9tY3AifQ%3D%3D)

Or add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "ato": {
      "url": "https://api.ato-mcp.com.au/mcp"
    }
  }
}
```

Cursor shows a "Needs login" prompt on the server — click it to sign in via your
browser.

</details>

<details>
<summary><b>Windsurf</b></summary>

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "ato": {
      "type": "streamable-http",
      "serverUrl": "https://api.ato-mcp.com.au/mcp"
    }
  }
}
```

If Windsurf doesn't open a sign-in window, use the standard npm config at the top
of this section instead — it handles the browser sign-in itself.

</details>

<details>
<summary><b>Claude.ai / Claude Desktop</b></summary>

1. Open **Settings → Connectors**
2. **Add custom connector**
3. Paste `https://api.ato-mcp.com.au/mcp`
4. Click **Connect** and sign in when the browser window appears

Available on paid Claude plans. Claude Desktop can alternatively use the standard
npm config at the top of this section in `claude_desktop_config.json`.

</details>

<details>
<summary><b>ChatGPT</b></summary>

1. **Settings → Apps & Connectors** → enable **Developer Mode**
2. **New connector** → paste `https://api.ato-mcp.com.au/mcp`
3. Choose **OAuth** and sign in when prompted

Requires a plan with connector support.

</details>

<details>
<summary><b>OpenCode, Zed & other stdio-only hosts</b></summary>

Use the standard npm config at the top of this section — this package bridges any
stdio host to the hosted server with the same browser sign-in.

</details>

Full instructions available **[here](https://ato-mcp.com.au/install)**.

## What's in the corpus

| Source | Contents |
|---|---|
| **ato.gov.au** | 23,000+ guidance pages, forms & instructions, occupation guides, myTax help |
| **Legislation** | ITAA 1997, ITAA 1936 and the GST Act — 6,468 sections + 2,310 statutory definitions (point-in-time aware) |
| **ATO public rulings** | 4,900+ rulings across 10 types (TR, TD, GSTR, GSTD, PR, CR, LCR, PCG, MT, FTR), withdrawn rulings flagged |
| **Citation graph** | 64,217 cross-references between rulings and legislation |
| **Thresholds** | Time-keyed scalars (instant asset write-off, GST registration, CGT discount, super caps, …) |

**34,500+ documents (286,000+ searchable passages), hybrid-indexed (BM25 + vector)**, refreshed monthly and served from
the hosted platform.

## The 13 tools

**Retrieval** — `search` (hybrid BM25+vector), `get_chunks`, `get_doc`, `get_doc_anchors`
(citation graph), `get_definition` (statutory, point-in-time), `get_threshold` (time-keyed
scalars), `fetch` (live page fetch), `stats`.

**Personal context** — `get_user_facts`: 25 facts captured once at onboarding (business
structure, GST registration, investments, super type, residency, …) so the agent never re-asks.

**Workflows** — the reason this exists:

| Tool | What it does |
|---|---|
| `deduction_discovery` | Surfaces **every deduction category** that plausibly applies to your profile — a curated, cited taxonomy branched across sole traders, companies, trusts, partnerships, investors and SMSF members |
| `depreciation_helper` | Deterministic prime-cost / diminishing-value / instant-write-off / small-business-pool / Div 43 schedules for any asset, with the live IAWO threshold |
| `bas_prep_checklist` | A tiered, cited BAS checklist for your reporting period — which labels apply, what evidence to gather, the gotchas |
| `audit_risk_check` | Flags the patterns the ATO scrutinises in a draft return (WRE vs income, rental anomalies, unreported crypto, …) with risk bands and the guidance behind each flag |

Every workflow tool returns **structured data + resolvable ATO citations — never advice in its
own voice**. See the [full tool reference](docs/tools.md).

## How it works

`ato-mcp` is a branded stdio proxy: it speaks MCP over stdio to your client and, under the
hood, runs [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) to bridge to
`api.ato-mcp.com.au/mcp` over streamable HTTP. The first tool call triggers a browser OAuth
sign-in (dynamic client registration + PKCE); after that, tokens are cached under
`~/.mcp-auth` and refreshed automatically. Sign out by deleting that folder.

Hosts that speak streamable HTTP directly can skip this package entirely and use the
one-liner in **Quick start** above — same sign-in, no extra process in between.

## Privacy, by construction

No tool names, no query content, no results are ever stored — the analytics schema physically
has nowhere to put them. See the [privacy policy](https://ato-mcp.com.au/privacy), which is
generated from the stored-data schema itself. Per-user rows are isolated with Postgres
row-level security; access is tied to your browser sign-in and can be reviewed from the
[account page](https://ato-mcp.com.au/account).

## Development

```bash
pnpm install && pnpm -r build
pnpm -r test
pnpm test:smoke
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions and [RELEASING.md](RELEASING.md) for the
release process.

## Important disclaimer

ato-mcp is **information infrastructure, not tax advice**. It retrieves and structures published
ATO material and computes deterministic schedules; it does not consider your full circumstances
and it is not a registered tax agent service. Confidence ratings and risk bands are heuristic
indicators, not professional judgement. Verify material decisions with a registered tax agent —
and read the [terms](https://ato-mcp.com.au/terms).

ATO content remains subject to ATO publication terms. ITAA 1997 text is reproduced from the
Federal Register of Legislation under its open licensing.

## License

[MIT](LICENSE) © William Laverty — applies to this client. The hosted platform and corpus
are proprietary.
