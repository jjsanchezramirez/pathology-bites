import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { requireUser } from "@/shared/utils/api/api-guard";
import { log } from "@/shared/utils/logging";

/**
 * @swagger
 * /api/user/learn/subjects:
 *   get:
 *     summary: List published learning subjects
 *     description: Returns published learning subjects (each having at least one lesson), enriched with the authenticated user's per-subject lesson and completion counts. Requires the x-user-id header injected by middleware.
 *     tags:
 *       - User - Learn
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category_id
 *         description: Optional filter to subjects belonging to a specific category.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of subjects with lesson_count and completed_count for the user.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       401:
 *         description: Missing x-user-id header.
 *       500:
 *         description: Failed to fetch subjects.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const categoryId = request.nextUrl.searchParams.get("category_id");

    let query = supabase
      .from("learning_subjects")
      .select(
        `
        *,
        category:categories!learning_subjects_category_id_fkey(id, name, color, short_form),
        lessons!inner(id)
      `
      )
      .eq("status", "published")
      .order("sort_order");

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    const { data: subjects, error } = await query;
    if (error) throw error;

    // Get user progress for all lessons
    const { data: progress } = await supabase
      .from("user_lesson_progress")
      .select("lesson_id, completed_at")
      .eq("user_id", userId);

    const completedLessonIds = new Set(
      (progress || []).filter((p) => p.completed_at).map((p) => p.lesson_id)
    );

    // Get lesson counts and completed counts per subject
    const result = (subjects || []).map((subject) => {
      const lessonIds = (subject.lessons || []).map((l: { id: string }) => l.id);
      const completedCount = lessonIds.filter((id: string) => completedLessonIds.has(id)).length;

      return {
        id: subject.id,
        title: subject.title,
        description: subject.description,
        slug: subject.slug,
        category_id: subject.category_id,
        cover_image_url: subject.cover_image_url,
        sort_order: subject.sort_order,
        status: subject.status,
        created_at: subject.created_at,
        updated_at: subject.updated_at,
        category: subject.category,
        lesson_count: lessonIds.length,
        completed_count: completedCount,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    log.error("[Learn API] Failed to fetch subjects:", error);
    return NextResponse.json({ error: "Failed to fetch subjects" }, { status: 500 });
  }
}
