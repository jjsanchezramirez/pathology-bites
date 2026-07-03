import { NextRequest, NextResponse } from "next/server";
import { requireContentRole } from "@/shared/utils/api/api-guard";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { log } from "@/shared/utils/logging";

/**
 * @swagger
 * /api/admin/questions/export-all:
 *   get:
 *     summary: Export all questions
 *     description: >
 *       Returns every question with its options, images, tags, question set, and category as JSON,
 *       along with a count and export timestamp.
 *       Gated by middleware via `x-user-id`; requires an `admin`, `creator`, or `reviewer` role
 *       (`x-user-role`). Data is read through a service-role Supabase client.
 *     tags:
 *       - Admin - Questions
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All questions exported
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 count:
 *                   type: integer
 *                 exported_at:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized (missing user)
 *       403:
 *         description: Forbidden (insufficient role)
 *       500:
 *         description: Failed to export questions
 */
export async function GET(request: NextRequest) {
  try {
    const auth = requireContentRole(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.from("questions").select(
      `
        *,
        question_options(*),
        question_images(*),
        question_tags(tag_id),
        question_set:question_sets(id, name, short_form),
        category:categories(id, name, short_form, color)
      `
    );

    if (error) {
      log.error("Error exporting questions:", error);
      return NextResponse.json({ error: "Failed to export questions" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      exported_at: new Date().toISOString(),
    });
  } catch (error) {
    log.error("Unexpected export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
