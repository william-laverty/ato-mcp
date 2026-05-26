import { NextRequest, NextResponse } from "next/server";
import { makeServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }

  // In MOCK mode, return a stub config bundle
  if (
    process.env.MOCK_SUPABASE === "1" ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  ) {
    return NextResponse.json({
      ready: false,
      config: null,
    });
  }

  const service = makeServiceClient();

  // Look up the onboard session by code
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (service.from("onboard_sessions") as any)
    .select("user_id, completed_at, config_bundle")
    .eq("code", code)
    .maybeSingle();

  if (!data || !(data as { completed_at?: string }).completed_at) {
    return NextResponse.json({ ready: false, config: null });
  }

  return NextResponse.json({
    ready: true,
    config: (data as { config_bundle?: unknown }).config_bundle ?? null,
  });
}
