# ato-mcp

MCP server for the Australian Taxation Office corpus — cited retrieval over 29k+ ATO
documents, ITAA 1997, and public rulings, plus personal-context and tax workflow tools
(`deduction_discovery`, `depreciation_helper`, `bas_prep_checklist`, `audit_risk_check`).

Get your token at **https://ato-mcp.com.au/onboard**, then add to your MCP client config:

```json
{
  "mcpServers": {
    "ato-mcp": {
      "command": "npx",
      "args": ["-y", "ato-mcp"],
      "env": { "ATO_MCP_TOKEN": "<your-token>" }
    }
  }
}
```

The client forwards every tool call to `api.ato-mcp.com.au` over TLS. There is no
local corpus to download.

## The 13 tools

**Retrieval** — `search`, `get_chunks`, `get_doc`, `get_doc_anchors`, `get_definition`,
`get_threshold`, `fetch`, `stats`.

**Personal context** — `get_user_facts`: 25 facts captured once at onboarding so the
agent never re-asks.

**Workflows** — `deduction_discovery`, `depreciation_helper`, `bas_prep_checklist`,
`audit_risk_check`.

Full tool reference: https://github.com/william-laverty/ato-mcp/blob/main/docs/tools.md

Not tax advice: tools return structured data + ATO citations for an agent to reason over.
MIT © William Laverty
