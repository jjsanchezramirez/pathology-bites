import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["admin", "creator", "reviewer"].includes(userRole || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase.from("questions").select(
      `
        *,
        question_options(*),
        question_images(*),
        question_tags(tag_id),
        question_set:question_sets(id, name, short_form),
        category:categories(id, name, short_form, color)
      `
    );

    if (error) {
      console.error("Error exporting questions:", error);
      return NextResponse.json({ error: "Failed to export questions" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      exported_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Unexpected export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
