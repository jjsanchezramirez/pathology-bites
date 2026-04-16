import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = request.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("user_lesson_progress")
      .select("*")
      .eq("user_id", userId);

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("[Learn API] Failed to fetch progress:", error);
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = request.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { lesson_id, completed, quiz_score } = await request.json();

    if (!lesson_id) {
      return NextResponse.json({ error: "lesson_id is required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      last_accessed_at: new Date().toISOString(),
    };

    if (completed) {
      updateData.completed_at = new Date().toISOString();
    }

    if (quiz_score !== undefined && quiz_score !== null) {
      updateData.quiz_score = quiz_score;
    }

    const { error } = await supabase.from("user_lesson_progress").upsert(
      {
        user_id: userId,
        lesson_id,
        ...updateData,
      },
      { onConflict: "user_id,lesson_id" }
    );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Learn API] Failed to save progress:", error);
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
  }
}
