import { NextRequest, NextResponse } from "next/server";
import { requireContentRole } from "@/shared/utils/api/api-guard";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { log } from "@/shared/utils/logging";

/**
 * @swagger
 * /api/admin/questions/{id}/export:
 *   get:
 *     summary: Export a single question
 *     description: >
 *       Returns the full question record (options, images, tags, question set, category) as JSON.
 *       Gated by middleware via `x-user-id`; requires an `admin`, `creator`, or `reviewer` role
 *       (`x-user-role`). Data is read through a service-role Supabase client.
 *     tags:
 *       - Admin - Questions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Question ID.
 *     responses:
 *       200:
 *         description: The full question record
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Unauthorized (missing user)
 *       403:
 *         description: Forbidden (insufficient role)
 *       404:
 *         description: Question not found
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireContentRole(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("questions")
      .select(
        `
        *,
        question_options(*),
        question_images(*),
        question_tags(tag_id),
        question_set:question_sets(id, name, short_form),
        category:categories(id, name, short_form, color)
      `
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    log.error("Unexpected export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
