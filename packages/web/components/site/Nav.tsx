"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/#tools", label: "Tools" },
  { href: "/#modes", label: "Local & hosted" },
  { href: "/privacy", label: "Privacy" },
];

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
 * Fixed full-width white navigation. A hairline bottom border appears
 * once the user scrolls.
 */
export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={[
        "fixed inset-x-0 top-0 z-50 bg-white transition-[border-color] duration-200",
        scrolled || open ? "border-b border-zinc-200" : "border-b border-transparent",
      ].join(" ")}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5"
      >
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[15px] font-medium tracking-tight1 text-zinc-900"
          aria-label="ato-mcp home"
        >
          <Mark />
          ato-mcp
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[13px] text-zinc-500 transition-colors hover:text-zinc-900"
            >
              {l.label}
            </Link>
          ))}
          <a
            href="https://github.com/william-laverty/ato-mcp"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-zinc-500 transition-colors hover:text-zinc-900"
          >
            GitHub
          </a>
          <Link href="/onboard" className="btn btn-primary px-4 py-2 text-[13px]">
            Get started
          </Link>
        </div>

        <button
          type="button"
          aria-expanded={open}
          aria-label="Toggle menu"
          onClick={() => setOpen(!open)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white md:hidden"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            {open ? (
              <path
                d="M2 2l10 10M12 2L2 12"
                stroke="#18181b"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ) : (
              <g stroke="#18181b" strokeWidth="1.5" strokeLinecap="round">
                <path d="M1 4h12" />
                <path d="M1 10h12" />
              </g>
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-t border-zinc-100 bg-white px-5 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                {l.label}
              </Link>
            ))}
            <a
              href="https://github.com/william-laverty/ato-mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              GitHub
            </a>
            <Link
              href="/onboard"
              onClick={() => setOpen(false)}
              className="btn btn-primary mt-2 px-4 py-2.5 text-sm"
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
