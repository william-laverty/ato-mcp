import Link from "next/link";

export function Footer() {
  return (
    <footer className="relative overflow-hidden rounded-t-[1.6rem] bg-night px-6 pb-8 pt-16 text-white/70 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <p className="text-sm font-semibold text-white">ato-mcp</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed">
              The Australian tax knowledge base for AI agents — cited retrieval,
              personal context, and tax workflow tools over the Model Context
              Protocol. Open source, local or hosted.
            </p>
            <p className="mt-4 text-xs text-white/40">
              Information infrastructure, not tax advice. Verify material
              decisions with a registered tax agent.
            </p>
          </div>
          <nav aria-label="Product" className="text-sm">
            <p className="eyebrow mb-3 text-white/40">Product</p>
            <ul className="space-y-2">
              <li><Link className="transition-colors hover:text-white" href="/docs">Documentation</Link></li>
              <li><Link className="transition-colors hover:text-white" href="/onboard">Get started</Link></li>
              <li><Link className="transition-colors hover:text-white" href="/account">Account</Link></li>
              <li>
                <a className="transition-colors hover:text-white" href="https://github.com/william-laverty/ato-mcp" target="_blank" rel="noopener noreferrer">
                  GitHub ↗
                </a>
              </li>
              <li>
                <a className="transition-colors hover:text-white" href="https://www.npmjs.com/package/@ato-mcp/mcp" target="_blank" rel="noopener noreferrer">
                  npm ↗
                </a>
              </li>
            </ul>
          </nav>
          <nav aria-label="Legal" className="text-sm">
            <p className="eyebrow mb-3 text-white/40">Trust</p>
            <ul className="space-y-2">
              <li><Link className="transition-colors hover:text-white" href="/privacy">Privacy</Link></li>
              <li><Link className="transition-colors hover:text-white" href="/terms">Terms</Link></li>
              <li>
                <a className="transition-colors hover:text-white" href="https://github.com/william-laverty/ato-mcp/blob/main/SECURITY.md" target="_blank" rel="noopener noreferrer">
                  Security ↗
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} William Laverty · MIT licensed</p>
          <p>ATO content remains subject to ATO publication terms.</p>
        </div>

        <p aria-hidden="true" className="wordmark mt-10 text-center text-[clamp(4.5rem,18vw,15rem)]">
          ato-mcp
        </p>
      </div>
    </footer>
  );
}
