import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { getUserIdFromHeaders } from "@/shared/utils/auth/auth-helpers";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { data: userData, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    if (roleError || !userData || userData.role !== "admin") {
      return NextResponse.json({ error: "Administrator privileges required." }, { status: 403 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const category_id = searchParams.get("category_id");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    // Build query
    let query = supabase
      .from("interactive_sequences")
      .select("*")
      .order("created_at", { ascending: false });

    if (category_id) {
      query = query.eq("category_id", category_id);
    }

    if (status && (status === "draft" || status === "published" || status === "archived")) {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.textSearch("search_vector", search);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch interactive sequences:", error);
      return NextResponse.json(
        { error: `Failed to fetch sequences: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, sequences: data });
  } catch (error) {
    console.error("Interactive sequences list error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Fetch failed: ${errorMessage}` }, { status: 500 });
  }
}
