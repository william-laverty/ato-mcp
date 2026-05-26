import { redirect } from "next/navigation";
import { makeServerClient } from "@/lib/supabase/server";
import { makeServiceClient } from "@/lib/supabase/service";

export default async function VerifyPage() {
  const client = await makeServerClient();
  const { data: sessionData } = await client.auth.getSession();
  const session = sessionData?.session;

  if (!session?.user) {
    // No session — possibly direct navigation; redirect back to start
    redirect("/onboard");
  }

  const user = session.user;
  const service = makeServiceClient();

  // Upsert user row
  await service.from("users").upsert({
    id: user.id,
    email: user.email ?? "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  redirect("/onboard/facts");
}
