#!/usr/bin/env node
// CI gate: validates the Claude Code plugin and marketplace manifests.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const failures = [];

function check(cond, msg) {
  if (!cond) failures.push(msg);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(resolve(root, path), "utf8"));
  } catch (err) {
    failures.push(`${path}: ${err.message}`);
    return null;
  }
}

const plugin = readJson("plugins/claude-code/.claude-plugin/plugin.json");
if (plugin) {
  check(plugin.name === "ato-mcp", "plugin.json: name must be \"ato-mcp\"");
  check(
    typeof plugin.description === "string" && plugin.description.length > 0,
    "plugin.json: description required",
  );
  check(/^\d+\.\d+\.\d+$/.test(plugin.version ?? ""), "plugin.json: version must be semver");
  const server = plugin.mcpServers?.ato;
  check(server?.type === "http", 'plugin.json: mcpServers.ato.type must be "http"');
  check(
    server?.url === "https://api.ato-mcp.com.au/mcp",
    "plugin.json: mcpServers.ato.url must be the hosted endpoint",
  );
  check(
    Object.keys(plugin.mcpServers ?? {}).length === 1,
    "plugin.json: exactly one MCP server (ato) — no stdio fallback",
  );
}

const marketplace = readJson(".claude-plugin/marketplace.json");
if (marketplace) {
  check(marketplace.name === "ato-mcp", "marketplace.json: name must be \"ato-mcp\"");
  check(
    Array.isArray(marketplace.plugins) && marketplace.plugins.length > 0,
    "marketplace.json: plugins[] required",
  );
  for (const p of marketplace.plugins ?? []) {
    check(typeof p.name === "string" && p.name.length > 0, "marketplace.json: plugin name required");
    check(
      typeof p.source === "string" && p.source.startsWith("./"),
      "marketplace.json: plugin source must be a relative path",
    );
    check(
      typeof p.description === "string" && p.description.length > 0,
      "marketplace.json: plugin description required",
    );
  }
}

const skillPath = "plugins/claude-code/skills/australian-tax/SKILL.md";
let skill = null;
try {
  skill = readFileSync(resolve(root, skillPath), "utf8");
} catch {
  failures.push(`${skillPath}: missing`);
}
if (skill !== null) {
  const fm = skill.startsWith("---\n") ? skill.slice(4).split("\n---")[0] : null;
  check(fm !== null, `${skillPath}: missing YAML frontmatter`);
  check(
    (fm ?? "").includes("name: australian-tax"),
    `${skillPath}: frontmatter name must be australian-tax`,
  );
  check(/^description: .+/m.test(fm ?? ""), `${skillPath}: frontmatter description required`);
}

if (failures.length > 0) {
  console.error("Manifest validation failed:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("Manifests OK");
