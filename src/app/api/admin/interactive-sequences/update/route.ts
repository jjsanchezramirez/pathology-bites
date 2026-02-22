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
    const { id, title, description, sequence_data, category_id, status } = body;

    if (!id) {
      return NextResponse.json({ error: "Sequence ID is required." }, { status: 400 });
    }

    // Build updates object with only provided fields
    const updates: Record<string, unknown> = {};

    if (title !== undefined) {
      if (!title.trim()) {
        return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
      }
      updates.title = title.trim();
    }

    if (description !== undefined) {
      updates.description = description?.trim() || null;
    }

    if (sequence_data !== undefined) {
      if (typeof sequence_data !== "object" || !sequence_data.version || !sequence_data.segments) {
        return NextResponse.json(
          { error: "sequence_data must be a valid ExplainerSequence object." },
          { status: 400 }
        );
      }
      updates.sequence_data = sequence_data;
    }

    if (category_id !== undefined) {
      updates.category_id = category_id || null;
    }

    if (status !== undefined) {
      if (!["draft", "published", "archived"].includes(status)) {
        return NextResponse.json({ error: "Invalid status value." }, { status: 400 });
      }
      updates.status = status;
    }

    const { data, error } = await supabase
      .from("interactive_sequences")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update interactive sequence:", error);
      return NextResponse.json(
        { error: `Failed to update sequence: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, sequence: data });
  } catch (error) {
    console.error("Interactive sequence update error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Update failed: ${errorMessage}` }, { status: 500 });
  }
}
