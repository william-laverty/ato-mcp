import type { Metadata } from "next";
import Link from "next/link";
import { TOOLS_META } from "../../lib/tools-meta";

export const metadata: Metadata = {
  title: "Documentation — install, quick start & the 13 tools",
  description:
    "Install ato-mcp in two minutes (hosted), connect it to Claude Code or any MCP host, and explore the 13 tools: cited ATO retrieval, personal context and tax workflows.",
  alternates: { canonical: "/docs" },
};

const GROUPS = ["Workflows", "Retrieval", "Personal context"] as const;

const docsJsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "ato-mcp documentation",
  description:
    "Install ato-mcp, connect it to an MCP host, and use its 13 Australian-tax tools.",
  author: { "@type": "Person", name: "William Laverty" },
  url: "https://ato-mcp.com.au/docs",
};

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(docsJsonLd) }}
      />

      <p className="eyebrow">Documentation</p>
      <h1 className="mt-3 max-w-2xl text-[clamp(2rem,4vw,2.75rem)] font-normal leading-[1.08] tracking-tight2">
        Two minutes to install. A career&apos;s worth of tax, on tap.
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-zinc-500">
        ato-mcp is an MCP server: it plugs into Claude Code, Claude Desktop or any
        Model Context Protocol host and exposes the Australian tax corpus as tools.
        Get a token, connect, done.
      </p>

      {/* ----------------------------------------------- install */}
      <section className="mt-14" aria-labelledby="install-h">
        <h2 id="install-h" className="text-xl font-medium tracking-tight1">1 · Install</h2>
        <div className="mt-5">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Hosted <span className="ml-1 text-xs font-normal text-zinc-400">no download required</span></h3>
              <span className="badge-accent">zero download</span>
            </div>
            <pre className="code-block mt-4"><code>{`npx -y ato-mcp`}</code></pre>
            <p className="mt-3 text-xs leading-relaxed text-zinc-500">
              Get your token and config snippet at{" "}
              <Link href="/onboard" className="text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900">
                ato-mcp.com.au/onboard
              </Link>{" "}
              — sign in with email, complete a short facts wizard, and paste the config into your MCP host.
              Set <code className="font-mono">ATO_MCP_TOKEN</code> in the{" "}
              <code className="font-mono">env</code> block of your config.
            </p>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------- connect */}
      <section className="mt-14" aria-labelledby="connect-h">
        <h2 id="connect-h" className="text-xl font-medium tracking-tight1">2 · Connect your agent</h2>
        <div className="card mt-5 p-6">
          <p className="text-sm font-medium">Claude Desktop / any MCP host</p>
          <pre className="code-block mt-3"><code>{`{
  "mcpServers": {
    "ato-mcp": {
      "command": "npx",
      "args": ["-y", "ato-mcp"],
      "env": { "ATO_MCP_TOKEN": "<your-token>" }
    }
  }
}`}</code></pre>
          <p className="mt-4 text-xs text-zinc-500">
            Then just ask: &ldquo;What can I claim as a sole-trader
            carpenter?&rdquo; — the agent calls <code className="font-mono">get_user_facts</code> once,
            then <code className="font-mono">deduction_discovery</code>, and answers with citations.
          </p>
        </div>
      </section>

      {/* ----------------------------------------------- tools */}
      <section className="mt-14" aria-labelledby="toolsref-h">
        <h2 id="toolsref-h" className="text-xl font-medium tracking-tight1">3 · The 13 tools</h2>
        {GROUPS.map((g) => (
          <div key={g} className="mt-8">
            <p className="eyebrow">{g}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {TOOLS_META.filter((t) => t.group === g).map((t) => (
                <article key={t.name} className="card p-5">
                  <h3 className="font-mono text-[0.8125rem] font-medium text-brand-text">{t.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{t.summary}</p>
                  <pre className="code-block mt-3 px-3 py-2 text-[0.6875rem]"><code>{t.example}</code></pre>
                </article>
              ))}
            </div>
          </div>
        ))}
        <p className="mt-8 text-sm text-zinc-500">
          Full input/output schemas, examples and error behaviour live in the repo:&nbsp;
          <a
            className="text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-900"
            href="https://github.com/william-laverty/ato-mcp/blob/main/docs/tools.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            docs/tools.md
          </a>
        </p>
      </section>

      {/* ----------------------------------------------- more */}
      <section className="mt-14 grid gap-4 md:grid-cols-3" aria-label="More resources">
        {[
          {
            href: "https://github.com/william-laverty/ato-mcp",
            title: "GitHub",
            body: "The whole stack — server, pipeline, backend, this site — MIT licensed.",
            ext: true,
          },
          {
            href: "https://github.com/william-laverty/ato-mcp/blob/main/docs/self-hosting.md",
            title: "Self-hosting",
            body: "Run the serving stack on your own Supabase + Vercel. The corpus is served from the hosted backend.",
            ext: true,
          },
          { href: "/privacy", title: "Privacy", body: "Schema-generated policy — see exactly what's stored.", ext: false },
        ].map((c) =>
          c.ext ? (
            <a key={c.title} href={c.href} target="_blank" rel="noopener noreferrer" className="card card-hover block p-5">
              <p className="text-sm font-medium">{c.title} ↗</p>
              <p className="mt-1 text-sm text-zinc-500">{c.body}</p>
            </a>
          ) : (
            <Link key={c.title} href={c.href} className="card card-hover block p-5">
              <p className="text-sm font-medium">{c.title}</p>
              <p className="mt-1 text-sm text-zinc-500">{c.body}</p>
            </Link>
          ),
        )}
      </section>
    </main>
  );
}
