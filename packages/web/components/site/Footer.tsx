import Link from "next/link";

function Mark({ size = 22 }: { size?: number }) {
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

export function Footer() {
  return (
    <footer className="px-3 pb-3">
      <div className="footer-card px-6 pb-8 pt-14 text-zinc-500 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2">
                <Mark />
                <span className="text-[15px] font-medium tracking-tight1 text-zinc-900">
                  ato-mcp
                </span>
              </div>
              <p className="mt-3 max-w-sm text-sm leading-relaxed">
                The Australian tax knowledge base for AI agents — cited retrieval,
                personal context, and tax workflow tools over the Model Context
                Protocol. Open source.
              </p>
              <p className="mt-4 text-xs text-zinc-400">
                Information infrastructure, not tax advice. Verify material
                decisions with a registered tax agent.
              </p>
            </div>
            <nav aria-label="Product" className="text-sm">
              <p className="eyebrow mb-3">Product</p>
              <ul className="space-y-2">
                <li><Link className="transition-colors hover:text-zinc-900" href="/docs">Documentation</Link></li>
                <li><Link className="transition-colors hover:text-zinc-900" href="/onboard">Get started</Link></li>
                <li><Link className="transition-colors hover:text-zinc-900" href="/account">Account</Link></li>
                <li>
                  <a className="transition-colors hover:text-zinc-900" href="https://github.com/william-laverty/ato-mcp" target="_blank" rel="noopener noreferrer">
                    GitHub ↗
                  </a>
                </li>
                <li>
                  <a className="transition-colors hover:text-zinc-900" href="https://www.npmjs.com/package/ato-mcp" target="_blank" rel="noopener noreferrer">
                    npm ↗
                  </a>
                </li>
              </ul>
            </nav>
            <nav aria-label="Trust" className="text-sm">
              <p className="eyebrow mb-3">Trust</p>
              <ul className="space-y-2">
                <li><Link className="transition-colors hover:text-zinc-900" href="/privacy">Privacy</Link></li>
                <li><Link className="transition-colors hover:text-zinc-900" href="/terms">Terms</Link></li>
                <li>
                  <a className="transition-colors hover:text-zinc-900" href="https://github.com/william-laverty/ato-mcp/blob/main/SECURITY.md" target="_blank" rel="noopener noreferrer">
                    Security ↗
                  </a>
                </li>
              </ul>
            </nav>
          </div>

          {/* Oversized wordmark — the one superpower-style flourish (decorative). */}
          <p
            className="mt-14 select-none text-[clamp(3.5rem,14vw,9rem)] font-medium leading-none tracking-tight2 text-zinc-200"
            aria-hidden="true"
          >
            ato-mcp
          </p>

          {/* Legal bar */}
          <div className="mt-10 flex flex-col gap-2 border-t border-zinc-200 pt-6 text-xs text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} William Laverty · MIT licensed</p>
            <p>ATO content remains subject to ATO publication terms.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
