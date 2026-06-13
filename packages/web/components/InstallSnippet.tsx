"use client";

import { useEffect, useState } from "react";

interface InstallSnippetProps {
  token: string | null;
  userId: string;
}

function buildConfig(token: string | null): string {
  return JSON.stringify(
    {
      mcpServers: {
        "ato-mcp": {
          command: "npx",
          args: ["-y", "ato-mcp"],
          env: { ATO_MCP_TOKEN: token ?? "<your-token>" },
        },
      },
    },
    null,
    2,
  );
}

export default function InstallSnippet({ token, userId }: InstallSnippetProps) {
  const [copied, setCopied] = useState(false);
  const [detected, setDetected] = useState(false);

  const snippet = buildConfig(token);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-zinc-900">Add to your AI client config</h3>
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

      {token && (
        <div className="rounded-[10px] border border-brand-200 bg-brand-50 p-3 text-[13px] text-brand-text">
          <span className="font-medium">Save your token now.</span> It will not be
          shown again. Token: <code className="font-mono">{token}</code>
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
