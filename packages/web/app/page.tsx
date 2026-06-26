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
    graphic: "deductions" as const,
    eyebrow: "Deductions",
    question: "What can I claim this year?",
    answer:
      "It finds every deduction that fits how you work — home office, equipment, software — and backs each one with the exact ATO source.",
    tool: "deduction_discovery",
    chips: ["ITAA 1997 · s 8-1", "PCG 2023/1", "TR 93/30"],
  },
  {
    graphic: "depreciation" as const,
    eyebrow: "Depreciation",
    question: "How do I write off my new laptop?",
    answer:
      "Anything under $300 is claimed straight away; bigger gear is written down over its life. It runs the numbers and shows the rule it used.",
    tool: "depreciation_helper",
    chips: ["ITAA 1997 · Div 40", "s 40-80"],
  },
  {
    graphic: "risk" as const,
    eyebrow: "Audit risk",
    question: "Is anything in my return risky?",
    answer:
      "It checks your return against the ATO's common red flags and shows where you stand. This year you sit comfortably in the low band.",
    tool: "audit_risk_check",
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

/* ---------------------------------------------------------------------------
   Session graphics — small, decorative SVGs in the Clinical style: hairline
   zinc strokes, soft zinc fills, the vermillion accent used once each. They
   visualise what the tool does, so the copy can stay short.
--------------------------------------------------------------------------- */

const GRAPHIC_CLASS = "h-auto w-full max-w-[360px]";

/** deduction_discovery — a taxonomy grid with a few categories "matched". */
function DeductionsGraphic() {
  const cols = 5;
  const rows = 3;
  const tw = 56;
  const th = 40;
  const gx = 16;
  const gy = 16;
  const ox = 10;
  const oy = 10;
  const filled = new Set([0, 1, 3, 4, 6, 8, 9, 11, 12]);
  const matched = new Set([1, 4, 6, 9, 12]);
  const width = ox * 2 + cols * tw + (cols - 1) * gx;
  const height = oy * 2 + rows * th + (rows - 1) * gy;
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const x = ox + c * (tw + gx);
      const y = oy + r * (th + gy);
      const isFilled = filled.has(idx);
      tiles.push(
        <g key={idx}>
          <rect
            x={x}
            y={y}
            width={tw}
            height={th}
            rx="8"
            fill={isFilled ? "#f4f4f5" : "none"}
            stroke={isFilled ? "#d4d4d8" : "#e4e4e7"}
            strokeWidth="1"
          />
          {matched.has(idx) && (
            <circle cx={x + tw - 11} cy={y + 11} r="3" fill="#fa520f" />
          )}
        </g>,
      );
    }
  }
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={GRAPHIC_CLASS}
      fill="none"
      aria-hidden="true"
    >
      {tiles}
    </svg>
  );
}

/** depreciation_helper — a diminishing-value step-down with a curve over it. */
function DepreciationGraphic() {
  const values = [100, 70, 49, 34, 24, 17];
  const bw = 40;
  const gap = 18;
  const ox = 16;
  const baseY = 150;
  const maxH = 120;
  const width = ox * 2 + values.length * bw + (values.length - 1) * gap;
  const bars = values.map((v, i) => {
    const h = (v / 100) * maxH;
    const x = ox + i * (bw + gap);
    const y = baseY - h;
    return (
      <g key={i}>
        <rect
          x={x}
          y={y}
          width={bw}
          height={h}
          rx="4"
          fill="#f4f4f5"
          stroke="#d4d4d8"
          strokeWidth="1"
        />
        {i === 0 && <rect x={x} y={y} width={bw} height="3" rx="1.5" fill="#fa520f" />}
      </g>
    );
  });
  const curve = values
    .map((v, i) => {
      const h = (v / 100) * maxH;
      const x = ox + i * (bw + gap) + bw / 2;
      const y = baseY - h;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} 170`}
      className={GRAPHIC_CLASS}
      fill="none"
      aria-hidden="true"
    >
      {bars}
      <path d={curve} stroke="#d4d4d8" strokeWidth="1.5" strokeDasharray="3 4" />
      <line
        x1={ox - 4}
        y1={baseY + 0.5}
        x2={width - ox + 4}
        y2={baseY + 0.5}
        stroke="#e4e4e7"
        strokeWidth="1"
      />
    </svg>
  );
}

/** audit_risk_check — a LOW/MED/HIGH gauge with the marker resting on LOW. */
function RiskGraphic() {
  const x0 = 18;
  const w = 324;
  const y = 70;
  const h = 14;
  const seg = w / 3;
  const markerX = x0 + seg / 2;
  return (
    <svg
      viewBox="0 0 360 130"
      className={GRAPHIC_CLASS}
      fill="none"
      aria-hidden="true"
    >
      {/* track */}
      <rect x={x0} y={y} width={w} height={h} rx={h / 2} fill="#f4f4f5" />
      {/* low band tinted */}
      <path
        d={`M ${x0 + h / 2} ${y} H ${x0 + seg} V ${y + h} H ${x0 + h / 2} A ${h / 2} ${h / 2} 0 0 1 ${x0 + h / 2} ${y} Z`}
        fill="#fde8df"
      />
      {/* segment dividers */}
      <line x1={x0 + seg} y1={y - 6} x2={x0 + seg} y2={y + h + 6} stroke="#e4e4e7" strokeWidth="1" />
      <line x1={x0 + 2 * seg} y1={y - 6} x2={x0 + 2 * seg} y2={y + h + 6} stroke="#e4e4e7" strokeWidth="1" />
      {/* marker on LOW */}
      <line x1={markerX} y1={y - 14} x2={markerX} y2={y + h} stroke="#fa520f" strokeWidth="1.5" />
      <circle cx={markerX} cy={y - 16} r="5" fill="#fa520f" />
      {/* labels */}
      <text x={markerX} y={y + h + 24} textAnchor="middle" className="font-mono" fontSize="11" fill="#fa520f">LOW</text>
      <text x={x0 + 1.5 * seg} y={y + h + 24} textAnchor="middle" className="font-mono" fontSize="11" fill="#a1a1aa">MED</text>
      <text x={x0 + 2.5 * seg} y={y + h + 24} textAnchor="middle" className="font-mono" fontSize="11" fill="#a1a1aa">HIGH</text>
    </svg>
  );
}

function SessionGraphic({ kind }: { kind: "deductions" | "depreciation" | "risk" }) {
  if (kind === "deductions") return <DeductionsGraphic />;
  if (kind === "depreciation") return <DepreciationGraphic />;
  return <RiskGraphic />;
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
          <div className="hero-card flex min-h-[calc(100svh-24px)] flex-col lg:flex-row lg:items-center">
            <span className="hero-glow" aria-hidden="true" />
            <div className="relative flex w-full flex-1 flex-col px-[clamp(24px,7vw,88px)] py-16 sm:py-20 lg:grid lg:flex-none lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:py-24">
              {/* Main hero block — centred stack on mobile (heynox-style),
                  left-aligned beside the demo on desktop. */}
              <div className="flex flex-1 flex-col items-center justify-center text-center lg:block lg:flex-none lg:text-left">
                <h1
                  className="reveal max-w-[16ch] text-[clamp(2.25rem,8.5vw,3.5rem)] font-normal leading-[1.08] tracking-tight2 text-zinc-900 sm:max-w-none sm:leading-[1.04]"
                  style={{ "--reveal-delay": "0s" } as React.CSSProperties}
                >
                  Your AI agent, fluent in Australian tax
                </h1>
                <p
                  className="reveal mx-auto mt-5 max-w-sm text-[15px] leading-relaxed text-zinc-500 sm:max-w-xl lg:mx-0"
                  style={{ "--reveal-delay": "0.16s" } as React.CSSProperties}
                >
                  Connect Claude — or any MCP agent — to 29,000+ ATO documents,
                  the ITAA 1997 and 2,127 public rulings. Every answer comes with
                  the section, the ruling and the page.
                </p>
                <div
                  className="reveal mt-9 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:justify-center lg:justify-start"
                  style={{ "--reveal-delay": "0.24s" } as React.CSSProperties}
                >
                  <Link
                    href="/onboard"
                    className="btn btn-primary w-full max-w-xs px-7 py-3.5 text-sm sm:w-auto sm:py-3"
                  >
                    Get started free
                  </Link>
                  <Link
                    href="/docs"
                    className="btn btn-outline hidden w-full max-w-xs px-7 py-3.5 text-sm sm:inline-flex sm:w-auto sm:py-3"
                  >
                    Read the docs
                  </Link>
                </div>
              </div>

              {/* Hero demo card — desktop only. On mobile the hero is the
                  centred headline + CTAs + trust strip, so the demo (and its
                  motif) are hidden to keep the first screen tight and fast. */}
              <div className="relative hidden lg:block">
                <CitationGraphMotif />
                <HeroDemo />
              </div>

              {/* Mobile trust strip — pinned to the foot of the full-height hero,
                  centred (the desktop one is absolutely pinned bottom-left). */}
              <HeroTrust className="reveal mt-10 w-full justify-center gap-x-8 border-t border-zinc-100 pt-6 text-center lg:hidden" />
            </div>

            {/* Desktop trust strip — pinned to the card's bottom-left */}
            <HeroTrust className="absolute bottom-[clamp(28px,5vh,56px)] left-[clamp(28px,6vw,88px)] hidden lg:flex" />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ the session */}
      <section
        className="mx-auto max-w-6xl px-5 py-20 sm:py-24"
        aria-labelledby="session-h"
      >
        <p className="eyebrow">A real session</p>
        <h2
          id="session-h"
          className="mt-3 max-w-2xl text-[clamp(1.6rem,3vw,2.25rem)] font-normal leading-[1.1] tracking-tight1"
        >
          One question is never one lookup
        </h2>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-zinc-500">
          Ask in plain English. Every answer comes back with the ATO source
          behind it — and the right tool quietly does the work.
        </p>

        {/* Alternating wide rows: plain-language turn on one side, a graphic
            of what the tool did on the other. Sides swap each turn. */}
        <div className="mt-12 space-y-12 sm:mt-14 sm:space-y-20">
          {SESSION_TURNS.map((turn, i) => (
            <div
              key={turn.question}
              className="reveal-scroll grid items-center gap-6 sm:gap-14 lg:grid-cols-2"
            >
              {/* Graphic always follows the question on mobile (order-2); on
                  desktop the sides alternate each turn. */}
              <div className={`order-2 ${i % 2 === 1 ? "lg:order-2" : "lg:order-1"}`}>
                <div className="tile flex min-h-[180px] items-center justify-center p-6 sm:min-h-[280px] sm:p-12">
                  <SessionGraphic kind={turn.graphic} />
                </div>
              </div>
              <div className={`order-1 ${i % 2 === 1 ? "lg:order-1" : "lg:order-2"}`}>
                <p className="eyebrow">{turn.eyebrow}</p>
                <h3 className="mt-3 max-w-md text-[clamp(1.25rem,2.2vw,1.6rem)] font-normal leading-[1.15] tracking-tight1 text-zinc-900">
                  {turn.question}
                </h3>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-zinc-600 sm:text-base">
                  {turn.answer}
                </p>
                <div className="mt-5 flex flex-wrap gap-1.5" aria-label="Citations">
                  {turn.chips.map((c) => (
                    <span key={c} className="chip">
                      <span className="chip-dot" />
                      {c}
                    </span>
                  ))}
                </div>
                <p className="mt-3 font-mono text-[0.6875rem] text-zinc-400">
                  {turn.tool}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ corpus */}
      {/* Contained in its own rounded card, matching the hero card chrome
          (24px radius, hairline border, warm paper, layered shadow) and its
          12px edge inset (px-3); content stays centred at max-w-6xl inside. */}
      <section className="px-3 py-12 sm:py-16" aria-labelledby="corpus-h">
        <div className="hero-card px-[clamp(24px,6vw,88px)] py-14 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_260px] lg:gap-12">
            <div>
              <p className="eyebrow">The corpus</p>
              <h2
                id="corpus-h"
                className="mt-3 max-w-xl text-[clamp(1.6rem,3vw,2.25rem)] font-normal leading-[1.1] tracking-tight1"
              >
                The whole landscape, indexed — guidance, statute and rulings
                in one graph
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
            <div className="border-t border-zinc-200 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              <ol>
                {CORPUS_INDEX.map((i, idx) => (
                  <li
                    key={i.num}
                    className={`flex items-baseline justify-between gap-4 py-4 ${
                      idx < CORPUS_INDEX.length - 1 ? "border-b border-zinc-200" : ""
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
        </div>
      </section>

      {/* ------------------------------------------------ FAQ */}
      <section className="mx-auto max-w-3xl px-5 pb-20 sm:pb-24" aria-labelledby="faq-h">
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
          <h2 className="text-[clamp(1.65rem,6vw,2.5rem)] font-normal leading-[1.1] tracking-tight2 text-zinc-900">
            Two minutes to a tax-fluent agent
          </h2>
          <p className="mt-4 text-[15px] text-zinc-500">
            Onboard, paste one config line, ask better questions.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href="/onboard"
              className="btn btn-primary w-full px-7 py-3.5 text-sm sm:w-auto sm:py-3"
            >
              Get started free
            </Link>
            <a
              href="https://github.com/william-laverty/ato-mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline w-full px-7 py-3.5 text-sm sm:w-auto sm:py-3"
            >
              Star on GitHub
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
