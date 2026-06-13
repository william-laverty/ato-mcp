import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white px-5 pb-10 pt-14 text-zinc-500">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <p className="text-sm font-medium text-zinc-900">ato-mcp</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed">
              The Australian tax knowledge base for AI agents — cited retrieval,
              personal context, and tax workflow tools over the Model Context
              Protocol. Open source, local or hosted.
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
                <a className="transition-colors hover:text-zinc-900" href="https://www.npmjs.com/package/@ato-mcp/mcp" target="_blank" rel="noopener noreferrer">
                  npm ↗
                </a>
              </li>
            </ul>
          </nav>
          <nav aria-label="Legal" className="text-sm">
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

        <div className="mt-12 flex flex-col gap-2 border-t border-zinc-100 pt-6 text-xs text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} William Laverty · MIT licensed</p>
          <p>ATO content remains subject to ATO publication terms.</p>
        </div>
      </div>
    </footer>
  );
}
