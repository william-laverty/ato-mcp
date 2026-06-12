import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/* ---------------------------------------------------------------------------
   Landing page. Dark hero card over a layered radial mesh, an agent-answer
   terminal with live-looking citations, light bento corpus stats, the four
   workflow tools, modes, privacy and FAQ. All motion is CSS-only.
--------------------------------------------------------------------------- */

const RULING_CHIPS = [
  "ITAA 1997 · s 8-1", "TR 97/12", "PCG 2023/1", "GSTR 2000/27", "Div 40",
  "TD 2024/3", "ITAA 1997 · s 40-25", "LCR 2019/1", "Div 328", "TR 2026/1",
  "MT 2027", "ITAA 1997 · Div 30", "GSTD 2014/3", "TR 2021/4", "Div 43",
  "CR 2018/37", "ITAA 1997 · s 25-10", "FTR 2012/1", "PR 2006/114", "Div 35",
];

const STATS = [
  { n: "29,181", label: "documents", sub: "ato.gov.au · legislation · rulings" },
  { n: "224,585", label: "chunks", sub: "hybrid BM25 + vector indexed" },
  { n: "4,638", label: "ITAA 1997 sections", sub: "+ 1,929 statutory definitions" },
  { n: "2,127", label: "public rulings", sub: "typed across 10 ruling series" },
  { n: "23,267", label: "citation edges", sub: "rulings ⇄ legislation graph" },
  { n: "13", label: "MCP tools", sub: "retrieval · context · workflows" },
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

function HeroTerminal() {
  return (
    <div className="term reveal p-5 text-left font-mono text-[0.78rem] leading-relaxed sm:p-6" style={{ "--reveal-delay": "0.45s" } as React.CSSProperties}>
      <div className="mb-4 flex items-center gap-1.5" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="ml-3 text-[0.68rem] tracking-wide text-white/30">claude · ato-mcp connected</span>
      </div>
      <p className="text-white/55">
        <span className="text-ember">›</span> can I claim my home office as a sole trader?
      </p>
      <p className="mt-3 text-white/85">
        Yes — running expenses are deductible, and because part of your home is a
        genuine place of business you may also claim occupancy costs (with a CGT
        trade-off worth knowing about). Two methods apply:
      </p>
      <p className="mt-2 text-white/70">
        — fixed-rate <span className="text-brand-soft">(PCG 2023/1)</span>: cents per hour, bundles energy, phone &amp; internet
        <br />— actual cost <span className="text-brand-soft">(TR 93/30)</span>: work-share of real running costs
      </p>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Citations">
        <span className="chip"><span className="chip-dot" />ITAA 1997 · s 8-1</span>
        <span className="chip"><span className="chip-dot" />PCG 2023/1</span>
        <span className="chip"><span className="chip-dot" />TR 93/30</span>
        <span className="chip"><span className="chip-dot" />Home-based business expenses</span>
      </div>
      <p className="term-cursor mt-4 text-white/40">resolved 4 citations · deduction_discovery → 32 categories for your profile</p>
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
      <section className="px-3 pt-2 sm:px-4">
        <div className="mesh-night grain relative overflow-hidden rounded-[1.6rem] px-5 pb-12 pt-16 sm:px-10 sm:pb-16 sm:pt-24">
          <div className="relative z-10 mx-auto max-w-6xl">
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <p className="reveal inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-[0.7rem] font-medium tracking-wide text-white/75" style={{ "--reveal-delay": "0s" } as React.CSSProperties}>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-ember shadow-[0_0_8px_rgba(255,154,60,0.9)]" />
                  v1.0 · open source · MIT
                </p>
                <h1 className="reveal mt-6 text-[clamp(2.4rem,5.4vw,4.1rem)] font-medium leading-[1.02] tracking-snugger text-[#f4f2f7]" style={{ "--reveal-delay": "0.1s" } as React.CSSProperties}>
                  Your AI agent just became{" "}
                  <i className="font-serif italic text-brand-soft">fluent</i> in
                  Australian tax<span className="text-ember">.</span>
                </h1>
                <p className="reveal mt-5 max-w-xl text-[0.98rem] leading-relaxed text-white/75" style={{ "--reveal-delay": "0.22s" } as React.CSSProperties}>
                  ato-mcp gives Claude — and any MCP agent — cited, current retrieval
                  over 29,000+ ATO documents, the ITAA 1997 and 2,127 public rulings,
                  plus workflow tools that already know your taxpayer shape.
                  Answers come with the section, the ruling and the page. Not vibes.
                </p>
                <div className="reveal mt-8 flex flex-wrap items-center gap-3" style={{ "--reveal-delay": "0.34s" } as React.CSSProperties}>
                  <Link href="/onboard" className="btn btn-solid px-6 py-3 text-sm">
                    Get started free
                  </Link>
                  <Link href="/docs" className="btn btn-ghost-dark px-6 py-3 text-sm">
                    Read the docs
                  </Link>
                </div>
                <p className="reveal mt-5 font-mono text-[0.72rem] text-white/40" style={{ "--reveal-delay": "0.4s" } as React.CSSProperties}>
                  npm i -g @ato-mcp/mcp · works with Claude Code, Claude Desktop &amp; any MCP host
                </p>
              </div>
              <HeroTerminal />
            </div>

            {/* ruling marquee */}
            <div className="marquee mt-14" aria-hidden="true">
              <div className="marquee-track animate-chipMarquee">
                {[...RULING_CHIPS, ...RULING_CHIPS].map((c, i) => (
                  <span key={i} className="whitespace-nowrap rounded-full border border-white/10 px-3.5 py-1.5 font-mono text-[0.68rem] text-white/45">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ corpus bento */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:py-28" aria-labelledby="corpus-h">
        <p className="eyebrow text-brand">The corpus</p>
        <h2 id="corpus-h" className="mt-3 max-w-2xl text-[clamp(1.7rem,3.4vw,2.6rem)] font-medium leading-tight tracking-snugger">
          The whole landscape, <i className="font-serif italic text-brand">indexed</i> —
          guidance, statute and rulings in one graph.
        </h2>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.label} className="card-light dotgrid reveal-scroll p-5 sm:p-6">
              <p className="grad-text text-[clamp(1.8rem,3.6vw,2.8rem)] font-bold tracking-snugger">{s.n}</p>
              <p className="mt-1 text-sm font-semibold">{s.label}</p>
              <p className="mt-1 text-xs text-ink/50">{s.sub}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-ink/55">
          Rebuilt monthly. Point-in-time aware. Every release sha256-verified.{" "}
          <Link href="/docs" className="font-medium text-brand underline-offset-4 hover:underline">
            See what&apos;s inside →
          </Link>
        </p>
      </section>

      {/* ------------------------------------------------ workflows */}
      <section id="tools" className="px-3 sm:px-4" aria-labelledby="tools-h">
        <div className="mesh-dark-band grain relative overflow-hidden rounded-[1.6rem] px-5 py-20 sm:px-10 sm:py-24">
          <div className="relative z-10 mx-auto max-w-6xl">
            <p className="eyebrow text-brand-soft">Workflow tools</p>
            <h2 id="tools-h" className="mt-3 max-w-2xl text-[clamp(1.7rem,3.4vw,2.6rem)] font-medium leading-tight tracking-snugger text-[#f4f2f7]">
              Not a search box. <i className="font-serif italic text-brand-soft">Workflows</i>{" "}
              that know who&apos;s asking.
            </h2>
            <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed text-white/65">
              Onboard once — business structure, GST status, investments, super — and
              the four hero tools branch for your exact taxpayer shape. Every output is
              structured data plus resolvable ATO citations: your agent reasons, you verify.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {WORKFLOWS.map((w) => (
                <article key={w.name} className="card-night reveal-scroll p-6">
                  <p className="font-mono text-[0.72rem] text-ember">{w.name}</p>
                  <h3 className="mt-2 text-lg font-semibold text-[#f4f2f7]">{w.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/65">{w.body}</p>
                </article>
              ))}
            </div>
            <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="eyebrow text-white/40">Plus the retrieval layer</p>
              <p className="mt-2.5 font-mono text-[0.78rem] leading-loose text-white/60">
                search · get_chunks · get_doc · get_doc_anchors · get_definition ·
                get_threshold · fetch · stats · get_user_facts
              </p>
              <p className="mt-2 text-sm text-white/55">
                Hybrid BM25 + vector search, a 23,267-edge citation graph, statutory
                definitions and time-keyed thresholds — the substrate the workflows stand on.{" "}
                <Link href="/docs" className="font-medium text-brand-soft underline-offset-4 hover:underline">
                  Full tool reference →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ modes */}
      <section id="modes" className="mx-auto max-w-6xl px-5 py-20 sm:py-28" aria-labelledby="modes-h">
        <p className="eyebrow text-brand">Two ways to run it</p>
        <h2 id="modes-h" className="mt-3 max-w-2xl text-[clamp(1.7rem,3.4vw,2.6rem)] font-medium leading-tight tracking-snugger">
          Your tax data, <i className="font-serif italic text-brand">your terms</i>.
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="card-light dotgrid reveal-scroll p-7">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Local</h3>
              <span className="rounded-full bg-ink px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-caps text-white">offline</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink/65">
              A ~1 GB SQLite corpus on your disk, embeddings via ONNX on your CPU.
              Queries never leave the machine — there is nothing to trust because
              nothing is sent.
            </p>
            <pre className="mt-5 overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[0.72rem] leading-relaxed text-white/85"><code>{`npm install -g @ato-mcp/mcp
ato-mcp update   # download + verify corpus
claude mcp add ato-mcp -- ato-mcp mcp`}</code></pre>
            <p className="mt-3 text-xs text-ink/45">Free forever · monthly corpus releases · sha256-verified</p>
          </div>
          <div className="card-light dotgrid reveal-scroll p-7">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Hosted</h3>
              <span className="rounded-full bg-brand px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-caps text-white">zero download</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink/65">
              Same tools, served from api.ato-mcp.com.au over TLS with a personal
              bearer token. Always the freshest corpus; tool calls are never logged —
              and the server code is open source, so you can check.
            </p>
            <pre className="mt-5 overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[0.72rem] leading-relaxed text-white/85"><code>{`npm install -g @ato-mcp/mcp
ato-mcp onboard  # browser onboarding, ~2 min
claude mcp add ato-mcp -- ato-mcp mcp`}</code></pre>
            <p className="mt-3 text-xs text-ink/45">Magic-link sign-in · revocable tokens · row-level security</p>
          </div>
        </div>
        <p className="mt-6 text-sm text-ink/55">
          Both modes run the <span className="font-medium text-ink">identical shared tool core</span> —
          behaviour can&apos;t drift between them, because it&apos;s the same code.
        </p>
      </section>

      {/* ------------------------------------------------ privacy strip */}
      <section className="mx-auto max-w-6xl px-5 pb-20 sm:pb-28" aria-labelledby="privacy-h">
        <div className="card-light relative overflow-hidden p-8 sm:p-10">
          <div className="max-w-3xl">
            <p className="eyebrow text-brand">Privacy, by construction</p>
            <h2 id="privacy-h" className="mt-3 text-[clamp(1.4rem,2.6vw,2rem)] font-medium leading-tight tracking-snugger">
              The privacy policy is <i className="font-serif italic text-brand">generated from the database schema</i> —
              so it can&apos;t lie.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ink/65">
              Hosted mode has no table for queries, tool calls or results — the data
              model physically can&apos;t retain them. The privacy page renders every stored
              field straight from the schema, and a contract test fails the build if a
              field goes undocumented. Personal rows are isolated with Postgres
              row-level security, and one button deletes everything.
            </p>
            <Link href="/privacy" className="btn btn-ghost-light mt-6 px-5 py-2.5 text-sm">
              Read the privacy policy
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ FAQ */}
      <section className="mx-auto max-w-3xl px-5 pb-24" aria-labelledby="faq-h">
        <p className="eyebrow text-center text-brand">FAQ</p>
        <h2 id="faq-h" className="mt-3 text-center text-[clamp(1.7rem,3.2vw,2.4rem)] font-medium tracking-snugger">
          The questions that <i className="font-serif italic text-brand">matter</i>.
        </h2>
        <div className="mt-10 space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-black/[0.07] bg-paper px-6 py-4 open:bg-white open:shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[0.95rem] font-semibold marker:hidden">
                {f.q}
                <span className="text-lg text-brand transition-transform duration-300 group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink/65">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ final CTA */}
      <section className="px-3 pb-4 sm:px-4">
        <div className="mesh-night grain relative overflow-hidden rounded-[1.6rem] px-6 py-20 text-center sm:py-24">
          <div className="relative z-10 mx-auto max-w-2xl">
            <h2 className="text-[clamp(1.9rem,4vw,3rem)] font-medium leading-tight tracking-snugger text-[#f4f2f7]">
              Two minutes to a <i className="font-serif italic text-brand-soft">tax-fluent</i> agent.
            </h2>
            <p className="mt-4 text-[0.95rem] text-white/65">
              Onboard, paste one config line, ask better questions.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/onboard" className="btn btn-solid px-7 py-3 text-sm">Get started free</Link>
              <a
                href="https://github.com/william-laverty/ato-mcp"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost-dark px-7 py-3 text-sm"
              >
                Star on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
