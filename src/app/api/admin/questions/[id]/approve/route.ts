import { NextRequest, NextResponse } from "next/server";
import { log } from "@/shared/utils/logging";
import { runTransitionRoute } from "@/features/admin/questions/services/transition-route";
import { z } from "zod";

// Optional reviewer note stored on the approval record.
const approveQuestionSchema = z.object({ feedback: z.string().nullish() }).passthrough();

/**
 * @swagger
 * /api/admin/questions/{id}/approve:
 *   post:
 *     summary: Approve a question
 *     description: Approve a pending_review question and publish it. Changes status to published, sets published_at timestamp, and notifies creator. Only assigned reviewer or admin can approve.
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
 *         description: Question approved and published successfully
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
 *         description: Bad request - question not in pending_review status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - only assigned reviewer or admin can approve
 *       404:
 *         description: Question not found
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: questionId } = await params;
    const raw = await request.json().catch(() => ({}));
    const parsed = approveQuestionSchema.safeParse(raw ?? {});
    return await runTransitionRoute(request, questionId, "approve", {
      feedback: parsed.success ? (parsed.data.feedback ?? null) : null,
    });
  } catch (error) {
    log.error("Unexpected error approving question:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
