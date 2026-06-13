import { redirect } from "next/navigation";
import { makeServerClient } from "@/lib/supabase/server";
import ModeCard from "@/components/ModeCard";

export default async function ModePage() {
  const client = await makeServerClient();
  const { data: sessionData } = await client.auth.getSession();
  const session = sessionData?.session;

  if (!session?.user) {
    redirect("/onboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="max-w-3xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-normal tracking-tight1 text-zinc-900">Choose your setup</h1>
          <p className="text-[15px] text-zinc-500">
            How do you want to run the ato-mcp server?
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <ModeCard
            userId={session.user.id}
            mode="hosted"
            title="Hosted (Cloud)"
            description="We run the server for you. Connect your AI client with a secure API token. No installation required."
            features={[
              "No local setup needed",
              "Always up to date",
              "API token authentication",
              "Works on any device",
            ]}
            recommended
          />
          <ModeCard
            userId={session.user.id}
            mode="local"
            title="Local (Self-hosted)"
            description="Run ato-mcp on your own machine. Install once and it works offline."
            features={[
              "Full data privacy",
              "Works offline",
              "Open source",
              "npm install away",
            ]}
          />
        </div>
      </div>
    </main>
  );
}
