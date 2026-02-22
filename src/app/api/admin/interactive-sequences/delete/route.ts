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
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Sequence ID is required." }, { status: 400 });
    }

    const { error } = await supabase.from("interactive_sequences").delete().eq("id", id);

    if (error) {
      console.error("Failed to delete interactive sequence:", error);
      return NextResponse.json(
        { error: `Failed to delete sequence: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Interactive sequence deletion error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Deletion failed: ${errorMessage}` }, { status: 500 });
  }
}
