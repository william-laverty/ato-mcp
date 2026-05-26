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
            args: ["-y", "ato-pro-mcp-hosted"],
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
    "npm install -g ato-pro-mcp",
    "",
    "# 2. Add to your AI client config (e.g. claude_desktop_config.json):",
    JSON.stringify(
      {
        mcpServers: {
          "ato-mcp": {
            command: "ato-pro-mcp",
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
          <h3 className="font-medium text-gray-900">1. Install the package</h3>
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400">
            npm install -g ato-pro-mcp
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-medium text-gray-900">
          {mode === "local" ? "2. Add to your AI client config" : "Add to your AI client config"}
        </h3>
        <div className="relative">
          <pre className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-gray-200 overflow-x-auto whitespace-pre-wrap">
            {snippet}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 px-2.5 py-1 text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {mode === "hosted" && token && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <strong>Save your token now.</strong> It will not be shown again.
          Token: <code className="font-mono">{token}</code>
        </div>
      )}

      {detected ? (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <span className="text-lg">✓</span>
          <span className="font-medium">Connection detected! ato-mcp is running.</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <span className="animate-pulse">⬤</span>
          <span>Waiting for connection…</span>
        </div>
      )}
    </div>
  );
}
