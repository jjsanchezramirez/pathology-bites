// src/app/api/admin/audio/stats/route.ts
// Proxies get_audio_aggregate_stats RPC through a service-role client.
// The RPC is SECURITY DEFINER with no `authenticated` EXECUTE grant, so it
// cannot be called from the browser admin page directly. This route gates on
// admin role and forwards the call.

import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  const userRole = request.headers.get("x-user-role");

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (userRole !== "admin") {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await adminSupabase.rpc("get_audio_aggregate_stats").single();
  if (error) {
    console.error("[admin/audio/stats] RPC error:", error);
    return NextResponse.json({ error: "Failed to fetch audio stats" }, { status: 500 });
  }

  const result = data as { total_count: number; total_size_bytes: number } | null;
  return NextResponse.json({
    total: Number(result?.total_count) || 0,
    totalSizeBytes: Number(result?.total_size_bytes) || 0,
  });
}
