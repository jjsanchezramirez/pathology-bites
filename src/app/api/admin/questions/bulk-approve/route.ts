import { createClient } from "@/shared/services/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import { NotificationTriggers } from "@/shared/services/notification-triggers";
import { revalidateQuestions } from "@/shared/utils/api/revalidation";
import { log } from "@/shared/utils/logging";

const bulkApproveSchema = z.object({
  questionIds: z.array(z.string()).min(1),
});

/**
 * @swagger
 * /api/admin/questions/bulk-approve:
 *   post:
 *     summary: Bulk-approve questions
 *     description: >
 *       Approves multiple questions, transitioning each from `pending_review` to `published`,
 *       recording a `question_reviews` "approved" action and notifying authors.
 *       Each question must be `pending_review`; non-admins may only approve questions they are
 *       assigned to review. Ineligible IDs are skipped and reported in `errors`.
 *       Gated by middleware via `x-user-id`; admin/reviewer role enforced per-question.
 *     tags:
 *       - Admin - Questions
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - questionIds
 *             properties:
 *               questionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Non-empty array of question IDs to approve.
 *     responses:
 *       200:
 *         description: Approval result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 approved:
 *                   type: integer
 *                 failed:
 *                   type: integer
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       error:
 *                         type: string
 *       400:
 *         description: questionIds missing/empty, or no eligible questions
 *       401:
 *         description: Unauthorized (missing user)
 *       404:
 *         description: No questions found for the given IDs
 *       500:
 *         description: Failed to fetch or update questions
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const body = await parseBody(request, bulkApproveSchema);
    if (body instanceof NextResponse) return body;
    const { questionIds } = body;

    // Check if user is admin or reviewer
    const { data: userProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    const isAdmin = userProfile?.role === "admin";

    // Fetch all questions to validate
    const { data: questions, error: fetchError } = await supabase
      .from("questions")
      .select("id, status, reviewer_id, created_by, title")
      .in("id", questionIds);

    if (fetchError) {
      return NextResponse.json(
        { error: `Failed to fetch questions: ${fetchError.message}` },
        { status: 500 }
      );
    }

    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: "No questions found" }, { status: 404 });
    }

    // Validate all questions are pending_review and user has permission
    const errors: { id: string; error: string }[] = [];
    const validIds: string[] = [];

    for (const question of questions) {
      if (question.status !== "pending_review") {
        errors.push({ id: question.id, error: `Status is ${question.status}, not pending_review` });
      } else if (!isAdmin && question.reviewer_id !== userId) {
        errors.push({ id: question.id, error: "Not assigned as reviewer" });
      } else {
        validIds.push(question.id);
      }
    }

    if (validIds.length === 0) {
      return NextResponse.json(
        { error: "No questions eligible for approval", details: errors },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Bulk update all valid questions to published
    const { error: updateError } = await supabase
      .from("questions")
      .update({
        status: "published",
        published_at: now,
        updated_at: now,
        updated_by: userId,
      })
      .in("id", validIds);

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to approve questions: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Record review actions in bulk
    const reviewRecords = validIds.map((id) => ({
      question_id: id,
      reviewer_id: userId,
      action: "approved",
      feedback: null,
    }));

    const { error: reviewError } = await supabase.from("question_reviews").insert(reviewRecords);

    if (reviewError) {
      log.error("Error recording bulk reviews:", reviewError);
    }

    // Send notifications (non-blocking)
    const approvedQuestions = questions.filter((q) => validIds.includes(q.id));
    try {
      const notificationTriggers = new NotificationTriggers();
      await Promise.allSettled(
        approvedQuestions.map((q) =>
          notificationTriggers.onQuestionApproved(q.created_by, q.id, q.title, userId)
        )
      );
    } catch (error) {
      log.error("Error sending bulk approval notifications:", error);
    }

    revalidateQuestions({ includeDashboard: true });

    return NextResponse.json({
      success: true,
      approved: validIds.length,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    log.error("Unexpected error in bulk approve:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
