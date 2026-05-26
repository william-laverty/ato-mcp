import { redirect } from "next/navigation";
import { makeServerClient } from "@/lib/supabase/server";
import FactsWizard from "@/components/FactsWizard";

export default async function FactsPage() {
  const client = await makeServerClient();
  const { data: sessionData } = await client.auth.getSession();
  const session = sessionData?.session;

  if (!session?.user) {
    redirect("/onboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Tell us about your tax situation</h1>
          <p className="text-gray-600">
            This information helps the AI give you more relevant tax guidance. All data
            is stored securely and used only to personalise your responses.
          </p>
        </div>
        <FactsWizard userId={session.user.id} />
      </div>
    </main>
  );
}
