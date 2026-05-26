import { redirect } from "next/navigation";
import { makeServerClient } from "@/lib/supabase/server";
import DeleteAccountClient from "@/components/DeleteAccountClient";

export default async function DeleteAccountPage() {
  const client = await makeServerClient();
  const { data: sessionData } = await client.auth.getSession();
  const session = sessionData?.session;

  if (!session?.user) {
    redirect("/onboard");
  }

  return <DeleteAccountClient userId={session.user.id} />;
}
