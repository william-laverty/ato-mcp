import { redirect } from "next/navigation";
import Link from "next/link";
import { makeServerClient } from "@/lib/supabase/server";
import { makeServiceClient } from "@/lib/supabase/service";
import FactsWizard from "@/components/FactsWizard";
import type { UserFacts } from "@ato-mcp/shared";

export default async function EditFactsPage() {
  const client = await makeServerClient();
  const { data: sessionData } = await client.auth.getSession();
  const session = sessionData?.session;

  if (!session?.user) {
    redirect("/onboard");
  }

  const userId = session.user.id;
  const service = makeServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: factsData } = await (service.from("user_facts") as any)
    .select("facts")
    .eq("user_id", userId)
    .maybeSingle();

  const initialValues = (factsData as { facts?: UserFacts } | null)?.facts ?? undefined;

  return (
    <main className="min-h-screen bg-white px-4 py-14">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-normal tracking-tight1 text-zinc-900">Edit tax profile</h1>
          <Link href="/account" className="text-sm text-zinc-500 transition-colors hover:text-zinc-900">
            ← Back to account
          </Link>
        </div>
        <FactsWizard userId={userId} initialValues={initialValues} />
      </div>
    </main>
  );
}
