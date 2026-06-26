import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { CorpusFlow } from "../components/site/CorpusFlow";

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

      {/* ------------------------------------------------ corpus → mcp flow */}
      <CorpusFlow />

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
