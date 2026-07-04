<div align="center">

# ato-mcp

**Your AI agent, fluent in Australian tax.**

Cited answers from 34,500+ ATO documents, the income tax and GST Acts and
4,900+ public rulings — plus tax workflow tools that know *your* situation.

[ato-mcp.com.au](https://ato-mcp.com.au) · [Tool reference](https://github.com/william-laverty/ato-mcp/blob/main/docs/tools.md) · [Changelog](https://github.com/william-laverty/ato-mcp/blob/main/CHANGELOG.md)

</div>

## Quick start

Add the hosted server to your client — one line, then sign in with your browser:

```bash
claude mcp add --transport http ato https://api.ato-mcp.com.au/mcp
```

Then run `/mcp` inside Claude Code and choose **Authenticate**. Codex, Gemini CLI,
Cursor, VS Code, Windsurf, Claude.ai and ChatGPT instructions live at
**[ato-mcp.com.au/install](https://ato-mcp.com.au/install)**.

### npm package

For stdio-only hosts that can't add a remote HTTP server directly, install this package:

```bash
npm install -g ato-mcp   # or use npx directly
```

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

Same sign-in, no token: first run opens your browser. `ato-mcp` is a stdio proxy —
it runs [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) under the hood to bridge
to the hosted endpoint over streamable HTTP with OAuth. Credentials are cached under
`~/.mcp-auth` and refreshed automatically — delete that folder to sign out.

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
