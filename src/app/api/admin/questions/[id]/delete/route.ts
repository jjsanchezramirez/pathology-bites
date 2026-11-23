import { createClient } from "@/shared/services/server";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/shared/utils/api/api-guard";
import { log } from "@/shared/utils/logging";

/**
 * @swagger
 * /api/admin/questions/{id}/delete:
 *   delete:
 *     summary: Delete a draft question
 *     description: Permanently delete a question. Only draft questions can be deleted. Admins can delete any draft question, creators can only delete their own drafts. Reviewers cannot delete questions.
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
 *         description: Question deleted successfully
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
 *       400:
 *         description: Bad request - question not in draft status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions or not question owner
 *       404:
 *         description: Question not found
 *       500:
 *         description: Internal server error
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    log.debug("DELETE route called");
    const supabase = await createClient();
    const { id: questionId } = await params;
    log.debug(`Question ID to delete: ${questionId}`);

    // Get current user
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    // Admins, or holders of create_questions (own drafts only, checked below)
    const isAdmin = auth.role === "admin";
    if (!auth.can("create_questions")) {
      return NextResponse.json(
        { error: "Insufficient permissions. Requires the create_questions permission." },
        { status: 403 }
      );
    }

    // Get the question to check status and ownership
    const { data: question, error: fetchError } = await supabase
      .from("questions")
      .select("id, status, created_by, title")
      .eq("id", questionId)
      .single();

    if (fetchError || !question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Check if question is in draft status (only draft questions can be deleted)
    if (question.status !== "draft") {
      return NextResponse.json(
        {
          error: `Cannot delete question with status '${question.status}'. Only draft questions can be deleted.`,
          details: {
            currentStatus: question.status,
            allowedStatus: "draft",
          },
        },
        { status: 400 }
      );
    }

    // Check ownership permissions
    const isOwner = question.created_by === userId;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "You can only delete your own questions" },
        { status: 403 }
      );
    }

    // Delete the question (cascade will handle related records)
    log.debug(`Attempting to delete question: ${questionId}`);
    // Service role after the checks above: the questions DELETE policy is admin-only, so a
    // caller-client delete by an author matched zero rows and still reported success. The
    // status filter is the barrier against a draft that was submitted meanwhile.
    const { error: deleteError, data: deleteData } = await createServiceRoleClient()
      .from("questions")
      .delete()
      .eq("id", questionId)
      .eq("status", "draft")
      .select("id");

    log.debug("Delete result:", { deleteError, deleteData });

    if (deleteError) {
      log.error("Error deleting question:", deleteError);
      return NextResponse.json(
        { error: `Failed to delete question: ${deleteError.message}`, details: deleteError },
        { status: 500 }
      );
    }

    if (!deleteData || deleteData.length === 0) {
      return NextResponse.json({ error: "Question is no longer a draft" }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      message: `Question "${question.title}" deleted successfully`,
      questionId: questionId,
    });
  } catch (error) {
    log.error("Unexpected error deleting question:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
