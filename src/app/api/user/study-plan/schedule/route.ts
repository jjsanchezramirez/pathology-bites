import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { requireUser } from "@/shared/utils/api/api-guard";
import { TABLE_NAMES } from "@/shared/types/database";

/**
 * @swagger
 * /api/user/study-plan/schedule:
 *   get:
 *     summary: Get board-prep schedule
 *     description: Returns the authenticated user's full board-prep schedule (per-day study tasks), ordered by date then idx. Requires authentication via the middleware-injected x-user-id header.
 *     tags:
 *       - User - Study Plan
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Array of scheduled tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   task_id:
 *                     type: string
 *                   date:
 *                     type: string
 *                   idx:
 *                     type: integer
 *                   resource_id:
 *                     type: string
 *                   resource_name:
 *                     type: string
 *                   resource_type:
 *                     type: string
 *                   subject_id:
 *                     type: string
 *                   subject:
 *                     type: string
 *                   activity:
 *                     type: string
 *                   minutes:
 *                     type: number
 *                   task_type:
 *                     type: string
 *                   is_review:
 *                     type: boolean
 *                   content_units:
 *                     type: number
 *                   content_label:
 *                     type: string
 *       401:
 *         description: Missing x-user-id (unauthorized)
 *       500:
 *         description: Failed to fetch schedule
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const { data, error } = await supabase
      .from(TABLE_NAMES.BOARD_PREP_SCHEDULE)
      .select("*")
      .eq("user_id", userId)
      .order("date")
      .order("idx");

    if (error) throw error;

    const tasks = (data || []).map((r: Record<string, unknown>) => ({
      task_id: r.task_id,
      date: r.date,
      idx: r.idx,
      resource_id: r.resource_id ?? "",
      resource_name: r.resource_name,
      resource_type: r.resource_type ?? "",
      subject_id: r.subject_id ?? "",
      subject: r.subject,
      activity: r.activity,
      minutes: r.minutes,
      task_type: r.task_type,
      is_review: r.is_review,
      content_units: Number(r.content_units),
      content_label: r.content_label,
    }));

    return NextResponse.json(tasks);
  } catch {
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/user/study-plan/schedule:
 *   put:
 *     summary: Replace board-prep schedule
 *     description: Replaces the authenticated user's entire schedule (deletes all existing rows, then inserts the provided tasks in batches of 500). Requires authentication via the middleware-injected x-user-id header. Omitted per-task fields fall back to defaults.
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
 *             properties:
 *               tasks:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     task_id:
 *                       type: string
 *                     date:
 *                       type: string
 *                     idx:
 *                       type: integer
 *                     resource_id:
 *                       type: string
 *                     resource_name:
 *                       type: string
 *                     resource_type:
 *                       type: string
 *                     subject_id:
 *                       type: string
 *                     subject:
 *                       type: string
 *                     activity:
 *                       type: string
 *                     minutes:
 *                       type: number
 *                     task_type:
 *                       type: string
 *                     is_review:
 *                       type: boolean
 *                     content_units:
 *                       type: number
 *                     content_label:
 *                       type: string
 *     responses:
 *       200:
 *         description: Schedule saved
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
 *         description: Failed to save schedule
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const { tasks } = await request.json();

    // Delete all existing schedule for this user, then insert new
    await supabase.from(TABLE_NAMES.BOARD_PREP_SCHEDULE).delete().eq("user_id", userId);

    if (tasks && tasks.length > 0) {
      // Insert in batches of 500 to avoid payload limits
      const batchSize = 500;
      for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize);
        const rows = batch.map((t: Record<string, unknown>) => ({
          user_id: userId,
          task_id: t.task_id,
          date: t.date,
          idx: t.idx || 0,
          resource_id: t.resource_id || "",
          resource_name: t.resource_name,
          resource_type: t.resource_type || "",
          subject_id: t.subject_id || "",
          subject: t.subject || "",
          activity: t.activity || "",
          minutes: t.minutes || 0,
          task_type: t.task_type || "task",
          is_review: t.is_review || false,
          content_units: t.content_units || 0,
          content_label: t.content_label || "",
        }));

        const { error } = await supabase.from(TABLE_NAMES.BOARD_PREP_SCHEDULE).insert(rows);

        if (error) throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save schedule" }, { status: 500 });
  }
}
