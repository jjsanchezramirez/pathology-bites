import { NextRequest, NextResponse } from "next/server";
import { log } from "@/shared/utils/logging";
import { runTransitionRoute } from "@/features/admin/questions/services/transition-route";

/**
 * @swagger
 * /api/admin/questions/{id}/restore:
 *   post:
 *     summary: Restore an archived question
 *     description: Moves an archived question back to draft so it can be edited and submitted again. Only its author or an admin can restore it.
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
 *           format: uuid
 *         description: Question ID
 *     responses:
 *       200:
 *         description: Question restored to draft
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 question:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - only the author or an admin can restore
 *       404:
 *         description: Question not found
 *       409:
 *         description: The question is not archived
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: questionId } = await params;
    return await runTransitionRoute(request, questionId, "restore", {});
  } catch (error) {
    log.error("Unexpected error restoring question:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
