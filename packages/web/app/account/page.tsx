import { redirect } from "next/navigation";
import Link from "next/link";
import { makeServerClient } from "@/lib/supabase/server";
import { makeServiceClient } from "@/lib/supabase/service";
import type { UserFacts } from "@ato-pro/shared";

export default async function AccountPage() {
  const client = await makeServerClient();
  const { data: sessionData } = await client.auth.getSession();
  const session = sessionData?.session;

  if (!session?.user) {
    redirect("/onboard");
  }

  const userId = session.user.id;
  const email = session.user.email ?? "Unknown";
  const service = makeServiceClient();

  // Fetch user row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (service.from("users") as any)
    .select("mode, created_at")
    .eq("id", userId)
    .maybeSingle();

  const mode = (userData as { mode?: string } | null)?.mode ?? "local";

  // Fetch user_facts row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: factsData } = await (service.from("user_facts") as any)
    .select("facts")
    .eq("user_id", userId)
    .maybeSingle();

  const facts = (factsData as { facts?: UserFacts } | null)?.facts ?? null;

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Account</h1>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Home
          </Link>
        </div>

        {/* Account details */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Account details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Email</span>
              <p className="font-medium text-gray-900">{email}</p>
            </div>
            <div>
              <span className="text-gray-500">Mode</span>
              <p className="font-medium text-gray-900 capitalize">{mode}</p>
            </div>
          </div>
        </section>

        {/* Tax profile */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Tax profile</h2>
            <Link
              href="/account/facts/edit"
              className="text-sm text-blue-600 hover:underline"
            >
              Edit facts
            </Link>
          </div>

          {facts ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <FactItem label="Name" value={facts.given_name} />
              <FactItem label="State" value={facts.state} />
              <FactItem label="Residency" value={facts.residency_status.replace(/_/g, " ")} />
              <FactItem label="ABN" value={facts.has_abn ? facts.abn ?? "Yes" : "No"} />
              <FactItem label="Business" value={facts.business_structure.replace(/_/g, " ")} />
              <FactItem label="GST registered" value={facts.gst_registered ? "Yes" : "No"} />
              <FactItem label="PAYG instalments" value={facts.payg_instalments ? "Yes" : "No"} />
              <FactItem label="HECS/HELP" value={facts.hecs_help_debt ? "Yes" : "No"} />
              <FactItem label="Investment property" value={facts.has_investment_property ? "Yes" : "No"} />
              <FactItem label="Shares/funds" value={facts.has_shares_or_managed_funds ? "Yes" : "No"} />
              <FactItem label="Crypto" value={facts.has_crypto ? "Yes" : "No"} />
              <FactItem label="Current FY" value={facts.current_fy} />
            </div>
          ) : (
            <div className="text-center py-6 space-y-3">
              <p className="text-gray-500 text-sm">No tax profile saved yet.</p>
              <Link
                href="/onboard/facts"
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
              >
                Complete your tax profile
              </Link>
            </div>
          )}
        </section>

        {/* Danger zone */}
        <section className="bg-white rounded-xl border border-red-200 p-6 space-y-4">
          <h2 className="font-semibold text-red-800">Danger zone</h2>
          <p className="text-sm text-gray-600">
            Deleting your account will permanently remove all your data including
            your tax profile and any issued tokens.
          </p>
          <Link
            href="/account/delete"
            className="inline-flex items-center justify-center rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors"
          >
            Delete account
          </Link>
        </section>

        <div className="flex gap-4 text-xs text-gray-400">
          <Link href="/privacy" className="hover:text-gray-600">Privacy policy</Link>
          <Link href="/terms" className="hover:text-gray-600">Terms of service</Link>
        </div>
      </div>
    </main>
  );
}

function FactItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-500">{label}</span>
      <p className="font-medium text-gray-900 capitalize">{value}</p>
    </div>
  );
}
