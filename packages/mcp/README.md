<div align="center">

# ato-mcp

**Your AI agent, fluent in Australian tax.**

Cited answers from 34,500+ ATO documents, the income tax and GST Acts and
4,900+ public rulings — plus tax workflow tools that know *your* situation.

[ato-mcp.com.au](https://ato-mcp.com.au) · [Tool reference](https://github.com/william-laverty/ato-mcp/blob/main/docs/tools.md) · [Changelog](https://github.com/william-laverty/ato-mcp/blob/main/CHANGELOG.md)

</div>

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

## Try asking

- *"Can I claim my home office? I work from home three days a week."*
- *"What's the instant asset write-off limit right now, and does my ute qualify?"*
- *"Walk me through what I need for this quarter's BAS."*
- *"Here's my draft return — what would the ATO look twice at?"*

## What's in the corpus

| Source | Contents |
|---|---|
| **ato.gov.au** | 23,000+ guidance pages, forms & instructions, occupation guides |
| **Legislation** | ITAA 1997, ITAA 1936 and the GST Act — 6,468 sections + 2,310 statutory definitions, point-in-time aware |
| **Public rulings** | 4,900+ rulings across 10 types (TR, TD, GSTR, GSTD, PR, CR, LCR, PCG, MT, FTR), withdrawn rulings flagged |
| **Citation graph** | 64,217 cross-references between rulings and legislation |
| **Thresholds** | Time-keyed scalars: IAWO, GST registration, CGT discount, super caps, … |

34,500+ documents (286,000+ searchable passages), hybrid-indexed (BM25 +
vector), refreshed monthly.

## The 13 tools

**Retrieval** — `search` (hybrid keyword + semantic), `get_doc`, `get_chunks`,
`get_doc_anchors` (citation graph), `get_definition` (statutory, point-in-time),
`get_threshold` (time-keyed scalars), `fetch`, `stats`.

**Personal context** — `get_user_facts`: 25 facts captured once at onboarding
so the agent never re-asks.

**Workflows** — deterministic, cited, branched on your taxpayer structure:

| Tool | What it does |
|---|---|
| `deduction_discovery` | Every deduction category that plausibly applies to your profile |
| `depreciation_helper` | Prime-cost / diminishing-value / instant-write-off / pool schedules |
| `bas_prep_checklist` | A tiered, cited BAS checklist for your reporting period |
| `audit_risk_check` | Flags the patterns the ATO scrutinises in a draft return |

Full reference: [docs/tools.md](https://github.com/william-laverty/ato-mcp/blob/main/docs/tools.md)

---

Not tax advice: tools return structured data + ATO citations for an agent to
reason over. MIT © William Laverty
