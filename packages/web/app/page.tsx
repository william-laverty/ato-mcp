import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/* ---------------------------------------------------------------------------
   Landing page — Clinical system. Fully light: white sections alternating
   with zinc-50 bands, hairline borders, one vermillion accent reserved for
   citation chips and small markers. The product demo card is the hero image.
--------------------------------------------------------------------------- */

const HERO_TRUST = [
  { title: "Cited retrieval", sub: "every answer sourced" },
  { title: "29,000+ documents", sub: "refreshed monthly" },
  { title: "Any MCP host", sub: "Claude Code & Desktop" },
];

const CORPUS_STATS = [
  { n: "224,585", label: "passages", sub: "every paragraph, searchable" },
  { n: "4,638", label: "ITAA 1997 sections", sub: "+ 1,929 legal definitions" },
  { n: "23,267", label: "citation links", sub: "rulings tied to legislation" },
];

const CORPUS_INDEX = [
  { num: "01", title: "Guidance", sub: "ato.gov.au" },
  { num: "02", title: "Legislation", sub: "ITAA 1997, in full" },
  { num: "03", title: "Rulings", sub: "law.ato.gov.au" },
  { num: "04", title: "Citation graph", sub: "everything cross-linked" },
];

const HOW_IT_WORKS = [
  {
    num: "1",
    title: "Install",
    body: "One global npm package.",
    fragment: "npx -y ato-mcp",
  },
  {
    num: "2",
    title: "Onboard",
    body: "Sign in with email, about two minutes.",
    fragment: "ato-mcp.com.au/onboard",
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
    body: "Checks 59 deduction categories and keeps the ones that match your situation — each cited and confidence-rated.",
  },
  {
    name: "depreciation_helper",
    title: "Depreciation, computed not guessed",
    body: "Compares every method — instant write-off, prime cost, diminishing value and more — with year-by-year schedules.",
  },
  {
    name: "bas_prep_checklist",
    title: "BAS prep without the scramble",
    body: "A checklist for your reporting period: which labels apply, what evidence to gather, and the gotchas.",
  },
  {
    name: "audit_risk_check",
    title: "Know what the ATO looks at",
    body: "Reviews a draft return for the red flags the ATO watches, with the guidance behind each one.",
  },
];

const RETRIEVAL_TOOLS = [
  { name: "search", desc: "Search the whole corpus by keyword and meaning" },
  { name: "get_chunks", desc: "Pull full passages with surrounding context" },
  { name: "get_doc", desc: "Fetch a whole document" },
  { name: "get_doc_anchors", desc: "See what a document cites, and what cites it" },
  { name: "get_definition", desc: "Look up legal definitions" },
  { name: "get_threshold", desc: "Current thresholds, caps and rates" },
  { name: "fetch", desc: "Any document as clean markdown" },
  { name: "stats", desc: "Corpus freshness and coverage" },
  { name: "get_user_facts", desc: "Your saved tax profile" },
];

const FAQS = [
  {
    q: "Is this tax advice?",
    a: "No. ato-mcp is information infrastructure: it retrieves and structures published ATO material and computes deterministic schedules, always with citations. Confidence ratings and risk bands are heuristic indicators. Your agent does the reasoning, and material decisions should be verified with a registered tax agent.",
  },
  {
    q: "What does ato-mcp store about me?",
    a: "Your onboarding facts (business structure, GST registration, and so on — about 25 fields you control), a hashed bearer token, and coarse usage events. Never tool names, never query content, never results: the schema physically has nowhere to store them, and the privacy page is generated from that schema so it can't drift.",
  },
  {
    q: "Which agents does it work with?",
    a: "Anything that speaks the Model Context Protocol over stdio — Claude Code and Claude Desktop most prominently, plus any other MCP-capable host. One config line after onboarding.",
  },
  {
    q: "How current is the corpus?",
    a: "The corpus is rebuilt from ato.gov.au, the Federal Register of Legislation and law.ato.gov.au on a monthly cycle and served fresh — the stats tool reports the live snapshot.",
  },
  {
    q: "Is it really open source?",
    a: "The MCP client, the shared tool logic, the hosted backend and this website are MIT-licensed and public. The corpus-building pipeline is maintained privately. For a tool that reads tax law to you, the parts you run are verifiable.",
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
      downloadUrl: "https://www.npmjs.com/package/ato-mcp",
      softwareVersion: "1.1.0",
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
      className="card reveal relative p-6 text-left"
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

/** heynox-style trust strip, light: title/subtitle pairs split by hairlines. */
function HeroTrust({ className = "" }: { className?: string }) {
  return (
    <dl className={`flex w-fit flex-wrap items-center gap-x-6 gap-y-4 ${className}`}>
      {HERO_TRUST.map((t, i) => (
        <Fragment key={t.title}>
          {i > 0 && (
            <span
              className="hidden h-9 w-px shrink-0 bg-zinc-200 sm:block"
              aria-hidden="true"
            />
          )}
          <div>
            <dt className="text-sm text-zinc-900">{t.title}</dt>
            <dd className="text-sm text-zinc-400">{t.sub}</dd>
          </div>
        </Fragment>
      ))}
    </dl>
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
      <section className="relative">
        <div className="px-3 pb-3 pt-3">
          <div className="hero-card flex min-h-[600px] items-center lg:min-h-[calc(100svh-24px)]">
            <span className="hero-glow" aria-hidden="true" />
            <div className="relative grid w-full items-center gap-12 px-[clamp(28px,6vw,88px)] py-28 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
              <div>
                <span
                  className="reveal inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-zinc-500 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  style={{ "--reveal-delay": "0s" } as React.CSSProperties}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
                  v1.1 · open source · MIT
                </span>
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
                  Connect Claude — or any MCP agent — to 29,000+ ATO documents,
                  the ITAA 1997 and 2,127 public rulings. Every answer comes with
                  the section, the ruling and the page.
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
                  npx -y ato-mcp · works with Claude Code, Claude Desktop
                  &amp; any MCP host
                </p>

                {/* Mobile trust strip — in-flow (the desktop one is pinned below) */}
                <HeroTrust className="reveal mt-10 lg:hidden" />
              </div>

              <div className="relative">
                <CitationGraphMotif />
                <HeroDemo />
              </div>
            </div>

            {/* Desktop trust strip — pinned to the card's bottom-left */}
            <HeroTrust className="absolute bottom-[clamp(28px,5vh,56px)] left-[clamp(28px,6vw,88px)] hidden lg:flex" />
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
        <div className="mt-12 grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.num} className="reveal-scroll">
              {/* Visual-first tile (superpower image-card pattern), caption below */}
              <div className="tile flex h-36 items-center justify-center px-5">
                <span className="absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-white font-mono text-[0.6875rem] text-zinc-500 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                  {s.num}
                </span>
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
              Rebuilt monthly, served fresh.{" "}
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
            Tell it about yourself once — your business, GST, investments,
            super — and four built-in tools tailor their answers to you. All of
            it backed by ATO citations.
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
              Nine retrieval tools the workflows are built on — and your agent
              can use directly.{" "}
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
            There&apos;s nowhere to store your questions — the database has no
            table for them. Everything we do store is listed on the privacy
            page, straight from the schema. One button deletes it all.
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
