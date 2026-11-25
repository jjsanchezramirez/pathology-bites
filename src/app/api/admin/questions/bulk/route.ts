import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { revalidateQuestions } from "@/shared/utils/api/revalidation";
import { log } from "@/shared/utils/logging";
import { runBulkTransition } from "@/features/admin/questions/services/bulk-transition";
import type { QuestionAction } from "@/features/admin/questions/services/question-service";

const bulkQuestionsSchema = z
  .object({
    action: z.enum(["submit_for_review", "approve", "reject", "delete", "export"]),
    // Bulk operations limited to 100 questions at a time to prevent excessive resource usage
    questionIds: z.array(z.string()).min(1).max(100),
    // Required for submit_for_review: pending_review rows must name a reviewer
    // (check_pending_has_reviewer), exactly as the single submit route requires.
    reviewer_id: z.string().uuid().optional(),
    // Required for reject: rejected rows must carry feedback (check_rejected_has_feedback).
    feedback: z.string().trim().min(1).max(5000).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.action === "submit_for_review" && !body.reviewer_id) {
      ctx.addIssue({ code: "custom", path: ["reviewer_id"], message: "Select a reviewer" });
    }
    if (body.action === "reject" && !body.feedback) {
      ctx.addIssue({ code: "custom", path: ["feedback"], message: "Feedback is required" });
    }
  });

// For the success message ("submit_for_reviewed" read badly).
const ACTION_PAST_TENSE: Record<z.infer<typeof bulkQuestionsSchema>["action"], string> = {
  submit_for_review: "submitted for review",
  approve: "approved",
  reject: "rejected",
  delete: "archived",
  export: "exported",
};

// "delete" archives: questions are retired, never deleted (history and attempts are kept).
const BULK_ACTIONS: Record<
  Exclude<z.infer<typeof bulkQuestionsSchema>["action"], "export">,
  { action: QuestionAction; from: string[]; noneEligible: string }
> = {
  submit_for_review: {
    action: "submit",
    from: ["draft", "rejected"],
    noneEligible: "No eligible draft questions found for submission",
  },
  approve: {
    action: "approve",
    from: ["pending_review"],
    noneEligible: "No pending questions found for approval",
  },
  reject: {
    action: "reject",
    from: ["pending_review", "published", "flagged"],
    noneEligible: "No questions found that can be rejected",
  },
  delete: {
    action: "archive",
    from: ["draft", "rejected"],
    noneEligible: "No eligible draft questions found to archive",
  },
};

/**
 * @swagger
 * /api/admin/questions/bulk:
 *   post:
 *     summary: Perform bulk operations on questions
 *     description: Execute bulk actions on multiple questions (submit for review, approve, reject, delete, or export). Requires authentication and appropriate permissions based on action.
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
 *               - action
 *               - questionIds
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [submit_for_review, approve, reject, delete, export]
 *                 description: The bulk action to perform
 *               questionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 maxItems: 100
 *                 description: Array of question IDs to operate on (maximum 100)
 *               reviewer_id:
 *                 type: string
 *                 format: uuid
 *                 description: Required for submit_for_review. An admin or a holder of review_questions to assign.
 *               feedback:
 *                 type: string
 *                 description: Required for reject. Stored as reviewer feedback on each question.
 *     responses:
 *       200:
 *         description: Bulk operation completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 action:
 *                   type: string
 *                 affectedCount:
 *                   type: integer
 *                   description: Number of questions affected
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   description: Exported question data (only for export action)
 *                 count:
 *                   type: integer
 *                   description: Count of exported items (only for export action)
 *       400:
 *         description: Bad request - invalid action, missing questionIds, or exceeds limit
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - insufficient permissions for action
 *       404:
 *         description: Some questions not found
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const body = await parseBody(request, bulkQuestionsSchema);
    if (body instanceof NextResponse) return body;
    const { action, questionIds, reviewer_id, feedback } = body;

    const supabase = createServiceRoleClient();

    // Fetch questions to validate permissions
    const { data: questions, error: fetchError } = await supabase
      .from("questions")
      .select("id, status, created_by")
      .in("id", questionIds);

    if (fetchError) {
      return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
    }

    const foundQuestionIds = questions?.map((q) => q.id) || [];
    const notFoundIds = questionIds.filter((id) => !foundQuestionIds.includes(id));

    if (notFoundIds.length > 0) {
      return NextResponse.json(
        {
          error: "Some questions not found",
          notFoundIds,
          foundCount: foundQuestionIds.length,
        },
        { status: 404 }
      );
    }

    if (action === "export") {
      // Fetch full question data for export
      const { data: exportData, error: exportError } = await supabase
        .from("questions")
        .select(
          `
          *,
          question_options(*),
          question_images(*),
          question_tags(tag_id)
        `
        )
        .in("id", questionIds);

      if (exportError) {
        return NextResponse.json({ error: "Failed to export questions" }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: "export",
        data: exportData,
        count: exportData?.length || 0,
      });
    }

    // Which statuses each bulk action applies to; the rest are skipped and reported. Permission
    // and state checks are repeated per question inside transition_question.
    const plan = BULK_ACTIONS[action];
    const eligible = (questions ?? []).filter((q) => plan.from.includes(q.status));
    const skipped = (questions ?? [])
      .filter((q) => !plan.from.includes(q.status))
      .map((q) => ({ id: q.id, error: `Status is ${q.status}` }));

    if (eligible.length === 0) {
      return NextResponse.json(
        { error: plan.noneEligible, errors: skipped.length > 0 ? skipped : undefined },
        { status: 400 }
      );
    }

    const { done, errors } = await runBulkTransition(
      userId,
      eligible.map((q) => q.id),
      plan.action,
      { reviewerId: reviewer_id ?? null, feedback: feedback ?? null }
    );
    const failed = [...skipped, ...errors];

    if (done.length > 0) revalidateQuestions({ includeDashboard: true });

    if (done.length === 0) {
      return NextResponse.json(
        { error: errors[0]?.error ?? plan.noneEligible, errors: failed },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      action,
      affectedCount: done.length,
      failed: failed.length,
      errors: failed.length > 0 ? failed : undefined,
      message:
        `Successfully ${ACTION_PAST_TENSE[action]} ${done.length} question(s)` +
        (failed.length > 0 ? `; ${failed.length} skipped` : ""),
    });
  } catch (error) {
    log.error("Bulk questions operation error:", error);
    return NextResponse.json(
      {
        error: "Bulk operation failed",
      },
      { status: 500 }
    );
  }
}
