"use client";

import { useEffect, useState } from "react";

interface InstallSnippetProps {
  mode: "hosted" | "local";
  token: string | null;
  userId: string;
}

function buildConfig(mode: "hosted" | "local", token: string | null): string {
  if (mode === "hosted") {
    return JSON.stringify(
      {
        mcpServers: {
          "ato-mcp": {
            command: "npx",
            args: ["-y", "ato-mcp-hosted"],
            env: {
              ATO_MCP_TOKEN: token ?? "<your-token>",
              ATO_MCP_USER_ID: "<your-user-id>",
            },
          },
        },
      },
      null,
      2,
    );
  }

  return [
    "# 1. Install globally",
    "npm install -g ato-mcp",
    "",
    "# 2. Add to your AI client config (e.g. claude_desktop_config.json):",
    JSON.stringify(
      {
        mcpServers: {
          "ato-mcp": {
            command: "ato-mcp",
            args: ["mcp"],
          },
        },
      },
      null,
      2,
    ),
  ].join("\n");
}

export default function InstallSnippet({ mode, token, userId }: InstallSnippetProps) {
  const [copied, setCopied] = useState(false);
  const [detected, setDetected] = useState(false);

  const snippet = buildConfig(mode, token);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Poll for connection detection
  useEffect(() => {
    if (detected) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/poll?user_id=${encodeURIComponent(userId)}`);
        if (res.ok) {
          const data = (await res.json()) as { detected: boolean };
          if (data.detected) {
            setDetected(true);
            clearInterval(interval);
          }
        }
      } catch {
        // Ignore transient errors
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [userId, detected]);

  return (
    <div className="space-y-4">
      {mode === "local" && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-900">1. Install the package</h3>
          <div className="code-block">npm install -g ato-mcp</div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-zinc-900">
          {mode === "local" ? "2. Add to your AI client config" : "Add to your AI client config"}
        </h3>
        <div className="relative">
          <pre className="code-block whitespace-pre-wrap">{snippet}</pre>
          <button
            onClick={handleCopy}
            className="btn btn-fill absolute right-2 top-2 px-2.5 py-1 text-[11px]"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {mode === "hosted" && token && (
        <div className="rounded-[10px] border border-brand-200 bg-brand-50 p-3 text-[13px] text-brand-text">
          <span className="font-medium">Save your token now.</span> It will not
          be shown again. Token: <code className="font-mono">{token}</code>
        </div>
      )}

      {detected ? (
        <div className="flex items-center gap-2 rounded-[10px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-[13px] text-zinc-900">
          <span aria-hidden="true">✓</span>
          <span className="font-medium">Connection detected — ato-mcp is running.</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand" aria-hidden="true" />
          <span>Waiting for connection…</span>
        </div>
      )}
    </div>
  );
}
