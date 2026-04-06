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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = getUserIdFromHeaders(request);
    if (!userId || !(await verifyAdmin(supabase, userId))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const subjectId = request.nextUrl.searchParams.get("subject_id");

    let query = supabase
      .from("lessons")
      .select(`
        *,
        subject:learning_subjects!lessons_subject_id_fkey(id, title, slug)
      `)
      .order("sort_order");

    if (subjectId) {
      query = query.eq("subject_id", subjectId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("[Admin Learn API] Failed to fetch lessons:", error);
    return NextResponse.json({ error: "Failed to fetch lessons" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = getUserIdFromHeaders(request);
    if (!userId || !(await verifyAdmin(supabase, userId))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { subject_id, title, slug, description, content, content_markdown, quiz, anki_deck_ref, cover_image_url, sort_order, estimated_minutes, status } = body;

    if (!subject_id) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    }
    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!slug?.trim()) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("lessons")
      .insert({
        subject_id,
        title: title.trim(),
        slug: slug.trim().toLowerCase(),
        description: description?.trim() || null,
        content: content || { version: 1, sections: [] },
        content_markdown: content_markdown || null,
        quiz: quiz || null,
        anki_deck_ref: anki_deck_ref || null,
        cover_image_url: cover_image_url || null,
        sort_order: sort_order ?? 0,
        estimated_minutes: estimated_minutes || null,
        status: status || "draft",
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "A lesson with this slug already exists in this subject" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("[Admin Learn API] Failed to create lesson:", error);
    return NextResponse.json({ error: "Failed to create lesson" }, { status: 500 });
  }
}
