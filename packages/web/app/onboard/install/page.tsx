import { redirect } from "next/navigation";
import { makeServerClient } from "@/lib/supabase/server";
import { makeServiceClient } from "@/lib/supabase/service";
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
  const service = makeServiceClient();

  // Read user mode via cast to avoid supabase generic-type issues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (service.from("users") as any)
    .select("mode")
    .eq("id", userId)
    .maybeSingle();

  const mode = (userData as { mode?: string } | null)?.mode ?? "local";

  // Issue a fresh bearer token only for hosted mode
  let token: string | null = null;
  if (mode === "hosted") {
    const result = await issueToken(userId);
    token = result.token;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-normal tracking-tight1 text-zinc-900">
            {mode === "hosted" ? "Connect your AI client" : "Install ato-mcp"}
          </h1>
          <p className="text-[15px] text-zinc-500">
            {mode === "hosted"
              ? "Add this config to your AI client to start using ato-mcp."
              : "Run this command to install ato-mcp locally, then add the config below."}
          </p>
        </div>

        <InstallSnippet mode={mode as "hosted" | "local"} token={token} userId={userId} />

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
