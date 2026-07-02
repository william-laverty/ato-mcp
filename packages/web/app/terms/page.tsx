import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 pb-24 pt-14">
      <div className="space-y-10">
        <div className="space-y-3">
          <Link href="/" className="text-sm text-zinc-500 transition-colors hover:text-zinc-900">
            ← Home
          </Link>
          <h1 className="text-3xl font-normal tracking-tight1 text-zinc-900">Terms of Service</h1>
          <p className="text-sm text-zinc-400">Last updated: 26 May 2026</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-medium tracking-tight1 text-zinc-900">1. Acceptance</h2>
          <p className="text-[15px] leading-relaxed text-zinc-700">
            By using ato-mcp.com.au (&quot;the Service&quot;), you agree to these Terms of
            Service. If you do not agree, do not use the Service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium tracking-tight1 text-zinc-900">2. Description</h2>
          <p className="text-[15px] leading-relaxed text-zinc-700">
            The Service provides AI-accessible retrieval of publicly available
            Australian Taxation Office information via the Model Context
            Protocol. It is an independent service and is not affiliated with,
            endorsed by, or operated by the Australian Taxation Office.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium tracking-tight1 text-zinc-900">3. Not Tax Advice</h2>
          <p className="text-[15px] leading-relaxed text-zinc-700">
            Information provided through the Service is for general informational
            purposes only and does not constitute tax advice, legal advice, or
            financial advice. Tax laws are complex and change frequently.
          </p>
          <p className="text-[15px] leading-relaxed text-zinc-700">
            You should always consult a registered tax agent or other qualified
            professional before making any decisions based on information
            retrieved through this Service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium tracking-tight1 text-zinc-900">4. Accounts</h2>
          <p className="text-[15px] leading-relaxed text-zinc-700">
            You are responsible for maintaining the security of your account and
            any API tokens issued to you. Notify us immediately if you suspect
            unauthorised access to your account.
          </p>
          <p className="text-[15px] leading-relaxed text-zinc-700">
            You must not share your API tokens with others or use the Service to
            make automated requests in a manner that degrades performance for
            other users.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium tracking-tight1 text-zinc-900">
            5. Acceptable Use
          </h2>
          <p className="text-[15px] leading-relaxed text-zinc-700">You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1 text-[15px] leading-relaxed text-zinc-700">
            <li>Use the Service for any unlawful purpose</li>
            <li>Attempt to circumvent any security measures</li>
            <li>Scrape or bulk-download the ATO corpus via the Service</li>
            <li>
              Resell access to the Service without prior written permission
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium tracking-tight1 text-zinc-900">
            6. Disclaimer of Warranties
          </h2>
          <p className="text-[15px] leading-relaxed text-zinc-700">
            The Service is provided &quot;as is&quot; without warranties of any kind.
            We make no guarantee that the ATO corpus is complete, accurate, or
            current. ATO publications may be updated at any time and our corpus
            may not reflect the latest changes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium tracking-tight1 text-zinc-900">
            7. Limitation of Liability
          </h2>
          <p className="text-[15px] leading-relaxed text-zinc-700">
            To the maximum extent permitted by law, we shall not be liable for
            any indirect, incidental, or consequential damages arising from your
            use of the Service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium tracking-tight1 text-zinc-900">
            8. Governing Law
          </h2>
          <p className="text-[15px] leading-relaxed text-zinc-700">
            These Terms are governed by the laws of New South Wales, Australia.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium tracking-tight1 text-zinc-900">9. Changes</h2>
          <p className="text-[15px] leading-relaxed text-zinc-700">
            We may update these Terms from time to time. Continued use of the
            Service after changes constitutes acceptance of the revised Terms.
          </p>
        </section>

        <div className="border-t border-zinc-100 pt-6 text-xs text-zinc-400">
          <Link href="/privacy" className="transition-colors hover:text-zinc-900">
            Privacy Policy
          </Link>
        </div>
      </div>
    </main>
  );
}
