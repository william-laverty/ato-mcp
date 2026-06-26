"use client";

import { useEffect, useRef, useState } from "react";

type Stat = { value: number; display: string; label: string };
type Act = {
  num: string;
  kicker: string;
  body: string;
  sources?: readonly string[];
  stats?: readonly Stat[];
  fragment?: string;
  chips?: readonly string[];
};

const ACTS: readonly Act[] = [
  {
    num: "01",
    kicker: "Sources",
    body: "Everything the ATO publishes, in one place — its website guidance, the Income Tax Act itself, and its official rulings.",
    sources: ["ATO website", "Income Tax Act", "Public rulings"],
  },
  {
    num: "02",
    kicker: "One library",
    body: "Brought together and cross-linked, so every ruling points back to the law behind it.",
    stats: [
      { value: 224585, display: "224,585", label: "searchable passages" },
      { value: 4638, display: "4,638", label: "Income Tax Act sections" },
      { value: 23267, display: "23,267", label: "citation links" },
    ],
  },
  {
    num: "03",
    kicker: "Connect",
    body: "Plug it into Claude — or any AI agent — with a single line, and tell it a little about your situation.",
    fragment: "npx -y ato-mcp",
  },
  {
    num: "04",
    kicker: "Just ask",
    body: "Ask in plain English. Your agent answers from the library and shows the exact sources behind every line.",
    chips: ["ITAA s 8-1", "TR 93/30", "PCG 2023/1"],
  },
];

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

export function useCountUp(target: number, run: boolean, reduced: boolean) {
  const [val, setVal] = useState(target); // SSR + first client render = final (no hydration mismatch)
  const started = useRef(false);
  useEffect(() => {
    if (!run || reduced || started.current) return;
    started.current = true;
    const duration = 1100;
    let raf = 0;
    let start = 0;
    setVal(0);
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, reduced, target]);
  return val;
}

function StepProof({ act }: { act: Act }) {
  if (act.sources) {
    return (
      <ul className="mt-4 flex flex-wrap gap-2">
        {act.sources.map((s) => (
          <li key={s} className="badge">
            {s}
          </li>
        ))}
      </ul>
    );
  }
  if (act.stats) {
    return (
      <dl className="mt-5 grid max-w-md grid-cols-3 gap-4">
        {act.stats.map((s) => (
          <div key={s.label}>
            <dt className="text-[1.5rem] leading-none tracking-tight1 text-zinc-900">
              <span>{s.display}</span>
            </dt>
            <dd className="mt-1.5 text-xs text-zinc-400">{s.label}</dd>
          </div>
        ))}
      </dl>
    );
  }
  if (act.fragment) {
    return <p className="code-block mt-4 inline-block">{act.fragment}</p>;
  }
  if (act.chips) {
    return (
      <div className="mt-4 flex flex-wrap gap-1.5">
        {act.chips.map((c) => (
          <span key={c} className="chip">
            <span className="chip-dot" />
            {c}
          </span>
        ))}
      </div>
    );
  }
  return null;
}

export function CorpusVisual({ step }: { step: number }) {
  const reduced = useReducedMotion();
  const stats = ACTS[1]!.stats!;
  const counts = [
    useCountUp(stats[0]!.value, step >= 1, reduced),
    useCountUp(stats[1]!.value, step >= 1, reduced),
    useCountUp(stats[2]!.value, step >= 1, reduced),
  ];

  return (
    <div className="corpus-visual" data-step={step} aria-hidden="true">
      {/* citation graph */}
      <svg
        className="cf-graph absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
      >
        <g stroke="#e4e4e7" strokeWidth="0.5">
          <path className="cf-link" d="M30 30 L52 44" />
          <path className="cf-link" d="M52 44 L74 32" />
          <path className="cf-link" d="M52 44 L70 64" />
          <path className="cf-link" d="M30 66 L52 44" />
          <path className="cf-link" d="M70 64 L74 32" />
        </g>
        <g>
          <circle cx="30" cy="30" r="1.6" fill="#d4d4d8" />
          <circle cx="52" cy="44" r="2.2" fill="#fa520f" opacity="0.55" />
          <circle cx="74" cy="32" r="1.6" fill="#d4d4d8" />
          <circle cx="70" cy="64" r="1.6" fill="#d4d4d8" />
          <circle cx="30" cy="66" r="1.6" fill="#d4d4d8" />
        </g>
      </svg>

      {/* act 0 — sources */}
      <div className="cf-sources absolute left-6 top-1/2 -translate-y-1/2 space-y-3">
        {ACTS[0]!.sources!.map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            <span className="font-mono text-[0.6875rem] text-zinc-500">{s}</span>
          </div>
        ))}
      </div>

      {/* act 1 — counting stats */}
      <div className="cf-stats absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
        {stats.map((s, i) => (
          <div key={s.label}>
            <div
              className="text-[1.75rem] leading-none tracking-tight1 text-zinc-900"
              suppressHydrationWarning
            >
              {counts[i]!.toLocaleString("en-AU")}
            </div>
            <div className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-zinc-400">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* act 2 — connect */}
      <div className="cf-agent absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="card px-3 py-2 font-mono text-[0.6875rem] text-zinc-600">
          npx -y ato-mcp
        </div>
      </div>

      {/* act 3 — query + citations */}
      <div className="cf-query absolute inset-x-6 bottom-8">
        <div className="card p-3 text-left">
          <p className="font-mono text-[0.6875rem] text-zinc-400">
            › what can I claim?
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ACTS[3]!.chips!.map((c) => (
              <span key={c} className="chip">
                <span className="chip-dot" />
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CorpusFlow() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActive(Number((e.target as HTMLElement).dataset.index));
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    refs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <section
      className="mx-auto max-w-6xl px-5 py-20 sm:py-24"
      aria-labelledby="flow-h"
    >
      <div className="text-center">
        <p className="eyebrow">How it works</p>
        <h2
          id="flow-h"
          className="mx-auto mt-3 max-w-2xl text-[clamp(1.6rem,3vw,2.25rem)] font-normal leading-[1.1] tracking-tight1"
        >
          Every word the ATO publishes — one question away
        </h2>
      </div>

      <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-2 lg:gap-16">
        {/* sticky visual (desktop only) */}
        <div className="hidden lg:block">
          <div className="sticky top-0 flex h-screen items-center">
            <div className="tile aspect-square w-full">
              <CorpusVisual step={active} />
            </div>
          </div>
        </div>

        {/* scrolling steps */}
        <ol data-testid="corpus-flow-steps" className="space-y-12 lg:space-y-0">
          {ACTS.map((act, i) => (
            <li
              key={act.num}
              data-index={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              className="reveal-scroll lg:flex lg:min-h-screen lg:flex-col lg:justify-center"
            >
              <p className="eyebrow">
                {act.num} · {act.kicker}
              </p>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-zinc-600">
                {act.body}
              </p>
              <StepProof act={act} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
