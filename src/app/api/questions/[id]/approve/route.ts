import { createClient } from "@/shared/services/server";
import { NextRequest, NextResponse } from "next/server";
import { NotificationTriggers } from "@/shared/services/notification-triggers";
import { getUserIdFromHeaders } from "@/shared/utils/auth-helpers";
import { revalidateQuestions } from "@/lib/revalidation";

/**
 * POST /api/questions/:id/approve
 *
 * Approve a question (reviewer action)
 * - Changes status from pending_review → published
 * - Sets published_at timestamp
 * - Only assigned reviewer or admin can approve
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { id: questionId } = await params;

    // Get current user
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        { error: `Cannot approve question with status: ${question.status}` },
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
        { error: "Only the assigned reviewer or admin can approve this question" },
        { status: 403 }
      );
    }

    // Update question to published
    const { data: updatedQuestion, error: updateError } = await supabase
      .from("questions")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", questionId)
      .select()
      .single();

    if (updateError) {
      console.error("Error approving question:", updateError);
      return NextResponse.json(
        { error: `Failed to approve question: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Record the review action
    const { error: reviewError } = await supabase.from("question_reviews").insert({
      question_id: questionId,
      reviewer_id: userId,
      action: "approved",
      feedback: null,
    });

    if (reviewError) {
      console.error("Error recording review:", reviewError);
      // Don't fail the request if review recording fails
    }

    // Send notification to creator
    try {
      const notificationTriggers = new NotificationTriggers();
      await notificationTriggers.onQuestionApproved(
        updatedQuestion.created_by,
        questionId,
        updatedQuestion.title,
        userId
      );
    } catch (error) {
      console.error("Error sending approval notification:", error);
      // Don't fail the request if notification fails
    }

    // Revalidate caches to update all admin pages
    revalidateQuestions({ questionId, includeDashboard: true });

    return NextResponse.json({
      success: true,
      question: updatedQuestion,
    });
  } catch (error) {
    console.error("Unexpected error approving question:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
