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
    const { title, description, sequence_data, category_id, status } = body;

    // Validation
    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    if (!sequence_data || typeof sequence_data !== "object") {
      return NextResponse.json({ error: "Valid sequence_data is required." }, { status: 400 });
    }

    // Validate sequence_data has required fields
    if (
      !sequence_data.version ||
      !sequence_data.segments ||
      !Array.isArray(sequence_data.segments)
    ) {
      return NextResponse.json(
        { error: "sequence_data must be a valid ExplainerSequence object." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("interactive_sequences")
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        sequence_data,
        category_id: category_id || null,
        status: status || "draft",
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create interactive sequence:", error);
      return NextResponse.json(
        { error: `Failed to create sequence: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, sequence: data });
  } catch (error) {
    console.error("Interactive sequence creation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Creation failed: ${errorMessage}` }, { status: 500 });
  }
}
