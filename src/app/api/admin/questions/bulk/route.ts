import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidateQuestions } from "@/shared/utils/api/revalidation";

// Create Supabase client with service role for admin operations
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}

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
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action, questionIds } = await request.json();

    if (!action || !Array.isArray(questionIds) || questionIds.length === 0) {
      return NextResponse.json(
        { error: "Invalid request. Requires action and questionIds array." },
        { status: 400 }
      );
    }

    // Limit bulk operations to prevent excessive resource usage
    if (questionIds.length > 100) {
      return NextResponse.json(
        { error: "Bulk operations limited to 100 questions at a time" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get user role for permission checks
    const { data: userProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", userId)
      .single();

    const userRole = userProfile?.role || "user";

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

    let result;
    let affectedCount = 0;

    switch (action) {
      case "submit_for_review":
        // Only allow submitting own draft questions or admin can submit any draft
        const draftQuestions =
          questions?.filter(
            (q) => q.status === "draft" && (q.created_by === userId || userRole === "admin")
          ) || [];

        if (draftQuestions.length === 0) {
          return NextResponse.json(
            { error: "No eligible draft questions found for submission" },
            { status: 400 }
          );
        }

        result = await supabase
          .from("questions")
          .update({
            status: "pending_review",
            submitted_for_review_at: new Date().toISOString(),
          })
          .in(
            "id",
            draftQuestions.map((q) => q.id)
          );

        affectedCount = draftQuestions.length;
        break;

      case "approve":
        // Only admins can approve questions
        if (userRole !== "admin") {
          return NextResponse.json({ error: "Only admins can approve questions" }, { status: 403 });
        }

        const pendingQuestions = questions?.filter((q) => q.status === "pending_review") || [];

        if (pendingQuestions.length === 0) {
          return NextResponse.json(
            { error: "No pending questions found for approval" },
            { status: 400 }
          );
        }

        result = await supabase
          .from("questions")
          .update({
            status: "published",
            published_at: new Date().toISOString(),
            updated_by: userId,
          })
          .in(
            "id",
            pendingQuestions.map((q) => q.id)
          );

        affectedCount = pendingQuestions.length;
        break;

      case "reject":
        // Only admins can reject questions
        if (userRole !== "admin") {
          return NextResponse.json({ error: "Only admins can reject questions" }, { status: 403 });
        }

        const rejectableQuestions =
          questions?.filter((q) => ["pending_review", "published"].includes(q.status)) || [];

        if (rejectableQuestions.length === 0) {
          return NextResponse.json(
            { error: "No questions found that can be rejected" },
            { status: 400 }
          );
        }

        result = await supabase
          .from("questions")
          .update({
            status: "rejected",
            updated_at: new Date().toISOString(),
            updated_by: userId,
          })
          .in(
            "id",
            rejectableQuestions.map((q) => q.id)
          );

        affectedCount = rejectableQuestions.length;
        break;

      case "delete":
        // Only allow deleting own draft questions or admin can delete any draft
        const deletableQuestions =
          questions?.filter(
            (q) => q.status === "draft" && (q.created_by === userId || userRole === "admin")
          ) || [];

        if (deletableQuestions.length === 0) {
          return NextResponse.json(
            { error: "No eligible draft questions found for deletion" },
            { status: 400 }
          );
        }

        // Delete related data first (due to foreign key constraints)
        await supabase
          .from("question_options")
          .delete()
          .in(
            "question_id",
            deletableQuestions.map((q) => q.id)
          );
        await supabase
          .from("question_images")
          .delete()
          .in(
            "question_id",
            deletableQuestions.map((q) => q.id)
          );
        await supabase
          .from("question_tags")
          .delete()
          .in(
            "question_id",
            deletableQuestions.map((q) => q.id)
          );
        await supabase
          .from("question_categories")
          .delete()
          .in(
            "question_id",
            deletableQuestions.map((q) => q.id)
          );

        result = await supabase
          .from("questions")
          .delete()
          .in(
            "id",
            deletableQuestions.map((q) => q.id)
          );

        affectedCount = deletableQuestions.length;
        break;

      case "export":
        // Fetch full question data for export
        const { data: exportData, error: exportError } = await supabase
          .from("questions")
          .select(
            `
            *,
            question_options(*),
            question_images(*),
            question_tags(tag_id),
            question_categories(category_id)
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

      default:
        return NextResponse.json(
          {
            error: "Invalid action. Supported: submit_for_review, approve, reject, delete, export",
          },
          { status: 400 }
        );
    }

    if (result?.error) {
      console.error(`Bulk ${action} error:`, result.error);
      return NextResponse.json({ error: `Failed to ${action} questions` }, { status: 500 });
    }

    // Revalidate caches to update all admin pages (for mutation operations)
    if (action !== "export") {
      revalidateQuestions({ includeDashboard: true });
    }

    return NextResponse.json({
      success: true,
      action,
      affectedCount,
      message: `Successfully ${action.replace("_", " ")}ed ${affectedCount} question(s)`,
    });
  } catch (error) {
    console.error("Bulk questions operation error:", error);
    return NextResponse.json(
      {
        error: "Bulk operation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
