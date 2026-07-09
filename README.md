<div align="center">

# Australian Tax MCP Server

**The Australian tax knowledge base for AI agents.**

Connect your AI agent to 34,500+ ATO documents (guidance, legislation, and
public rulings) and get cited answers to the tax questions you'd otherwise pay
your accountant to answer.

[ato-mcp.com.au](https://ato-mcp.com.au) · [Tool reference](https://github.com/william-laverty/ato-mcp/blob/main/docs/tools.md) · [Changelog](https://github.com/william-laverty/ato-mcp/blob/main/CHANGELOG.md)

[![CI](https://github.com/william-laverty/ato-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/william-laverty/ato-mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/ato-mcp)](https://www.npmjs.com/package/ato-mcp)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](https://github.com/william-laverty/ato-mcp/blob/main/LICENSE)
[![Node 22+](https://img.shields.io/badge/node-%E2%89%A522-brightgreen)](https://nodejs.org)

</div>

## Quick start

Add the MCP Server to the client you already use.

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
npm install -g ato-mcp   # optional, npx works without installing
```

For hosts that natively support remote MCP servers, connect your client directly:

<details>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add --transport http ato https://api.ato-mcp.com.au/mcp
```

Then run `/mcp` inside Claude Code, select **ato**, and choose **Authenticate**.
Your browser opens to sign in.

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

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF" alt="Install in VS Code">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522ato%2522%252C%2522type%2522%253A%2522http%2522%252C%2522url%2522%253A%2522https%253A%252F%252Fapi.ato-mcp.com.au%252Fmcp%2522%257D) [<img alt="Install in VS Code Insiders" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522ato%2522%252C%2522type%2522%253A%2522http%2522%252C%2522url%2522%253A%2522https%253A%252F%252Fapi.ato-mcp.com.au%252Fmcp%2522%257D)

Or from the command line:

```bash
code --add-mcp '{"name":"ato","type":"http","url":"https://api.ato-mcp.com.au/mcp"}'
```

VS Code prompts to authenticate in your browser when the server first connects.

</details>

<details>
<summary><b>Cursor</b></summary>

[<img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Install in Cursor">](https://cursor.com/en/install-mcp?name=ato&config=eyJ1cmwiOiJodHRwczovL2FwaS5hdG8tbWNwLmNvbS5hdS9tY3AifQ%3D%3D)

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

Cursor shows a "Needs login" prompt on the server. Click it to sign in via your
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
of this section instead; it handles the browser sign-in itself.

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
<summary><b>Other (OpenCode, Zed, etc)</b></summary>

Use the standard npm config at the top of this section. This package bridges any
stdio host to the hosted server with the same browser sign-in.

</details>

Full instructions available **[here](https://ato-mcp.com.au/install)**.

## What's in the corpus

Everything the ATO publishes, in one searchable place, refreshed monthly:

| Source | Contents |
|---|---|
| **ato.gov.au** | 23,000+ guidance pages, forms & instructions, occupation guides, myTax help |
| **Legislation** | ITAA 1997, ITAA 1936 and the GST Act: 6,468 sections + 2,310 statutory definitions (point-in-time aware) |
| **ATO public rulings** | 4,900+ rulings across 10 types (TR, TD, GSTR, GSTD, PR, CR, LCR, PCG, MT, FTR), withdrawn rulings flagged |
| **Cross-references** | 64,217 links between rulings and legislation |
| **Thresholds** | Time-keyed values (instant asset write-off, GST registration, CGT discount, super caps, …) |

**34,500+ documents (286,000+ searchable passages)**, refreshed monthly and
served from the hosted platform.

## The 13 tools

**Workflows** are the reason this exists:

> _"Here's my bank transactions, what can I claim this year? How do I write off my new laptop? Is anything in my return risky?"_

| Tool | What it does |
|---|---|
| `deduction_discovery` | Surfaces **every deduction category** that plausibly applies to your profile: a curated, cited taxonomy branched across sole traders, companies, trusts, partnerships, investors and SMSF members |
| `depreciation_helper` | Deterministic prime-cost / diminishing-value / instant-write-off / small-business-pool / Div 43 schedules for any asset, with the live IAWO threshold |
| `bas_prep_checklist` | A tiered, cited BAS checklist for your reporting period: which labels apply, what evidence to gather, the gotchas |
| `audit_risk_check` | Flags the patterns the ATO scrutinises in a draft return (WRE vs income, rental anomalies, unreported crypto, …) with risk bands and the guidance behind each flag |

Every workflow tool returns **structured data and resolvable ATO citations,
never advice in its own voice**.

**Personal context:** `get_user_facts`, 25 facts captured once at onboarding
(business structure, GST registration, investments, super type, residency, …)
so the agent never re-asks.

**Retrieval:** `search` (keyword and semantic retrieval), `get_chunks`,
`get_doc`, `get_doc_anchors` (cross-references), `get_definition` (statutory,
point-in-time), `get_threshold` (time-keyed values), `fetch` (live page fetch),
`stats`.

See the [full tool reference](https://github.com/william-laverty/ato-mcp/blob/main/docs/tools.md).

## Disclaimer

This service is provided as **information infrastructure, not tax advice**. It
does not consider your full financial circumstances and it is not a registered
tax agent service. Confidence ratings and risk bands are guides, not
professional judgement. Verify material decisions with a registered tax agent.

ato-mcp is an independent service. It is not affiliated with or endorsed by
the Australian Taxation Office. ATO content remains subject to ATO publication
terms. Legislation text is reproduced from the Federal Register of Legislation
under its open licensing.

See the [Terms of Service](https://ato-mcp.com.au/terms) &
[Privacy Policy](https://ato-mcp.com.au/privacy) for more details.

---

**License [AGPL-3.0](https://github.com/william-laverty/ato-mcp/blob/main/LICENSE) © William Laverty**

*The hosted platform and corpus are proprietary. Commercial licensing available on request.*
