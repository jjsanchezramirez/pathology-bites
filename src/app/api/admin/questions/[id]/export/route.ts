import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["admin", "creator", "reviewer"].includes(userRole || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("questions")
      .select(
        `
        *,
        question_options(*),
        question_images(*),
        question_tags(tag_id),
        question_set:question_sets(id, name, short_form),
        category:categories(id, name, short_form, color)
      `
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Unexpected export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
