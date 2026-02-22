import { createClient } from "@/shared/services/server";
import { NextRequest, NextResponse } from "next/server";
import { NotificationTriggers } from "@/shared/services/notification-triggers";
import { revalidateQuestions } from "@/shared/utils/api/revalidation";

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
    const supabase = await createClient();
    const { id: questionId } = await params;

    // Get current user
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { feedback } = body;

    // Validate feedback is provided
    if (!feedback || typeof feedback !== "string" || feedback.trim() === "") {
      return NextResponse.json(
        { error: "Feedback is required when rejecting a question" },
        { status: 400 }
      );
    }

    // Get the question to verify reviewer assignment
    const { data: question, error: fetchError } = await supabase
      .from("questions")
      .select("id, status, reviewer_id, created_by")
      .eq("id", questionId)
      .single();

    if (fetchError || !question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Verify question is in pending_review state
    if (question.status !== "pending_review") {
      return NextResponse.json(
        { error: `Cannot reject question with status: ${question.status}` },
        { status: 400 }
      );
    }

    // Check if user is the assigned reviewer or admin
    const { data: userProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    const isAdmin = userProfile?.role === "admin";
    const isAssignedReviewer = question.reviewer_id === userId;

    if (!isAdmin && !isAssignedReviewer) {
      return NextResponse.json(
        { error: "Only the assigned reviewer or admin can reject this question" },
        { status: 403 }
      );
    }

    // Update question to rejected with feedback
    const { data: updatedQuestion, error: updateError } = await supabase
      .from("questions")
      .update({
        status: "rejected",
        reviewer_feedback: feedback.trim(),
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", questionId)
      .select()
      .single();

    if (updateError) {
      console.error("Error rejecting question:", updateError);
      return NextResponse.json(
        { error: `Failed to reject question: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Record the review action
    const { error: reviewError } = await supabase.from("question_reviews").insert({
      question_id: questionId,
      reviewer_id: userId,
      action: "rejected",
      feedback: feedback.trim(),
    });

    if (reviewError) {
      console.error("Error recording review:", reviewError);
      // Don't fail the request if review recording fails
    }

    // Send notification to creator
    try {
      const notificationTriggers = new NotificationTriggers();
      await notificationTriggers.onQuestionRejected(
        updatedQuestion.created_by,
        questionId,
        updatedQuestion.title,
        userId,
        feedback.trim()
      );
    } catch (error) {
      console.error("Error sending rejection notification:", error);
      // Don't fail the request if notification fails
    }

    // Revalidate caches to update all admin pages
    revalidateQuestions({ questionId, includeDashboard: true });

    return NextResponse.json({
      success: true,
      question: updatedQuestion,
    });
  } catch (error) {
    console.error("Unexpected error rejecting question:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
