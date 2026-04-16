import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { TABLE_NAMES } from "@/shared/types/database";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = request.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from(TABLE_NAMES.BOARD_PREP_SCHEDULE)
      .select("*")
      .eq("user_id", userId)
      .order("date")
      .order("idx");

    if (error) throw error;

    const tasks = (data || []).map((r: Record<string, unknown>) => ({
      task_id: r.task_id,
      date: r.date,
      idx: r.idx,
      resource_name: r.resource_name,
      subject: r.subject,
      activity: r.activity,
      minutes: r.minutes,
      task_type: r.task_type,
      is_review: r.is_review,
      content_units: Number(r.content_units),
      content_label: r.content_label,
    }));

    return NextResponse.json(tasks);
  } catch {
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = request.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { tasks } = await request.json();

    // Delete all existing schedule for this user, then insert new
    await supabase.from(TABLE_NAMES.BOARD_PREP_SCHEDULE).delete().eq("user_id", userId);

    if (tasks && tasks.length > 0) {
      // Insert in batches of 500 to avoid payload limits
      const batchSize = 500;
      for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize);
        const rows = batch.map((t: Record<string, unknown>) => ({
          user_id: userId,
          task_id: t.task_id,
          date: t.date,
          idx: t.idx || 0,
          resource_name: t.resource_name,
          subject: t.subject || "",
          activity: t.activity || "",
          minutes: t.minutes || 0,
          task_type: t.task_type || "task",
          is_review: t.is_review || false,
          content_units: t.content_units || 0,
          content_label: t.content_label || "",
        }));

        const { error } = await supabase.from(TABLE_NAMES.BOARD_PREP_SCHEDULE).insert(rows);

        if (error) throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save schedule" }, { status: 500 });
  }
}
