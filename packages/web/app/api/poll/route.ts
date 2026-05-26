import { NextRequest, NextResponse } from "next/server";
import { makeServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  // In MOCK mode, always return not detected
  if (
    process.env.MOCK_SUPABASE === "1" ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  ) {
    return NextResponse.json({ detected: false });
  }

  const service = makeServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (service.from("mcp_connections") as any)
    .select("detected_at")
    .eq("user_id", userId)
    .order("detected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    detected: data != null,
  });
}
