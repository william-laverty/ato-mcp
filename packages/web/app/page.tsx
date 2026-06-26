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

const SESSION_TURNS = [
  {
    prompt: "I run a software business from home — what can I claim this year?",
    summary:
      "Plenty — and because part of your home is a genuine place of business, you reach beyond the obvious running costs:",
    points: [
      "Home-office running costs — energy, phone & internet (fixed-rate or actual cost)",
      "Equipment under $300 — deductible immediately, in full",
      "Software subscriptions, professional memberships & insurances",
    ],
    toolTag: "deduction_discovery → 32 categories matched",
    chips: [
      "ITAA 1997 · s 8-1",
      "PCG 2023/1",
      "TR 93/30",
      "Home-based business expenses",
    ],
  },
  {
    prompt:
      "I bought a $4,200 laptop and a $280 monitor — how do I write those off?",
    summary:
      "They split on the $300 line. The monitor is immediate; the laptop is depreciated over its effective life:",
    points: [
      "Monitor ($280) — under $300, claim the full amount this year",
      "Laptop ($4,200) — diminishing value or prime cost across its effective life",
    ],
    toolTag: "depreciation_helper → 2 assets, 2 methods",
    chips: ["ITAA 1997 · Div 40", "s 40-80"],
  },
  {
    prompt: "Before I lodge — anything that looks risky?",
    summary:
      "Two items worth a second look, but nothing alarming — your overall profile lands in the low band:",
    points: [
      "Home-office claim is above the occupation average — keep your hours log",
      "Risk bands are heuristic indicators, not a prediction of audit",
    ],
    toolTag: "audit_risk_check → 13 rules · band LOW",
    chips: ["Tax-time toolkit", "PCG 2021/4"],
  },
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
    <dl className={`flex flex-wrap items-center gap-x-6 gap-y-4 ${className}`}>
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
      {/* -mt-16 cancels the layout's global `pt-16` (which clears the fixed nav
          for every other page) so the hero card goes full-bleed to the top and
          the nav floats *over* the card — content is centred well clear of it. */}
      <section className="relative -mt-16">
        <div className="px-3 pb-3 pt-3">
          <div className="hero-card flex min-h-[600px] items-center lg:min-h-[calc(100svh-24px)]">
            <span className="hero-glow" aria-hidden="true" />
            <div className="relative grid w-full items-center gap-12 px-[clamp(28px,6vw,88px)] py-28 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
              <div>
                <h1
                  className="reveal text-[clamp(2.5rem,5vw,3.5rem)] font-normal leading-[1.04] tracking-tight2 text-zinc-900"
                  style={{ "--reveal-delay": "0s" } as React.CSSProperties}
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
                {/* Mobile trust strip — in-flow (the desktop one is pinned below) */}
                <HeroTrust className="reveal mt-10 w-full border-t border-zinc-100 pt-6 lg:hidden" />
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

      {/* ------------------------------------------------ the session */}
      <section
        className="mx-auto max-w-3xl px-5 py-20 sm:py-24"
        aria-labelledby="session-h"
      >
        <p className="eyebrow">A real session</p>
        <h2
          id="session-h"
          className="mt-3 text-[clamp(1.6rem,3vw,2.25rem)] font-normal leading-[1.1] tracking-tight1"
        >
          One question is never one lookup
        </h2>

        {/* Vertical thread: hairline rail + node per turn (echoes the
            CitationGraphMotif). Decorative rail is aria-hidden. */}
        <ol className="relative mt-12 border-l border-zinc-200 pl-8">
          {SESSION_TURNS.map((turn) => (
            <li key={turn.prompt} className="reveal-scroll relative pb-12 last:pb-0">
              <span
                className="absolute -left-[37px] top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-zinc-300 bg-white"
                aria-hidden="true"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
              </span>
              <p className="font-mono text-[0.8125rem] text-zinc-400">
                › {turn.prompt}
              </p>
              <div className="card mt-3 p-5 text-left">
                <p className="text-sm leading-relaxed text-zinc-700">
                  {turn.summary}
                </p>
                {turn.points && (
                  <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-zinc-500">
                    {turn.points.map((pt) => (
                      <li key={pt} className="flex gap-2">
                        <span className="text-zinc-300" aria-hidden="true">
                          —
                        </span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Citations">
                  {turn.chips.map((c) => (
                    <span key={c} className="chip">
                      <span className="chip-dot" />
                      {c}
                    </span>
                  ))}
                </div>
                <p className="mt-4 border-t border-zinc-100 pt-3 font-mono text-[0.6875rem] text-zinc-400">
                  {turn.toolTag}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-2 text-sm text-zinc-500">
          Three tools, one thread — every figure traceable.
        </p>
      </section>

      {/* ------------------------------------------------ corpus */}
      <section
        className="mx-auto max-w-6xl px-5 py-20 sm:py-24"
        aria-labelledby="corpus-h"
      >
        <div className="grid gap-12 lg:grid-cols-[1fr_260px]">
          <div>
            <p className="eyebrow">The corpus</p>
            <h2
              id="corpus-h"
              className="mt-3 max-w-xl text-[clamp(1.6rem,3vw,2.25rem)] font-normal leading-[1.1] tracking-tight1"
            >
              Every chip above resolves to this — guidance, statute and
              rulings in one graph
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
