# Security policy

## Reporting a vulnerability

Email **developer@william-laverty.com** with details (or use GitHub's private vulnerability
reporting on this repository). Please do not open public issues for security reports.
You'll get an acknowledgement within 72 hours.

## Scope

- The hosted API (`api.ato-mcp.com.au`) and web app (`ato-mcp.com.au`)
- The `@ato-mcp/mcp` npm package and corpus update mechanism
- The Supabase row-level-security model isolating per-user data

## Design notes relevant to researchers

- Bearer tokens are stored only as SHA-256 hashes; tokens are revocable per-user.
- Corpus downloads are sha256-verified against a release manifest before install.
- Hosted tool calls are not logged or retained (no query/result storage exists in the schema).
- Known limitation: API rate-limiting is per-instance in-memory (documented in the code);
  abuse-resistance hardening is tracked in the issue tracker.
