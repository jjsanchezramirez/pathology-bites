import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/shared/services/server";
import { requireUser } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import { log } from "@/shared/utils/logging";

const lessonProgressSchema = z.object({
  lesson_id: z.string().min(1, "lesson_id is required"),
  completed: z.boolean().nullish(),
  quiz_score: z.number().nullish(),
});

/**
 * @swagger
 * /api/user/learn/progress:
 *   get:
 *     summary: List the user's lesson progress
 *     description: Returns all user_lesson_progress rows for the authenticated user. Requires the x-user-id header injected by middleware.
 *     tags:
 *       - User - Learn
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Array of lesson progress records for the user.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       401:
 *         description: Missing x-user-id header.
 *       500:
 *         description: Failed to fetch progress.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const { data, error } = await supabase
      .from("user_lesson_progress")
      .select("*")
      .eq("user_id", userId);

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    log.error("[Learn API] Failed to fetch progress:", error);
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/user/learn/progress:
 *   post:
 *     summary: Upsert the user's progress for a lesson
 *     description: Upserts a user_lesson_progress row (keyed on user_id + lesson_id) for the authenticated user. Always updates last_accessed_at; sets completed_at when completed is truthy and quiz_score when provided. Requires the x-user-id header injected by middleware.
 *     tags:
 *       - User - Learn
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - lesson_id
 *             properties:
 *               lesson_id:
 *                 type: string
 *                 description: ID of the lesson to record progress for.
 *               completed:
 *                 type: boolean
 *                 description: When truthy, marks the lesson completed (sets completed_at).
 *               quiz_score:
 *                 type: number
 *                 description: Optional quiz score to store for the lesson.
 *     responses:
 *       200:
 *         description: Progress saved.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: lesson_id is required.
 *       401:
 *         description: Missing x-user-id header.
 *       500:
 *         description: Failed to save progress.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const body = await parseBody(request, lessonProgressSchema);
    if (body instanceof NextResponse) return body;
    const { lesson_id, completed, quiz_score } = body;

    const updateData: Record<string, unknown> = {
      last_accessed_at: new Date().toISOString(),
    };

    if (completed) {
      updateData.completed_at = new Date().toISOString();
    }

    if (quiz_score !== undefined && quiz_score !== null) {
      updateData.quiz_score = quiz_score;
    }

    const { error } = await supabase.from("user_lesson_progress").upsert(
      {
        user_id: userId,
        lesson_id,
        ...updateData,
      },
      { onConflict: "user_id,lesson_id" }
    );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("[Learn API] Failed to save progress:", error);
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
  }
}
