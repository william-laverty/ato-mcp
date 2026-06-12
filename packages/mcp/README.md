# @ato-mcp/mcp

MCP server for the Australian Taxation Office corpus — cited retrieval over 29k+ ATO
documents, ITAA 1997, and public rulings, plus personal-context and tax workflow tools
(`deduction_discovery`, `depreciation_helper`, `bas_prep_checklist`, `audit_risk_check`).

```bash
npm install -g @ato-mcp/mcp

# Hosted mode (no download): onboard at https://ato-mcp.com.au/onboard
ato-mcp onboard

# OR local mode (offline, ~1 GB corpus, requires zstd):
ato-mcp update

# Add to Claude Code
claude mcp add ato-mcp -- ato-mcp mcp
```

Full docs: https://github.com/william-laverty/ato-mcp — website: https://ato-mcp.com.au

Not tax advice: tools return structured data + ATO citations for an agent to reason over.
MIT © William Laverty
