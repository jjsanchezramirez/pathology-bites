import { NextRequest, NextResponse } from "next/server";
import { log } from "@/shared/utils/logging";
import { runTransitionRoute } from "@/features/admin/questions/services/transition-route";

/**
 * @swagger
 * /api/admin/questions/{id}/delete:
 *   delete:
 *     summary: Archive a question
 *     description: Archives (retires) a question; nothing is deleted and it can be restored as a draft. Admins can archive any question that is not already archived; authors can archive their own draft or rejected questions.
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
 *         description: Question archived
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 questionId:
 *                   type: string
 *                   format: uuid
 *       409:
 *         description: Question is already archived
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions or not question owner
 *       404:
 *         description: Question not found
 *       500:
 *         description: Internal server error
 */
// Questions are retired, never deleted: this archives the question (rows, attempts and
// history are kept). Admins and the author of a draft or rejected question may archive;
// an archived question can be restored as a draft.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params;
    const response = await runTransitionRoute(request, questionId, "archive");
    if (!response.ok) return response;
    return NextResponse.json({
      success: true,
      archived: true,
      message: "Question archived",
      questionId,
    });
  } catch (error) {
    log.error("Unexpected error archiving question:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
