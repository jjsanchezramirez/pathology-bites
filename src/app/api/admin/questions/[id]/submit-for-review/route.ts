import { NextRequest, NextResponse } from "next/server";
import { parseBody } from "@/shared/utils/api/parse-body";
import { log } from "@/shared/utils/logging";
import { runTransitionRoute } from "@/features/admin/questions/services/transition-route";
import { z } from "zod";

const submitForReviewSchema = z.object({
  reviewer_id: z.string().min(1),
  resubmission_notes: z.string().nullish(),
});

/**
 * @swagger
 * /api/admin/questions/{id}/submit-for-review:
 *   post:
 *     summary: Submit question for review
 *     description: Submit a draft or rejected question for review by assigning a reviewer. Changes status to pending_review and notifies reviewer. Clears previous feedback. Only creator or admin can submit.
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
 *                 description: ID of reviewer to assign (must be an admin or hold review_questions)
 *               resubmission_notes:
 *                 type: string
 *                 description: Notes about changes made (optional, for rejected → pending transitions)
 *     responses:
 *       200:
 *         description: Question submitted for review successfully
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
 *         description: Bad request - invalid reviewer_id or question not in draft/rejected status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - only the author (with create_questions) or an admin can submit
 *       404:
 *         description: Question or reviewer not found
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: questionId } = await params;
    const body = await parseBody(request, submitForReviewSchema);
    if (body instanceof NextResponse) return body;
    return await runTransitionRoute(request, questionId, "submit", {
      reviewerId: body.reviewer_id,
      notes: body.resubmission_notes ?? null,
    });
  } catch (error) {
    log.error("Unexpected error submitting question for review:", error);
    return NextResponse.json(
      { error: "Internal server error. Please try again later." },
      { status: 500 }
    );
  }
}
