import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { requireAdmin } from "@/shared/utils/api/api-guard";
import { log } from "@/shared/utils/logging";

/**
 * @swagger
 * /api/admin/audio/update-duration:
 *   post:
 *     summary: Update audio duration
 *     description: Update the duration (in seconds) of an existing audio file. Requires admin role.
 *     tags:
 *       - Admin - Audio
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - duration
 *             properties:
 *               id:
 *                 type: string
 *                 format: uuid
 *                 description: The ID of the audio file to update
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               duration:
 *                 type: number
 *                 format: float
 *                 minimum: 0.01
 *                 description: Duration of the audio file in seconds (must be greater than 0)
 *                 example: 125.5
 *     responses:
 *       200:
 *         description: Audio duration updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 audio:
 *                   type: object
 *                   description: Updated audio record
 *       400:
 *         description: Bad request - invalid audio ID or duration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid audio ID or duration."
 *       401:
 *         description: Unauthorized - missing authentication
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Authentication required."
 *       403:
 *         description: Forbidden - admin access required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Administrator privileges required."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to update duration: Database error"
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const auth = requireAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { id, duration } = body;

    if (!id || typeof duration !== "number" || duration <= 0) {
      return NextResponse.json({ error: "Invalid audio ID or duration." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("audio")
      .update({ duration_seconds: duration })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      log.error("Failed to update audio duration:", error);
      return NextResponse.json(
        { error: `Failed to update duration: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, audio: data });
  } catch (error) {
    log.error("Audio duration update error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Update failed: ${errorMessage}` }, { status: 500 });
  }
}
