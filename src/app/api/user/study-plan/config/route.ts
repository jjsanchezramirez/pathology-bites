import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { requireUser } from "@/shared/utils/api/api-guard";
import { TABLE_NAMES } from "@/shared/types/database";

/**
 * @swagger
 * /api/user/study-plan/config:
 *   get:
 *     summary: Get board-prep study-plan config
 *     description: Returns the authenticated user's board-prep configuration (exam dates, days off, recurring off days, phases). Returns null if no config exists. Requires authentication; the user is resolved from the middleware-injected x-user-id header.
 *     tags:
 *       - User - Study Plan
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Config object, or null when none saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               nullable: true
 *               properties:
 *                 id:
 *                   type: string
 *                 exam_dates:
 *                   type: array
 *                   items:
 *                     type: string
 *                 days_off:
 *                   type: object
 *                 recurring_off:
 *                   type: array
 *                 phases:
 *                   type: array
 *       401:
 *         description: Missing x-user-id (unauthorized)
 *       500:
 *         description: Failed to fetch config
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const { data, error } = await supabase
      .from(TABLE_NAMES.BOARD_PREP_CONFIG)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      id: data.id,
      exam_dates: data.exam_dates,
      days_off: data.days_off,
      recurring_off: data.recurring_off,
      phases: data.phases,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/user/study-plan/config:
 *   put:
 *     summary: Save board-prep study-plan config
 *     description: Upserts the authenticated user's board-prep configuration (one row per user, keyed on user_id). Requires authentication via the middleware-injected x-user-id header. Omitted body fields default to empty values.
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
 *               exam_dates:
 *                 type: array
 *                 items:
 *                   type: string
 *               days_off:
 *                 type: object
 *               recurring_off:
 *                 type: array
 *               phases:
 *                 type: array
 *     responses:
 *       200:
 *         description: Config saved
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
 *         description: Failed to save config
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const config = await request.json();

    const { error } = await supabase.from(TABLE_NAMES.BOARD_PREP_CONFIG).upsert(
      {
        user_id: userId,
        exam_dates: config.exam_dates || [],
        days_off: config.days_off || {},
        recurring_off: config.recurring_off || [],
        phases: config.phases || [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
}
