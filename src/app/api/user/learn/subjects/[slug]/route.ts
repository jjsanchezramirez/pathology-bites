import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const supabase = await createClient();
    const userId = request.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { slug } = await params;

    // Get subject with its published lessons
    const { data: subject, error } = await supabase
      .from("learning_subjects")
      .select(
        `
        *,
        category:categories!learning_subjects_category_id_fkey(id, name, color, short_form),
        lessons(id, title, slug, description, estimated_minutes, sort_order, status)
      `
      )
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (error || !subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    // Filter to published lessons and sort
    const publishedLessons = (subject.lessons || [])
      .filter((l: { status: string }) => l.status === "published")
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order);

    // Get user progress for these lessons
    const lessonIds = publishedLessons.map((l: { id: string }) => l.id);
    const { data: progress } = await supabase
      .from("user_lesson_progress")
      .select("lesson_id, completed_at, quiz_score")
      .eq("user_id", userId)
      .in("lesson_id", lessonIds.length > 0 ? lessonIds : ["__none__"]);

    const progressMap = new Map((progress || []).map((p) => [p.lesson_id, p]));

    const lessons = publishedLessons.map(
      (l: {
        id: string;
        title: string;
        slug: string;
        description: string | null;
        estimated_minutes: number | null;
        sort_order: number;
      }) => ({
        id: l.id,
        title: l.title,
        slug: l.slug,
        description: l.description,
        estimated_minutes: l.estimated_minutes,
        sort_order: l.sort_order,
        is_completed: !!progressMap.get(l.id)?.completed_at,
        quiz_score: progressMap.get(l.id)?.quiz_score ?? null,
      })
    );

    return NextResponse.json({
      ...subject,
      lessons,
    });
  } catch (error) {
    console.error("[Learn API] Failed to fetch subject:", error);
    return NextResponse.json({ error: "Failed to fetch subject" }, { status: 500 });
  }
}
