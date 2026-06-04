import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { TABLE_NAMES } from "@/shared/types/database";

/**
 * @swagger
 * /api/user/study-plan/resources:
 *   get:
 *     summary: List board-prep resources
 *     description: Returns the authenticated user's board-prep study resources (books, question banks, etc.), ordered by creation time. Requires authentication via the middleware-injected x-user-id header.
 *     tags:
 *       - User - Study Plan
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Array of resources
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   short_name:
 *                     type: string
 *                   type:
 *                     type: string
 *                   color:
 *                     type: string
 *                   subjects:
 *                     type: array
 *                   pace:
 *                     type: number
 *                   active:
 *                     type: boolean
 *       401:
 *         description: Missing x-user-id (unauthorized)
 *       500:
 *         description: Failed to fetch resources
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = request.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from(TABLE_NAMES.BOARD_PREP_RESOURCES)
      .select("*")
      .eq("user_id", userId)
      .order("created_at");

    if (error) throw error;

    const resources = (data || []).map((r: Record<string, unknown>) => ({
      id: r.resource_id,
      name: r.name,
      short_name: r.short_name,
      type: r.type,
      color: r.color,
      subjects: r.subjects,
      pace: Number(r.pace),
      active: r.active,
    }));

    return NextResponse.json(resources);
  } catch {
    return NextResponse.json({ error: "Failed to fetch resources" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/user/study-plan/resources:
 *   put:
 *     summary: Replace board-prep resources
 *     description: Replaces the authenticated user's entire resource set (deletes all existing rows, then inserts the provided list). Requires authentication via the middleware-injected x-user-id header. Per-resource fields fall back to defaults (color #DBEAFE, pace 10, active true) when omitted.
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
 *               resources:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     short_name:
 *                       type: string
 *                     type:
 *                       type: string
 *                     color:
 *                       type: string
 *                     subjects:
 *                       type: array
 *                     pace:
 *                       type: number
 *                     active:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: Resources saved
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
 *         description: Failed to save resources
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const userId = request.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { resources } = await request.json();

    // Delete existing resources for user, then insert new ones
    await supabase.from(TABLE_NAMES.BOARD_PREP_RESOURCES).delete().eq("user_id", userId);

    if (resources && resources.length > 0) {
      const rows = resources.map((r: Record<string, unknown>) => ({
        user_id: userId,
        resource_id: r.id,
        name: r.name,
        short_name: r.short_name || "",
        type: r.type,
        color: r.color || "#DBEAFE",
        subjects: r.subjects || [],
        pace: r.pace || 10,
        active: r.active !== false,
      }));

      const { error } = await supabase.from(TABLE_NAMES.BOARD_PREP_RESOURCES).insert(rows);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save resources" }, { status: 500 });
  }
}
