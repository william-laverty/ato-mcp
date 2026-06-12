"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/#tools", label: "Tools" },
  { href: "/#modes", label: "Local & hosted" },
  { href: "/privacy", label: "Privacy" },
];

const SCROLL_THRESHOLD = 50;

function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="30" height="30" rx="8.5" fill="#fa520f" />
      <circle cx="10.5" cy="16" r="2.6" fill="#ffffff" />
      <rect x="15" y="13.9" width="7.5" height="4.2" rx="2.1" fill="#ffffff" />
    </svg>
  );
}

/**
 * Superpower-style scroll-aware nav (ported from the heynox Header, light
 * treatment only): at the top of the page it reads as a full-width transparent
 * bar — links left, logo centre, CTA right. Scrolling collapses it into a
 * centred floating glass pill (white/80 + blur + hairline + soft shadow).
 * On mobile the pill is always painted and expands downward to reveal the menu.
 */
export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const scrolledRef = useRef(false);

  useEffect(() => {
    let raf = 0;
    const compute = () => {
      raf = 0;
      const next = window.scrollY > SCROLL_THRESHOLD;
      if (scrolledRef.current !== next) {
        scrolledRef.current = next;
        setScrolled(next);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pillPainted = scrolled || open;

  return (
    <header
      className={[
        "fixed inset-x-0 top-0 z-50 px-4 transition-[padding] duration-500 ease-out",
        scrolled ? "py-3" : "py-4",
      ].join(" ")}
    >
      <div
        className={[
          "mx-auto transition-[max-width] duration-500 ease-out will-change-[max-width]",
          scrolled ? "max-w-3xl" : "max-w-6xl",
        ].join(" ")}
      >
        {/* Nav pill — links | logo | CTA. Transparent at top, glass on scroll. */}
        <nav
          aria-label="Main"
          className={[
            "grid grid-cols-[1fr_auto_1fr] items-center rounded-full border px-2 py-1.5 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500 ease-out",
            "max-md:flex max-md:flex-col max-md:items-stretch max-md:gap-0 max-md:rounded-2xl max-md:px-3 max-md:py-1.5",
            pillPainted
              ? "border-black/5 bg-white/80 shadow-[0_4px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl"
              : "border-transparent bg-transparent max-md:border-black/5 max-md:bg-white/80 max-md:shadow-[0_4px_24px_rgba(0,0,0,0.08)] max-md:backdrop-blur-xl",
          ].join(" ")}
        >
          {/* Top row: contents on desktop so the grid owns layout; flex row on mobile. */}
          <div className="[display:contents] max-md:flex max-md:w-full max-md:items-center max-md:justify-between">
            {/* Left — links */}
            <div className="group flex items-center gap-1 justify-self-start max-md:hidden">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-full px-3 py-1.5 text-[13px] text-zinc-700 opacity-100 transition-opacity duration-200 hover:!opacity-100 group-hover:opacity-40"
                >
                  {l.label}
                </Link>
              ))}
            </div>

            {/* Centre — logo */}
            <Link
              href="/"
              className="flex items-center gap-2 justify-self-center px-2 py-1 text-[15px] font-medium tracking-tight1 text-zinc-900 max-md:px-0"
              aria-label="ato-mcp home"
            >
              <Mark />
              ato-mcp
            </Link>

            {/* Right — GitHub + CTA */}
            <div className="flex items-center gap-1 justify-self-end">
              <a
                href="https://github.com/william-laverty/ato-mcp"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full px-3 py-1.5 text-[13px] text-zinc-700 transition-colors hover:text-zinc-900 max-md:hidden"
              >
                GitHub
              </a>
              <Link
                href="/onboard"
                className="btn btn-primary px-4 py-2 text-[13px] max-md:hidden"
              >
                Get started
              </Link>
              {/* Mobile hamburger → ×, inside the pill */}
              <button
                type="button"
                aria-expanded={open}
                aria-label={open ? "Close menu" : "Open menu"}
                onClick={() => setOpen((v) => !v)}
                className="hidden h-9 w-9 items-center justify-center max-md:flex"
              >
                <span
                  className={[
                    "relative block h-px w-4 rounded bg-zinc-900 transition-colors duration-200",
                    "before:absolute before:left-0 before:top-[-5px] before:h-px before:w-full before:rounded before:bg-zinc-900 before:transition-transform before:duration-300",
                    "after:absolute after:left-0 after:top-[5px] after:h-px after:w-full after:rounded after:bg-zinc-900 after:transition-transform after:duration-300",
                    open
                      ? "bg-transparent before:translate-y-[5px] before:rotate-45 after:translate-y-[-5px] after:-rotate-45"
                      : "",
                  ].join(" ")}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          {/* Mobile expandable menu — the pill grows downward (grid-rows trick). */}
          <div
            className={[
              "hidden max-md:grid max-md:transition-[grid-template-rows] max-md:duration-[400ms] max-md:ease-[cubic-bezier(0.22,1,0.36,1)]",
              open
                ? "max-md:visible max-md:grid-rows-[1fr]"
                : "max-md:invisible max-md:grid-rows-[0fr]",
            ].join(" ")}
            aria-hidden={!open}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="flex flex-col gap-0.5 py-2">
                {LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    tabIndex={open ? 0 : -1}
                    className="rounded-lg px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    {l.label}
                  </Link>
                ))}
                <a
                  href="https://github.com/william-laverty/ato-mcp"
                  target="_blank"
                  rel="noopener noreferrer"
                  tabIndex={open ? 0 : -1}
                  className="rounded-lg px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  GitHub
                </a>
                <Link
                  href="/onboard"
                  onClick={() => setOpen(false)}
                  tabIndex={open ? 0 : -1}
                  className="btn btn-primary mb-1.5 mt-2 px-4 py-2.5 text-sm"
                >
                  Get started
                </Link>
              </div>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
