import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Build query
    let query = supabase
      .from("images")
      .select("id, url, description, alt_text, category, file_type, width, height, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    // Apply filters
    if (search) {
      query = query.or(`description.ilike.%${search}%,alt_text.ilike.%${search}%`);
    }

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching images:", error);
      return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
    }

    return NextResponse.json({ images: data || [] });
  } catch (error) {
    console.error("Error in GET /api/admin/library/images:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
