import { redirect } from "next/navigation";
import { makeServerClient } from "@/lib/supabase/server";
import InstallSnippet from "@/components/InstallSnippet";
import { issueToken } from "@/app/onboard/_actions";

export default async function InstallPage() {
  const client = await makeServerClient();
  const { data: sessionData } = await client.auth.getSession();
  const session = sessionData?.session;

  if (!session?.user) {
    redirect("/onboard");
  }

  const userId = session.user.id;
  const { token } = await issueToken(userId);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-normal tracking-tight1 text-zinc-900">
            Connect your AI client
          </h1>
          <p className="text-[15px] text-zinc-500">
            Add this config to your AI client to start using ato-mcp.
          </p>
        </div>

        <InstallSnippet token={token} userId={userId} />

        <div className="text-center">
          <a
            href="/account"
            className="text-sm text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-900"
          >
            Go to your account dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
