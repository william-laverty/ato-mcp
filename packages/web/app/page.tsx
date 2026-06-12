import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/* ---------------------------------------------------------------------------
   Landing page — Clinical system. Fully light: white sections alternating
   with zinc-50 bands, hairline borders, one vermillion accent reserved for
   citation chips and small markers. The product demo card is the hero image.
--------------------------------------------------------------------------- */

const HERO_STATS = [
  { n: "29,181", label: "ATO documents" },
  { n: "2,127", label: "public rulings" },
  { n: "13", label: "MCP tools" },
];

const CORPUS_STATS = [
  { n: "224,585", label: "indexed chunks", sub: "hybrid BM25 + vector" },
  { n: "4,638", label: "ITAA 1997 sections", sub: "+ 1,929 statutory definitions" },
  { n: "23,267", label: "citation edges", sub: "rulings ⇄ legislation graph" },
];

const CORPUS_INDEX = [
  { num: "01", title: "Guidance", sub: "ato.gov.au, scraped monthly" },
  { num: "02", title: "Statute", sub: "ITAA 1997 from the Federal Register" },
  { num: "03", title: "Rulings", sub: "law.ato.gov.au, 10 ruling series" },
  { num: "04", title: "Citation graph", sub: "every reference resolved both ways" },
];

const HOW_IT_WORKS = [
  {
    num: "1",
    title: "Install",
    body: "One global npm package.",
    fragment: "npm i -g @ato-mcp/mcp",
  },
  {
    num: "2",
    title: "Onboard",
    body: "Local or hosted, about two minutes.",
    fragment: "ato-mcp onboard",
  },
  {
    num: "3",
    title: "Connect",
    body: "One line in your MCP host config.",
    fragment: "claude mcp add ato-mcp",
  },
  {
    num: "4",
    title: "Ask",
    body: "Answers arrive with their citations.",
    fragment: "› what can I claim?",
  },
];

const WORKFLOWS = [
  {
    name: "deduction_discovery",
    title: "Every deduction that fits your shape",
    body: "A 59-category curated taxonomy filtered by your facts — sole trader, company, trust, partnership, investor or SMSF member — each category cited and confidence-rated.",
  },
  {
    name: "depreciation_helper",
    title: "Depreciation, computed not guessed",
    body: "Prime cost vs diminishing value vs instant write-off vs small-business pool vs Div 43 — deterministic year-by-year schedules with the live IAWO threshold.",
  },
  {
    name: "bas_prep_checklist",
    title: "BAS prep without the scramble",
    body: "A tiered checklist for your reporting period: which labels apply, what evidence to gather, the gotchas — every section backed by ATO guidance.",
  },
  {
    name: "audit_risk_check",
    title: "Know what the ATO looks at",
    body: "Heuristic red-flags over a draft return — WRE vs income, rental anomalies, unreported crypto — each with a risk band and the guidance behind it.",
  },
];

const RETRIEVAL_TOOLS = [
  { name: "search", desc: "Hybrid BM25 + vector search, rank-fused, point-in-time aware" },
  { name: "get_chunks", desc: "Resolve chunk ids to full passages with neighbouring context" },
  { name: "get_doc", desc: "A whole document — metadata plus its anchor list" },
  { name: "get_doc_anchors", desc: "The citation graph around a document, inbound and outbound" },
  { name: "get_definition", desc: "Statutory definitions, point-in-time selectable" },
  { name: "get_threshold", desc: "Time-keyed thresholds with live current values" },
  { name: "fetch", desc: "Any corpus document by id, as clean markdown" },
  { name: "stats", desc: "Installed corpus snapshot, freshness and coverage" },
  { name: "get_user_facts", desc: "Your onboarded taxpayer profile, for tools and agents" },
];

const FAQS = [
  {
    q: "Is this tax advice?",
    a: "No. ato-mcp is information infrastructure: it retrieves and structures published ATO material and computes deterministic schedules, always with citations. Confidence ratings and risk bands are heuristic indicators. Your agent does the reasoning, and material decisions should be verified with a registered tax agent.",
  },
  {
    q: "What's the difference between local and hosted mode?",
    a: "Local mode downloads a ~1 GB SQLite corpus and runs everything — including embeddings — on your machine; queries never leave your device. Hosted mode skips the download and queries api.ato-mcp.com.au over TLS with a personal bearer token. Both run the identical open-source tool code against the identical corpus snapshot.",
  },
  {
    q: "What does hosted mode store about me?",
    a: "Your onboarding facts (business structure, GST registration, and so on — about 25 fields you control), a hashed bearer token, and coarse usage events. Never tool names, never query content, never results: the schema physically has nowhere to store them, and the privacy page is generated from that schema so it can't drift.",
  },
  {
    q: "Which agents does it work with?",
    a: "Anything that speaks the Model Context Protocol over stdio — Claude Code and Claude Desktop most prominently, plus any other MCP-capable host. One config line after onboarding.",
  },
  {
    q: "How current is the corpus?",
    a: "The corpus is rebuilt from ato.gov.au, the Federal Register of Legislation and law.ato.gov.au on a monthly cycle, and every release is sha256-verified on install. The stats tool reports the installed snapshot and flags staleness.",
  },
  {
    q: "Is it really open source?",
    a: "MIT licensed, end to end — the MCP server, the corpus pipeline, the hosted backend and this website are all in the same public repository. For a tool that reads tax law to you, verifiability is the point.",
  },
];

const SITE = "https://ato-mcp.com.au";

const pageJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "ato-mcp",
      operatingSystem: "macOS, Linux, Windows",
      applicationCategory: "DeveloperApplication",
      description:
        "MCP server giving AI agents cited retrieval over 29,000+ ATO documents, ITAA 1997 and public rulings, with personal context and four tax workflow tools.",
      url: SITE,
      downloadUrl: "https://www.npmjs.com/package/@ato-mcp/mcp",
      softwareVersion: "1.0.0",
      offers: { "@type": "Offer", price: "0", priceCurrency: "AUD" },
      license: "https://github.com/william-laverty/ato-mcp/blob/main/LICENSE",
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

/** Faint citation-graph motif behind the hero demo card. Decorative only. */
function CitationGraphMotif() {
  return (
    <svg
      className="pointer-events-none absolute -right-16 -top-14 hidden lg:block"
      width="360"
      height="280"
      viewBox="0 0 360 280"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="#e4e4e7" strokeWidth="1">
        <path d="M50 220 L160 130 L290 170" />
        <path d="M160 130 L230 40" />
        <path d="M230 40 L330 90" />
      </g>
      <circle cx="50" cy="220" r="3.5" fill="#e4e4e7" />
      <circle cx="160" cy="130" r="3.5" fill="#d4d4d8" />
      <circle cx="290" cy="170" r="3.5" fill="#e4e4e7" />
      <circle cx="230" cy="40" r="3.5" fill="#fa520f" opacity="0.3" />
      <circle cx="330" cy="90" r="3.5" fill="#e4e4e7" />
    </svg>
  );
}

function HeroDemo() {
  return (
    <div
      className="card reveal relative rounded-[14px] p-6 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
      style={{ "--reveal-delay": "0.3s" } as React.CSSProperties}
    >
      <p className="font-mono text-[0.6875rem] text-zinc-400">
        claude · ato-mcp connected
      </p>
      <p className="mt-4 font-mono text-[0.8125rem] text-zinc-400">
        › can I claim my home office as a sole trader?
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-700">
        Yes — running expenses are deductible, and because part of your home is
        a genuine place of business you may also claim occupancy costs (with a
        CGT trade-off worth knowing about). Two methods apply:
      </p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-500">
        — fixed-rate <span className="text-brand-text">(PCG 2023/1)</span>:
        cents per hour, bundles energy, phone &amp; internet
        <br />— actual cost <span className="text-brand-text">(TR 93/30)</span>:
        work-share of real running costs
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Citations">
        <span className="chip"><span className="chip-dot" />ITAA 1997 · s 8-1</span>
        <span className="chip"><span className="chip-dot" />PCG 2023/1</span>
        <span className="chip"><span className="chip-dot" />TR 93/30</span>
        <span className="chip"><span className="chip-dot" />Home-based business expenses</span>
      </div>
      <p className="mt-4 border-t border-zinc-100 pt-3 font-mono text-[0.6875rem] text-zinc-400">
        resolved 4 citations · deduction_discovery → 32 categories for your profile
      </p>
    </div>
  );
}

export default function HomePage() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }}
      />

      {/* ------------------------------------------------ hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-5 pb-14 pt-16 sm:pt-24">
          <div className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p
                className="reveal inline-flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-zinc-500"
                style={{ "--reveal-delay": "0s" } as React.CSSProperties}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
                v1.0 · open source · MIT
              </p>
              <h1
                className="reveal mt-5 text-[clamp(2.5rem,5vw,3.5rem)] font-normal leading-[1.04] tracking-tight2 text-zinc-900"
                style={{ "--reveal-delay": "0.08s" } as React.CSSProperties}
              >
                Your AI agent, fluent in Australian tax
              </h1>
              <p
                className="reveal mt-5 max-w-xl text-[15px] leading-relaxed text-zinc-500"
                style={{ "--reveal-delay": "0.16s" } as React.CSSProperties}
              >
                ato-mcp gives Claude — and any MCP agent — cited, current
                retrieval over 29,000+ ATO documents, the ITAA 1997 and 2,127
                public rulings, plus workflow tools that already know your
                taxpayer shape. Answers come with the section, the ruling and
                the page.
              </p>
              <div
                className="reveal mt-8 flex flex-wrap items-center gap-3"
                style={{ "--reveal-delay": "0.24s" } as React.CSSProperties}
              >
                <Link href="/onboard" className="btn btn-primary px-6 py-3 text-sm">
                  Get started free
                </Link>
                <Link href="/docs" className="btn btn-outline px-6 py-3 text-sm">
                  Read the docs
                </Link>
              </div>
              <p
                className="reveal mt-5 font-mono text-xs text-zinc-400"
                style={{ "--reveal-delay": "0.3s" } as React.CSSProperties}
              >
                npm i -g @ato-mcp/mcp · works with Claude Code, Claude Desktop
                &amp; any MCP host
              </p>
            </div>
            <div className="relative">
              <CitationGraphMotif />
              <HeroDemo />
            </div>
          </div>

          {/* stat strip */}
          <div className="mt-16 flex flex-wrap gap-x-12 gap-y-6 border-t border-zinc-100 pt-7">
            {HERO_STATS.map((s) => (
              <div key={s.label}>
                <p className="text-xl tracking-tight1 text-zinc-900">{s.n}</p>
                <p className="mt-0.5 font-mono text-[0.6875rem] text-zinc-400">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ how it works */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:py-24" aria-labelledby="how-h">
        <div className="text-center">
          <p className="eyebrow">How it works</p>
          <h2
            id="how-h"
            className="mt-3 text-[clamp(1.6rem,3vw,2.25rem)] font-normal leading-[1.1] tracking-tight1"
          >
            From npm to a tax-fluent agent in two minutes
          </h2>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.num} className="card reveal-scroll p-5">
              <p className="font-mono text-[0.6875rem] text-zinc-400">{s.num}</p>
              <div className="mt-3 rounded-lg bg-zinc-50 px-4 py-5">
                <p className="overflow-x-auto whitespace-nowrap font-mono text-xs text-zinc-700">
                  {s.fragment}
                </p>
              </div>
              <h3 className="mt-4 text-base font-medium tracking-tight1">
                {s.title}
              </h3>
              <p className="mt-1 text-sm text-zinc-500">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ corpus */}
      <section
        className="mx-auto max-w-6xl px-5 pb-20 sm:pb-24"
        aria-labelledby="corpus-h"
      >
        <div className="grid gap-12 lg:grid-cols-[1fr_260px]">
          <div>
            <p className="eyebrow">The corpus</p>
            <h2
              id="corpus-h"
              className="mt-3 max-w-xl text-[clamp(1.6rem,3vw,2.25rem)] font-normal leading-[1.1] tracking-tight1"
            >
              The whole landscape, indexed — guidance, statute and rulings in
              one graph
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {CORPUS_STATS.map((s) => (
                <div key={s.label} className="card reveal-scroll p-5">
                  <p className="text-[1.75rem] tracking-tight1 text-zinc-900">
                    {s.n}
                  </p>
                  <p className="mt-1 text-sm font-medium">{s.label}</p>
                  <p className="mt-1 text-xs text-zinc-400">{s.sub}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-zinc-500">
              Rebuilt monthly. Point-in-time aware. Every release
              sha256-verified.{" "}
              <Link
                href="/docs"
                className="text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-900"
              >
                See what&apos;s inside
              </Link>
            </p>
          </div>
          <div className="border-zinc-100 lg:border-l lg:pl-10">
            <ol>
              {CORPUS_INDEX.map((i, idx) => (
                <li
                  key={i.num}
                  className={`flex items-baseline justify-between gap-4 py-4 ${
                    idx < CORPUS_INDEX.length - 1 ? "border-b border-zinc-100" : ""
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{i.title}</p>
                    <p className="mt-0.5 text-xs text-zinc-400">{i.sub}</p>
                  </div>
                  <span className="font-mono text-[0.6875rem] text-zinc-400">
                    {i.num}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ workflows */}
      <section
        id="tools"
        className="border-y border-zinc-100 bg-zinc-50"
        aria-labelledby="tools-h"
      >
        <div className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
          <p className="eyebrow">Workflow tools</p>
          <h2
            id="tools-h"
            className="mt-3 max-w-xl text-[clamp(1.6rem,3vw,2.25rem)] font-normal leading-[1.1] tracking-tight1"
          >
            Not a search box. Workflows that know who&apos;s asking
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-zinc-500">
            Onboard once — business structure, GST status, investments, super —
            and the four hero tools branch for your exact taxpayer shape. Every
            output is structured data plus resolvable ATO citations: your agent
            reasons, you verify.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {WORKFLOWS.map((w) => (
              <article key={w.name} className="card reveal-scroll p-6">
                <p className="font-mono text-xs text-brand-text">{w.name}</p>
                <h3 className="mt-2 text-lg font-medium tracking-tight1">
                  {w.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  {w.body}
                </p>
              </article>
            ))}
          </div>

          {/* retrieval layer */}
          <div className="mt-12">
            <p className="eyebrow">Plus the retrieval layer</p>
            <div className="card mt-4 overflow-hidden p-0">
              {RETRIEVAL_TOOLS.map((t, idx) => (
                <div
                  key={t.name}
                  className={`flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:items-baseline sm:gap-6 ${
                    idx % 2 === 1 ? "bg-zinc-50/70" : "bg-white"
                  }`}
                >
                  <span className="w-40 shrink-0 font-mono text-[0.8125rem] text-zinc-900">
                    {t.name}
                  </span>
                  <span className="text-[0.8125rem] text-zinc-500">{t.desc}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-zinc-500">
              Hybrid search, a 23,267-edge citation graph, statutory definitions
              and time-keyed thresholds — the substrate the workflows stand on.{" "}
              <Link
                href="/docs"
                className="text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-900"
              >
                Full tool reference
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ modes */}
      <section
        id="modes"
        className="mx-auto max-w-6xl px-5 py-20 sm:py-24"
        aria-labelledby="modes-h"
      >
        <p className="eyebrow">Two ways to run it</p>
        <h2
          id="modes-h"
          className="mt-3 max-w-xl text-[clamp(1.6rem,3vw,2.25rem)] font-normal leading-[1.1] tracking-tight1"
        >
          Your tax data, your terms
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="card reveal-scroll p-7">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium tracking-tight1">Local</h3>
              <span className="badge">offline</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              A ~1 GB SQLite corpus on your disk, embeddings via ONNX on your
              CPU. Queries never leave the machine — there is nothing to trust
              because nothing is sent.
            </p>
            <pre className="code-block mt-5"><code>{`npm install -g @ato-mcp/mcp
ato-mcp update   # download + verify corpus
claude mcp add ato-mcp -- ato-mcp mcp`}</code></pre>
            <p className="mt-3 text-xs text-zinc-400">
              Free forever · monthly corpus releases · sha256-verified
            </p>
          </div>
          <div className="card reveal-scroll p-7">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium tracking-tight1">Hosted</h3>
              <span className="badge-accent">zero download</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              Same tools, served from api.ato-mcp.com.au over TLS with a
              personal bearer token. Always the freshest corpus; tool calls are
              never logged — and the server code is open source, so you can
              check.
            </p>
            <pre className="code-block mt-5"><code>{`npm install -g @ato-mcp/mcp
ato-mcp onboard  # browser onboarding, ~2 min
claude mcp add ato-mcp -- ato-mcp mcp`}</code></pre>
            <p className="mt-3 text-xs text-zinc-400">
              Magic-link sign-in · revocable tokens · row-level security
            </p>
          </div>
        </div>
        <p className="mt-6 text-sm text-zinc-500">
          ✓ Identical shared tool core&nbsp;&nbsp;&nbsp;✓ MIT
          licensed&nbsp;&nbsp;&nbsp;✓ sha256-verified releases — behaviour
          can&apos;t drift between modes, because it&apos;s the same code.
        </p>
      </section>

      {/* ------------------------------------------------ privacy */}
      <section
        className="mx-auto max-w-6xl px-5 pb-20 sm:pb-24"
        aria-labelledby="privacy-h"
      >
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow inline-flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
            Privacy, by construction
          </p>
          <h2
            id="privacy-h"
            className="mt-4 text-[clamp(1.6rem,3vw,2.25rem)] font-normal leading-[1.15] tracking-tight1"
          >
            The privacy policy is generated from the database schema — so it
            can&apos;t lie
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-500">
            Hosted mode has no table for queries, tool calls or results — the
            data model physically can&apos;t retain them. The privacy page
            renders every stored field straight from the schema, and a contract
            test fails the build if a field goes undocumented. Personal rows are
            isolated with Postgres row-level security, and one button deletes
            everything.
          </p>
          <Link href="/privacy" className="btn btn-outline mt-7 px-5 py-2.5 text-sm">
            Read the privacy policy
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------ FAQ */}
      <section className="mx-auto max-w-3xl px-5 pb-24" aria-labelledby="faq-h">
        <p className="eyebrow text-center">FAQ</p>
        <h2
          id="faq-h"
          className="mt-3 text-center text-[clamp(1.6rem,3vw,2.25rem)] font-normal tracking-tight1"
        >
          The questions that matter
        </h2>
        <div className="mt-10">
          {FAQS.map((f) => (
            <details key={f.q} className="group border-b border-zinc-100 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium marker:hidden">
                {f.q}
                <span
                  className="text-lg font-normal text-zinc-400 transition-transform duration-300 group-open:rotate-45"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ final CTA */}
      <section className="border-t border-zinc-100 bg-zinc-50">
        <div className="mx-auto max-w-2xl px-5 py-20 text-center sm:py-24">
          <h2 className="text-[clamp(1.8rem,3.6vw,2.5rem)] font-normal leading-[1.1] tracking-tight2 text-zinc-900">
            Two minutes to a tax-fluent agent
          </h2>
          <p className="mt-4 text-[15px] text-zinc-500">
            Onboard, paste one config line, ask better questions.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/onboard" className="btn btn-primary px-7 py-3 text-sm">
              Get started free
            </Link>
            <a
              href="https://github.com/william-laverty/ato-mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline px-7 py-3 text-sm"
            >
              Star on GitHub
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
