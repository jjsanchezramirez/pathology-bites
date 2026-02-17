import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { getUserIdFromHeaders } from "@/shared/utils/auth/auth-helpers";

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { id, duration } = body;

    if (!id || typeof duration !== "number" || duration <= 0) {
      return NextResponse.json({ error: "Invalid audio ID or duration." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("audio")
      .update({ duration_seconds: duration })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update audio duration:", error);
      return NextResponse.json(
        { error: `Failed to update duration: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, audio: data });
  } catch (error) {
    console.error("Audio duration update error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Update failed: ${errorMessage}` }, { status: 500 });
  }
}
