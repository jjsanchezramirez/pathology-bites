import { NextRequest, NextResponse } from "next/server";
import { parseBody } from "@/shared/utils/api/parse-body";
import { log } from "@/shared/utils/logging";
import { runTransitionRoute } from "@/features/admin/questions/services/transition-route";
import { z } from "zod";

const rejectQuestionSchema = z.object({
  feedback: z.string().trim().min(1),
});

/**
 * @swagger
 * /api/admin/questions/{id}/reject:
 *   post:
 *     summary: Reject a question
 *     description: Reject a pending_review question with required feedback. Changes status to rejected and notifies creator. Only assigned reviewer or admin can reject.
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
 *               - feedback
 *             properties:
 *               feedback:
 *                 type: string
 *                 description: Detailed feedback explaining rejection reasons
 *     responses:
 *       200:
 *         description: Question rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 question:
 *                   type: object
 *       400:
 *         description: Bad request - missing feedback or question not in pending_review
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - only assigned reviewer or admin can reject
 *       404:
 *         description: Question not found
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: questionId } = await params;
    const body = await parseBody(request, rejectQuestionSchema);
    if (body instanceof NextResponse) return body;
    return await runTransitionRoute(request, questionId, "reject", { feedback: body.feedback });
  } catch (error) {
    log.error("Unexpected error rejecting question:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
