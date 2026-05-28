import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("interactive_sequences")
      .select("id, title, description, sequence_data, status")
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch interactive sequence:", error);
      return NextResponse.json(
        { error: `Failed to fetch sequence: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }

    return NextResponse.json({ sequence: data });
  } catch (error) {
    console.error("Interactive sequence fetch error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Fetch failed: ${errorMessage}` }, { status: 500 });
  }
}
