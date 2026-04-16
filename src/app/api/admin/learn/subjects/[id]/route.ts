import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { getUserIdFromHeaders } from "@/shared/utils/auth/auth-helpers";

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase.from("users").select("role").eq("id", userId).single();
  return !error && data?.role === "admin";
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const userId = getUserIdFromHeaders(request);
    if (!userId || !(await verifyAdmin(supabase, userId))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, description, slug, category_id, cover_image_url, sort_order, status } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (slug !== undefined) updateData.slug = slug.trim().toLowerCase();
    if (category_id !== undefined) updateData.category_id = category_id;
    if (cover_image_url !== undefined) updateData.cover_image_url = cover_image_url || null;
    if (sort_order !== undefined) updateData.sort_order = sort_order;
    if (status !== undefined) updateData.status = status;

    const { data, error } = await supabase
      .from("learning_subjects")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A subject with this slug already exists" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[Admin Learn API] Failed to update subject:", error);
    return NextResponse.json({ error: "Failed to update subject" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const userId = getUserIdFromHeaders(request);
    if (!userId || !(await verifyAdmin(supabase, userId))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    const { error } = await supabase.from("learning_subjects").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin Learn API] Failed to delete subject:", error);
    return NextResponse.json({ error: "Failed to delete subject" }, { status: 500 });
  }
}
