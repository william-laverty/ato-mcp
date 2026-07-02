import Link from "next/link";
import { UserFactsSchema } from "@ato-mcp/shared";
import { z } from "zod";

// UserFactsSchema uses .superRefine() which wraps it in ZodEffects.
// We must reach through to the inner object schema to get .shape.
const innerSchema = UserFactsSchema.innerType() as z.ZodObject<z.ZodRawShape>;
const schemaKeys = Object.keys(innerSchema.shape);

const fieldDescriptions: Record<string, string> = {
  given_name: "Your first name",
  state: "Your state or territory of residence",
  residency_status: "Your Australian tax residency status",
  has_abn: "Whether you hold an Australian Business Number",
  abn: "Your ABN (if applicable)",
  business_structure: "Your business entity type",
  business_name: "Your registered business name (if applicable)",
  industry_code: "Your ANZSIC industry classification code",
  occupation: "Your occupation",
  gst_registered: "Whether you are registered for GST",
  gst_period: "Your GST reporting period",
  payg_instalments: "Whether you pay PAYG instalments",
  fbt_payer: "Whether you are registered for Fringe Benefits Tax",
  has_spouse: "Whether you have a spouse or de facto partner",
  dependants: "Number of dependants",
  hecs_help_debt: "Whether you have a HECS/HELP debt",
  private_health_insurance: "Whether you hold private health insurance",
  has_investment_property: "Whether you own investment property",
  has_shares_or_managed_funds: "Whether you hold shares or managed funds",
  has_crypto: "Whether you hold cryptocurrency",
  super_fund_type: "Your superannuation fund type",
  current_fy: "The current financial year",
  prior_fy_lodged: "Whether you have lodged your prior year tax return",
  accepted_disclaimer_at: "Timestamp when you accepted the disclaimer",
  facts_updated_at: "Timestamp when your facts were last updated",
  schema_version: "Internal data schema version",
};

const eventTypes = [
  "Magic-link email sign-in",
  "Tax facts created or updated",
  "Account deleted",
  "API token issued",
  "MCP connection detected",
];

const notStored = [
  "Your actual tax returns or ATO correspondence",
  "Your Tax File Number (TFN)",
  "Banking or financial account details",
  "Income amounts or asset valuations",
  "Information from third-party services",
];

const linkCls =
  "text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-900";

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 pb-24 pt-14">
      <div className="space-y-10">
        <div className="space-y-3">
          <Link href="/" className="text-sm text-zinc-500 transition-colors hover:text-zinc-900">
            ← Home
          </Link>
          <h1 className="text-3xl font-normal tracking-tight1 text-zinc-900">Privacy Policy</h1>
          <p className="text-sm text-zinc-400">Last updated: 26 May 2026</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-medium tracking-tight1 text-zinc-900">1. Overview</h2>
          <p className="text-[15px] leading-relaxed text-zinc-700">
            ato-mcp.com.au (&quot;we&quot;, &quot;our&quot;, &quot;the service&quot;) is an independent tool that
            provides access to publicly available Australian Taxation Office
            information via the Model Context Protocol. We collect minimal
            personal information to deliver a personalised experience.
          </p>
          <p className="text-[15px] leading-relaxed text-zinc-700">
            We are not affiliated with the Australian Taxation Office. This
            service operates under Australian privacy law principles.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium tracking-tight1 text-zinc-900">
            2. Information we collect
          </h2>
          <p className="text-[15px] leading-relaxed text-zinc-700">
            When you create an account, we collect your email address and the
            following tax profile fields. All fields are{" "}
            <span className="font-medium">optional</span> — you can use the
            service without completing your profile.
          </p>

          <div className="card overflow-hidden p-0">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="eyebrow px-4 py-2.5 text-left">
                    Field
                  </th>
                  <th className="eyebrow px-4 py-2.5 text-left">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {schemaKeys.map((key: string, idx: number) => (
                  <tr
                    key={key}
                    data-field={key}
                    className={idx % 2 === 1 ? "bg-zinc-50/70" : "bg-white"}
                  >
                    <td className="px-4 py-2 font-mono text-xs text-zinc-900">
                      {key}
                    </td>
                    <td className="px-4 py-2 text-[13px] text-zinc-500">
                      {(fieldDescriptions as Record<string, string>)[key] ?? key}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium tracking-tight1 text-zinc-900">
            3. What we do not store
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-zinc-700">
            {notStored.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium tracking-tight1 text-zinc-900">
            4. Event types logged
          </h2>
          <p className="text-[15px] leading-relaxed text-zinc-700">
            We log the following events for security and debugging purposes.
            Logs are retained for 90 days.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-zinc-700">
            {eventTypes.map((event) => (
              <li key={event}>{event}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium tracking-tight1 text-zinc-900">
            5. Data retention &amp; deletion
          </h2>
          <p className="text-[15px] leading-relaxed text-zinc-700">
            You can delete your account at any time from your{" "}
            <Link href="/account" className={linkCls}>
              account page
            </Link>
            . Deletion is permanent and cascades to all associated records
            including your tax profile and API tokens.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium tracking-tight1 text-zinc-900">6. Contact</h2>
          <p className="text-[15px] leading-relaxed text-zinc-700">
            For privacy enquiries, contact us at{" "}
            <a href="mailto:privacy@ato-mcp.com.au" className={linkCls}>
              privacy@ato-mcp.com.au
            </a>
            .
          </p>
        </section>

        <div className="border-t border-zinc-100 pt-6 text-xs text-zinc-400">
          <Link href="/terms" className="transition-colors hover:text-zinc-900">
            Terms of Service
          </Link>
        </div>
      </div>
    </main>
  );
}
