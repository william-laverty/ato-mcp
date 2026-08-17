<div align="center">

# Australian Tax MCP Server

**The Australian tax knowledge base for AI agents.**

Connect your AI agent to 34,500+ ATO documents (guidance, legislation, and
public rulings) and get cited answers to the tax questions you'd otherwise pay
your accountant to answer.

[ato-mcp.com.au](https://ato-mcp.com.au?utm_source=github&utm_medium=readme) · [Tool reference](https://github.com/william-laverty/ato-mcp/blob/main/docs/tools.md) · [Changelog](https://github.com/william-laverty/ato-mcp/blob/main/CHANGELOG.md)

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

**Claude Code** connects to the remote server directly:

```bash
claude mcp add --scope user --transport http ato https://api.ato-mcp.com.au/mcp
```

Then run `/mcp` inside Claude Code, select **ato**, and choose **Authenticate**.
Your browser opens to sign in.

Using another client? Cursor, VS Code, Codex, Gemini CLI, Windsurf, Claude.ai and
ChatGPT all connect to the same endpoint.
Per-client instructions: **[ato-mcp.com.au/install](https://ato-mcp.com.au/install?utm_source=github&utm_medium=readme)**

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
