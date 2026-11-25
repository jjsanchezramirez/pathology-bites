import { NextRequest, NextResponse } from "next/server";
import { parseBody } from "@/shared/utils/api/parse-body";
import { log } from "@/shared/utils/logging";
import { runTransitionRoute } from "@/features/admin/questions/services/transition-route";
import { z } from "zod";

const reassignQuestionSchema = z.object({
  reviewer_id: z.string().min(1),
});

/**
 * @swagger
 * /api/admin/questions/{id}/reassign:
 *   post:
 *     summary: Reassign question to different reviewer
 *     description: Change the assigned reviewer for a pending_review question. Only an admin or the question author (with create_questions) can reassign. Requires the new reviewer to be an admin or hold review_questions.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reviewer_id
 *             properties:
 *               reviewer_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of new reviewer (must be an admin or hold review_questions)
 *     responses:
 *       200:
 *         description: Question reassigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 question:
 *                   type: object
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - invalid reviewer_id or question not in pending_review
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - only an admin or the author can reassign
 *       404:
 *         description: Question or reviewer not found
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: questionId } = await params;
    const body = await parseBody(request, reassignQuestionSchema);
    if (body instanceof NextResponse) return body;
    return await runTransitionRoute(request, questionId, "reassign", {
      reviewerId: body.reviewer_id,
    });
  } catch (error) {
    log.error("Unexpected error reassigning question:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
