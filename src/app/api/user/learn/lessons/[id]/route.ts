import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { log } from "@/shared/utils/logging";

/**
 * @swagger
 * /api/user/learn/lessons/{id}:
 *   get:
 *     summary: Get a published lesson by id
 *     description: Returns a single published lesson (within a published subject) along with the authenticated user's progress and the prev/next sibling lessons in the same subject. As a side effect, upserts the user's lesson progress to record last_accessed_at. Requires the x-user-id header injected by middleware.
 *     tags:
 *       - User - Learn
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the lesson.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lesson object with embedded subject, user progress, and prev_lesson/next_lesson navigation.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Missing x-user-id header.
 *       404:
 *         description: Lesson not found, not published, or its subject is not published.
 *       500:
 *         description: Failed to fetch lesson.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const userId = request.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Get lesson with its subject
    const { data: lesson, error } = await supabase
      .from("lessons")
      .select(
        `
        *,
        subject:learning_subjects!lessons_subject_id_fkey(id, title, slug, category_id, status)
      `
      )
      .eq("id", id)
      .eq("status", "published")
      .single();

    if (error || !lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Check subject is published
    if (lesson.subject?.status !== "published") {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Get user progress
    const { data: progress } = await supabase
      .from("user_lesson_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("lesson_id", id)
      .maybeSingle();

    // Update last_accessed_at
    if (progress) {
      await supabase
        .from("user_lesson_progress")
        .update({ last_accessed_at: new Date().toISOString() })
        .eq("id", progress.id);
    } else {
      await supabase.from("user_lesson_progress").insert({ user_id: userId, lesson_id: id });
    }

    // Get prev/next lessons in same subject
    const { data: siblingLessons } = await supabase
      .from("lessons")
      .select("id, slug, title, sort_order")
      .eq("subject_id", lesson.subject_id)
      .eq("status", "published")
      .order("sort_order");

    const siblings = siblingLessons || [];
    const currentIdx = siblings.findIndex((l) => l.id === id);
    const prevLesson =
      currentIdx > 0
        ? { slug: siblings[currentIdx - 1].slug, title: siblings[currentIdx - 1].title }
        : null;
    const nextLesson =
      currentIdx < siblings.length - 1
        ? { slug: siblings[currentIdx + 1].slug, title: siblings[currentIdx + 1].title }
        : null;

    return NextResponse.json({
      ...lesson,
      progress: progress || null,
      prev_lesson: prevLesson,
      next_lesson: nextLesson,
    });
  } catch (error) {
    log.error("[Learn API] Failed to fetch lesson:", error);
    return NextResponse.json({ error: "Failed to fetch lesson" }, { status: 500 });
  }
}
