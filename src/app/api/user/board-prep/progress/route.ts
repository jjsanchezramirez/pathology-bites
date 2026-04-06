import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { TABLE_NAMES } from "@/shared/types/database";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = request.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from(TABLE_NAMES.BOARD_PREP_PROGRESS)
      .select("task_key, completed_at")
      .eq("user_id", userId);

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = request.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { task_key, completed_at } = await request.json();

    const { error } = await supabase
      .from(TABLE_NAMES.BOARD_PREP_PROGRESS)
      .upsert({
        user_id: userId,
        task_key,
        completed_at: completed_at || new Date().toISOString(),
      }, { onConflict: "user_id,task_key" });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = request.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const taskKey = searchParams.get("task_key");

    if (!taskKey) {
      return NextResponse.json({ error: "task_key required" }, { status: 400 });
    }

    const { error } = await supabase
      .from(TABLE_NAMES.BOARD_PREP_PROGRESS)
      .delete()
      .eq("user_id", userId)
      .eq("task_key", taskKey);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete progress" }, { status: 500 });
  }
}
