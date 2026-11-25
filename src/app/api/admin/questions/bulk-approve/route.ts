import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { runBulkTransition } from "@/features/admin/questions/services/bulk-transition";
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
 *       Gated by middleware via `x-user-id`; admin, or review_questions as the assigned reviewer, enforced per-question.
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
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const body = await parseBody(request, bulkApproveSchema);
    if (body instanceof NextResponse) return body;
    const { questionIds } = body;

    // Admins, or the assigned reviewer holding review_questions (checked per question in
    // transition_question, which also refuses an author approving their own question).
    if (!auth.can("review_questions")) {
      return NextResponse.json(
        { error: "Forbidden - requires review_questions permission" },
        { status: 403 }
      );
    }

    const { data: questions, error: fetchError } = await createServiceRoleClient()
      .from("questions")
      .select("id, status")
      .in("id", questionIds);

    if (fetchError) {
      log.error("Bulk approve: fetching questions failed:", fetchError);
      return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
    }

    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: "No questions found" }, { status: 404 });
    }

    // Only questions in review are bulk-approved; drafts are never published from here.
    const errors: { id: string; error: string }[] = [];
    const pendingIds: string[] = [];
    for (const question of questions) {
      if (question.status === "pending_review") pendingIds.push(question.id);
      else
        errors.push({ id: question.id, error: `Status is ${question.status}, not pending_review` });
    }

    if (pendingIds.length === 0) {
      return NextResponse.json(
        { error: "No questions eligible for approval", details: errors },
        { status: 400 }
      );
    }

    const outcome = await runBulkTransition(userId, pendingIds, "approve");
    errors.push(...outcome.errors);

    if (outcome.done.length > 0) revalidateQuestions({ includeDashboard: true });

    return NextResponse.json({
      success: true,
      approved: outcome.done.length,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    log.error("Unexpected error in bulk approve:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
