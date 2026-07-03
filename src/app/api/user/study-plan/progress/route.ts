import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/shared/services/server";
import { requireUser } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import { TABLE_NAMES } from "@/shared/types/database";

const taskProgressSchema = z.object({
  task_key: z.string().min(1, "task_key is required"),
  completed_at: z.string().nullish(),
});

/**
 * @swagger
 * /api/user/study-plan/progress:
 *   get:
 *     summary: List board-prep task progress
 *     description: Returns the authenticated user's completed board-prep tasks (task_key + completed_at). Requires authentication via the middleware-injected x-user-id header.
 *     tags:
 *       - User - Study Plan
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Array of progress entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   task_key:
 *                     type: string
 *                   completed_at:
 *                     type: string
 *       401:
 *         description: Missing x-user-id (unauthorized)
 *       500:
 *         description: Failed to fetch progress
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const { data, error } = await supabase
      .from(TABLE_NAMES.BOARD_PREP_PROGRESS)
      .select("task_key, completed_at")
      .eq("user_id", userId);

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/user/study-plan/progress:
 *   post:
 *     summary: Mark a board-prep task complete
 *     description: Upserts a single task-completion entry for the authenticated user (keyed on user_id + task_key). completed_at defaults to now when omitted. Requires authentication via the middleware-injected x-user-id header.
 *     tags:
 *       - User - Study Plan
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - task_key
 *             properties:
 *               task_key:
 *                 type: string
 *               completed_at:
 *                 type: string
 *                 description: ISO timestamp; defaults to current time if omitted
 *     responses:
 *       200:
 *         description: Progress saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       401:
 *         description: Missing x-user-id (unauthorized)
 *       500:
 *         description: Failed to save progress
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const body = await parseBody(request, taskProgressSchema);
    if (body instanceof NextResponse) return body;
    const { task_key, completed_at } = body;

    const { error } = await supabase.from(TABLE_NAMES.BOARD_PREP_PROGRESS).upsert(
      {
        user_id: userId,
        task_key,
        completed_at: completed_at || new Date().toISOString(),
      },
      { onConflict: "user_id,task_key" }
    );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/user/study-plan/progress:
 *   delete:
 *     summary: Clear board-prep task progress
 *     description: Deletes progress for the authenticated user. Provide task_key to clear a single task, or all=1 to clear every task. One of the two is required. Requires authentication via the middleware-injected x-user-id header.
 *     tags:
 *       - User - Study Plan
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: task_key
 *         schema:
 *           type: string
 *         description: Task to remove (omit when using all=1)
 *       - in: query
 *         name: all
 *         schema:
 *           type: string
 *           enum: ["1"]
 *         description: Set to 1 to clear all progress for the user
 *     responses:
 *       200:
 *         description: Progress deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Neither task_key nor all provided
 *       401:
 *         description: Missing x-user-id (unauthorized)
 *       500:
 *         description: Failed to delete progress
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const taskKey = searchParams.get("task_key");
    const all = searchParams.get("all") === "1";

    if (!taskKey && !all) {
      return NextResponse.json({ error: "task_key required" }, { status: 400 });
    }

    let query = supabase.from(TABLE_NAMES.BOARD_PREP_PROGRESS).delete().eq("user_id", userId);
    if (!all) query = query.eq("task_key", taskKey!);

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete progress" }, { status: 500 });
  }
}
