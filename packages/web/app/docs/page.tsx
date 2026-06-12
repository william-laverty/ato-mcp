import type { Metadata } from "next";
import Link from "next/link";
import { TOOLS_META } from "../../lib/tools-meta";

export const metadata: Metadata = {
  title: "Documentation — install, quick start & the 13 tools",
  description:
    "Install ato-mcp in two minutes (hosted or fully local), connect it to Claude Code or any MCP host, and explore the 13 tools: cited ATO retrieval, personal context and tax workflows.",
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
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(docsJsonLd) }}
      />

      <p className="eyebrow text-brand">Documentation</p>
      <h1 className="mt-3 max-w-2xl text-[clamp(2rem,4.4vw,3.2rem)] font-medium leading-[1.05] tracking-snugger">
        Two minutes to <i className="font-serif italic text-brand">install</i>.
        A career&apos;s worth of tax, on tap.
      </h1>
      <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed text-ink/65">
        ato-mcp is an MCP server: it plugs into Claude Code, Claude Desktop or any
        Model Context Protocol host and exposes the Australian tax corpus as tools.
        Pick a mode, connect, done.
      </p>

      {/* ----------------------------------------------- install */}
      <section className="mt-12" aria-labelledby="install-h">
        <h2 id="install-h" className="text-xl font-semibold tracking-snugger">1 · Install</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card-light dotgrid p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Hosted <span className="ml-1 text-xs font-normal text-ink/45">recommended</span></h3>
              <span className="rounded-full bg-brand px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-caps text-white">no download</span>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[0.72rem] leading-relaxed text-white/85"><code>{`npm install -g @ato-mcp/mcp
ato-mcp onboard`}</code></pre>
            <p className="mt-3 text-xs leading-relaxed text-ink/55">
              Opens <Link href="/onboard" className="text-brand underline-offset-2 hover:underline">the onboarding flow</Link> —
              magic-link sign-in, a short facts wizard, and your config is written to
              <code className="font-mono"> ~/.ato-mcp/config.json</code> automatically.
            </p>
          </div>
          <div className="card-light dotgrid p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Local</h3>
              <span className="rounded-full bg-ink px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-caps text-white">offline</span>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[0.72rem] leading-relaxed text-white/85"><code>{`npm install -g @ato-mcp/mcp
ato-mcp update`}</code></pre>
            <p className="mt-3 text-xs leading-relaxed text-ink/55">
              Downloads the latest corpus release (~1 GB SQLite), verifies its sha256
              and installs atomically. Needs Node 22+ and <code className="font-mono">zstd</code>.
              Queries never leave your machine.
            </p>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------- connect */}
      <section className="mt-12" aria-labelledby="connect-h">
        <h2 id="connect-h" className="text-xl font-semibold tracking-snugger">2 · Connect your agent</h2>
        <div className="card-light mt-5 p-6">
          <p className="text-sm font-semibold">Claude Code</p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[0.72rem] leading-relaxed text-white/85"><code>claude mcp add ato-mcp -- ato-mcp mcp</code></pre>
          <p className="mt-5 text-sm font-semibold">Claude Desktop / any MCP host</p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[0.72rem] leading-relaxed text-white/85"><code>{`{
  "mcpServers": {
    "ato-mcp": { "command": "ato-mcp", "args": ["mcp"] }
  }
}`}</code></pre>
          <p className="mt-4 text-xs text-ink/55">
            Then just ask: <span className="font-serif italic">&ldquo;What can I claim as a sole-trader
            carpenter?&rdquo;</span> — the agent calls <code className="font-mono">get_user_facts</code> once,
            then <code className="font-mono">deduction_discovery</code>, and answers with citations.
          </p>
        </div>
      </section>

      {/* ----------------------------------------------- tools */}
      <section className="mt-12" aria-labelledby="toolsref-h">
        <h2 id="toolsref-h" className="text-xl font-semibold tracking-snugger">3 · The 13 tools</h2>
        {GROUPS.map((g) => (
          <div key={g} className="mt-7">
            <p className="eyebrow text-brand">{g}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {TOOLS_META.filter((t) => t.group === g).map((t) => (
                <article key={t.name} className="card-light p-5">
                  <h3 className="font-mono text-[0.82rem] font-semibold text-brand">{t.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink/65">{t.summary}</p>
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-ink/[0.04] px-3 py-2 font-mono text-[0.68rem] text-ink/70"><code>{t.example}</code></pre>
                </article>
              ))}
            </div>
          </div>
        ))}
        <p className="mt-8 text-sm text-ink/60">
          Full input/output schemas, examples and error behaviour live in the repo:&nbsp;
          <a
            className="font-medium text-brand underline-offset-4 hover:underline"
            href="https://github.com/william-laverty/ato-mcp/blob/main/docs/tools.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            docs/tools.md →
          </a>
        </p>
      </section>

      {/* ----------------------------------------------- more */}
      <section className="mt-12 grid gap-4 md:grid-cols-3" aria-label="More resources">
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
            body: "Run your own hosted stack on your own Supabase + Vercel.",
            ext: true,
          },
          { href: "/privacy", title: "Privacy", body: "Schema-generated policy — see exactly what's stored.", ext: false },
        ].map((c) =>
          c.ext ? (
            <a key={c.title} href={c.href} target="_blank" rel="noopener noreferrer" className="card-light dotgrid block p-5">
              <p className="font-semibold">{c.title} ↗</p>
              <p className="mt-1 text-sm text-ink/60">{c.body}</p>
            </a>
          ) : (
            <Link key={c.title} href={c.href} className="card-light dotgrid block p-5">
              <p className="font-semibold">{c.title}</p>
              <p className="mt-1 text-sm text-ink/60">{c.body}</p>
            </Link>
          ),
        )}
      </section>
    </main>
  );
}
