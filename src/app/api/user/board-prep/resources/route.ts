import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { TABLE_NAMES } from "@/shared/types/database";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = request.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from(TABLE_NAMES.BOARD_PREP_RESOURCES)
      .select("*")
      .eq("user_id", userId)
      .order("created_at");

    if (error) throw error;

    // Map DB rows to StudyResource shape
    const resources = (data || []).map((r: Record<string, unknown>) => ({
      id: r.resource_id,
      name: r.name,
      short_name: r.short_name,
      activity_verb: r.activity_verb,
      type: r.type,
      color: r.color,
      subjects: r.subjects,
      pace: Number(r.pace),
      active: r.active,
      priority: r.priority,
      phases: r.phases,
      phase_assignments: r.phase_assignments,
    }));

    return NextResponse.json(resources);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch resources" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = request.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { resources } = await request.json();

    // Delete existing resources for user, then insert new ones
    await supabase
      .from(TABLE_NAMES.BOARD_PREP_RESOURCES)
      .delete()
      .eq("user_id", userId);

    if (resources && resources.length > 0) {
      const rows = resources.map((r: Record<string, unknown>) => ({
        user_id: userId,
        resource_id: r.id,
        name: r.name,
        short_name: r.short_name || "",
        activity_verb: r.activity_verb || "",
        type: r.type,
        color: r.color || "#DBEAFE",
        subjects: r.subjects || [],
        pace: r.pace || 10,
        active: r.active !== false,
        priority: r.priority || null,
        phases: r.phases || null,
        phase_assignments: r.phase_assignments || null,
      }));

      const { error } = await supabase
        .from(TABLE_NAMES.BOARD_PREP_RESOURCES)
        .insert(rows);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save resources" }, { status: 500 });
  }
}
