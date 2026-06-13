import { redirect } from "next/navigation";
import Link from "next/link";
import { makeServerClient } from "@/lib/supabase/server";
import { makeServiceClient } from "@/lib/supabase/service";
import type { UserFacts } from "@ato-mcp/shared";

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
    .select("created_at")
    .eq("id", userId)
    .maybeSingle();
  void userData;

  // Fetch user_facts row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: factsData } = await (service.from("user_facts") as any)
    .select("facts")
    .eq("user_id", userId)
    .maybeSingle();

  const facts = (factsData as { facts?: UserFacts } | null)?.facts ?? null;

  return (
    <main className="min-h-screen bg-white px-4 py-14">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-normal tracking-tight1 text-zinc-900">Account</h1>
          <Link href="/" className="text-sm text-zinc-500 transition-colors hover:text-zinc-900">
            ← Home
          </Link>
        </div>

        {/* Account details */}
        <section className="card p-6 space-y-4">
          <h2 className="font-medium text-zinc-900">Account details</h2>
          <div className="text-sm">
            <div>
              <span className="text-xs text-zinc-400">Email</span>
              <p className="text-sm font-medium text-zinc-900">{email}</p>
            </div>
          </div>
        </section>

        {/* Tax profile */}
        <section className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-zinc-900">Tax profile</h2>
            <Link
              href="/account/facts/edit"
              className="text-sm text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-900"
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
              <p className="text-sm text-zinc-500">No tax profile saved yet.</p>
              <Link
                href="/onboard/facts"
                className="btn btn-primary px-4 py-2 text-sm"
              >
                Complete your tax profile
              </Link>
            </div>
          )}
        </section>

        {/* Danger zone */}
        <section className="card border-[#dc2626]/25 p-6 space-y-4">
          <h2 className="font-medium text-[#dc2626]">Danger zone</h2>
          <p className="text-sm text-zinc-500">
            Deleting your account will permanently remove all your data including
            your tax profile and any issued tokens.
          </p>
          <Link
            href="/account/delete"
            className="btn rounded-full border border-[#dc2626]/40 px-4 py-2 text-sm text-[#dc2626] hover:border-[#dc2626]"
          >
            Delete account
          </Link>
        </section>

        <div className="flex gap-4 text-xs text-zinc-400">
          <Link href="/privacy" className="transition-colors hover:text-zinc-900">Privacy policy</Link>
          <Link href="/terms" className="transition-colors hover:text-zinc-900">Terms of service</Link>
        </div>
      </div>
    </main>
  );
}

function FactItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-zinc-400">{label}</span>
      <p className="text-sm font-medium text-zinc-900 capitalize">{value}</p>
    </div>
  );
}
