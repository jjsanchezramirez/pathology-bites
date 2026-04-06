import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { TABLE_NAMES } from "@/shared/types/database";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = request.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from(TABLE_NAMES.BOARD_PREP_CONFIG)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      id: data.id,
      exam_dates: data.exam_dates,
      days_off: data.days_off,
      recurring_off: data.recurring_off,
      phases: data.phases,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = request.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const config = await request.json();

    const { error } = await supabase
      .from(TABLE_NAMES.BOARD_PREP_CONFIG)
      .upsert({
        user_id: userId,
        exam_dates: config.exam_dates || [],
        days_off: config.days_off || {},
        recurring_off: config.recurring_off || [],
        phases: config.phases || [],
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
}
