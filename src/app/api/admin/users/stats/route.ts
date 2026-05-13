// src/app/api/admin/users/stats/route.ts
// Proxies get_user_statistics RPC through a service-role client. The RPC is
// SECURITY DEFINER with no `authenticated` EXECUTE grant, and its body
// previously rejected service-role callers via `auth.uid() IS NULL` — that
// internal auth check was dropped in a migration since this route gates access
// to admin/creator/reviewer roles before calling the RPC.

import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin", "creator", "reviewer"]);

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id");
  const userRole = request.headers.get("x-user-role");

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!userRole || !ALLOWED_ROLES.has(userRole)) {
    return NextResponse.json({ error: "Forbidden - Insufficient permissions" }, { status: 403 });
  }

  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await adminSupabase.rpc("get_user_statistics");
  if (error) {
    console.error("[admin/users/stats] RPC error:", error);
    return NextResponse.json({ error: "Failed to fetch user statistics" }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "No user statistics found" }, { status: 404 });
  }

  return NextResponse.json({ data: data[0] });
}
