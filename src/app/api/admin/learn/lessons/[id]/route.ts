import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { getUserIdFromHeaders } from "@/shared/utils/auth/auth-helpers";

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();
  return !error && data?.role === "admin";
}

export async function GET(
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

    const { data, error } = await supabase
      .from("lessons")
      .select(`
        *,
        subject:learning_subjects!lessons_subject_id_fkey(id, title, slug)
      `)
      .eq("id", id)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("[Admin Learn API] Failed to fetch lesson:", error);
    return NextResponse.json({ error: "Failed to fetch lesson" }, { status: 500 });
  }
}

export async function PUT(
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
    const body = await request.json();
    const { title, slug, description, content, content_markdown, quiz, anki_deck_ref, cover_image_url, sort_order, estimated_minutes, status, subject_id } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title.trim();
    if (slug !== undefined) updateData.slug = slug.trim().toLowerCase();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (content !== undefined) updateData.content = content;
    if (content_markdown !== undefined) updateData.content_markdown = content_markdown || null;
    if (quiz !== undefined) updateData.quiz = quiz;
    if (anki_deck_ref !== undefined) updateData.anki_deck_ref = anki_deck_ref || null;
    if (cover_image_url !== undefined) updateData.cover_image_url = cover_image_url || null;
    if (sort_order !== undefined) updateData.sort_order = sort_order;
    if (estimated_minutes !== undefined) updateData.estimated_minutes = estimated_minutes || null;
    if (status !== undefined) updateData.status = status;
    if (subject_id !== undefined) updateData.subject_id = subject_id;

    const { data, error } = await supabase
      .from("lessons")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "A lesson with this slug already exists in this subject" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[Admin Learn API] Failed to update lesson:", error);
    return NextResponse.json({ error: "Failed to update lesson" }, { status: 500 });
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

    const { error } = await supabase
      .from("lessons")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin Learn API] Failed to delete lesson:", error);
    return NextResponse.json({ error: "Failed to delete lesson" }, { status: 500 });
  }
}
