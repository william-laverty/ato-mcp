"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/#tools", label: "Tools" },
  { href: "/#modes", label: "Local & hosted" },
  { href: "/privacy", label: "Privacy" },
];

/**
 * Fixed pill navigation. Transparent and wide at the top of the page;
 * compresses into a frosted-glass pill once the user scrolls.
 */
export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <nav
        aria-label="Main"
        className={[
          "flex w-full items-center justify-between rounded-full border px-5 transition-all duration-500",
          scrolled
            ? "max-w-4xl border-black/10 bg-white/80 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.1)] backdrop-blur-xl"
            : "max-w-6xl border-transparent bg-transparent py-3.5",
        ].join(" ")}
      >
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-snugger text-ink"
          aria-label="ato-mcp home"
        >
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="28" height="28" rx="9" fill="#5039bd" />
            <circle cx="12" cy="16" r="3.2" fill="#f4f2f7" />
            <circle cx="21.5" cy="10.5" r="2.3" fill="#c794ff" />
            <circle cx="21.5" cy="21.5" r="2.3" fill="#ff9a3c" />
            <path d="M14.8 14.6l4.4-3M14.8 17.4l4.4 3" stroke="#f4f2f7" strokeWidth="1.6" />
          </svg>
          ato-mcp
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[0.8rem] font-medium text-ink/70 transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
          <a
            href="https://github.com/william-laverty/ato-mcp"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[0.8rem] font-medium text-ink/70 transition-colors hover:text-ink"
          >
            GitHub
          </a>
          <Link href="/onboard" className="btn btn-solid px-4 py-2 text-[0.8rem]">
            Get started
          </Link>
        </div>

        <button
          type="button"
          aria-expanded={open}
          aria-label="Toggle menu"
          onClick={() => setOpen(!open)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/70 md:hidden"
        >
          <svg width="15" height="15" viewBox="0 0 14 14" aria-hidden="true">
            {open ? (
              <path d="M2 2l10 10M12 2L2 12" stroke="#0b0b14" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <g fill="#0b0b14">
                <circle cx="3" cy="3" r="1.4" /><circle cx="11" cy="3" r="1.4" />
                <circle cx="3" cy="11" r="1.4" /><circle cx="11" cy="11" r="1.4" />
              </g>
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="absolute inset-x-4 top-[4.4rem] rounded-2xl border border-black/10 bg-white/95 p-4 shadow-xl backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink/80 hover:bg-black/5"
              >
                {l.label}
              </Link>
            ))}
            <a
              href="https://github.com/william-laverty/ato-mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink/80 hover:bg-black/5"
            >
              GitHub
            </a>
            <Link
              href="/onboard"
              onClick={() => setOpen(false)}
              className="btn btn-solid mt-2 px-4 py-2.5 text-sm"
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
