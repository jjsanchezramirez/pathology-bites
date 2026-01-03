import { getUserIdFromHeaders } from "@/shared/utils/auth-helpers";
// src/app/api/quiz/sessions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { quizService } from "@/features/quiz/services/quiz-service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check if user is authenticated
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get quiz session using authenticated client
    const quizSession = await quizService.getQuizSession(id, supabase);

    if (!quizSession) {
      return NextResponse.json({ error: "Quiz session not found" }, { status: 404 });
    }

    // Check if user owns this quiz session
    if (quizSession.userId !== userId) {
      return NextResponse.json(
        { error: "Forbidden - You can only access your own quiz sessions" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: quizSession,
    });
  } catch (error) {
    console.error("Error fetching quiz session:", error);
    return NextResponse.json({ error: "Failed to fetch quiz session" }, { status: 500 });
  }
}

interface BatchAnswerSubmission {
  questionId: string;
  selectedAnswerId: string;
  timeSpent: number;
  timestamp: number;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check if user is authenticated
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const updates: {
      action?: string;
      timeRemaining?: number;
      currentQuestionIndex?: number;
      totalTimeSpent?: number;
      status?: string;
      answers?: BatchAnswerSubmission[];
    } = await request.json();

    // Get existing quiz session to verify ownership
    const existingSession = await quizService.getQuizSession(id, supabase);
    if (!existingSession) {
      return NextResponse.json({ error: "Quiz session not found" }, { status: 404 });
    }

    if (existingSession.userId !== userId) {
      return NextResponse.json(
        { error: "Forbidden - You can only update your own quiz sessions" },
        { status: 403 }
      );
    }

    // SAFEGUARD: Prevent updating completed quizzes
    // This prevents accidental status changes if user navigates back after completion
    if (existingSession.status === "completed") {
      // Allow answer submissions (they'll be deduplicated), but don't update session
      if (updates.answers && updates.answers.length > 0) {
        console.log(
          "[Quiz PATCH] Quiz already completed - accepting answers but not updating session"
        );
        // Continue to answer submission below, but skip session update
      } else {
        console.log("[Quiz PATCH] Attempted to update completed quiz - blocking update");
        return NextResponse.json({
          success: true,
          message: "Quiz is already completed - no updates allowed",
        });
      }
    }

    // OPTIMIZATION: Submit answers if provided (eliminates separate batch call!)
    if (updates.answers && updates.answers.length > 0) {
      console.log(
        `[Quiz PATCH] Submitting ${updates.answers.length} answers during progress update`
      );

      const attemptData = updates.answers.map((answer) => ({
        quiz_session_id: id,
        question_id: answer.questionId,
        selected_answer_id: answer.selectedAnswerId,
        time_spent: answer.timeSpent || 0,
        attempted_at: new Date(answer.timestamp).toISOString(),
      }));

      // Check for existing attempts to prevent duplicates
      const questionIds = updates.answers.map((a) => a.questionId);
      const { data: existingAttempts } = await supabase
        .from("quiz_attempts")
        .select("question_id")
        .eq("quiz_session_id", id)
        .in("question_id", questionIds);

      // Filter out questions that already have attempts
      const existingQuestionIds = new Set(existingAttempts?.map((a) => a.question_id) || []);
      const newAttemptData = attemptData.filter(
        (attempt) => !existingQuestionIds.has(attempt.question_id)
      );

      // Insert new attempts
      if (newAttemptData.length > 0) {
        const { error: insertError } = await supabase.from("quiz_attempts").insert(newAttemptData);

        if (insertError) {
          console.error("[Quiz PATCH] Error inserting answers:", insertError);
          // Don't fail the update - continue with progress save
        } else {
          console.log(`[Quiz PATCH] Inserted ${newAttemptData.length} answers`);
        }
      }

      // If quiz was already completed and we just submitted answers, return success
      if (existingSession.status === "completed") {
        return NextResponse.json({
          success: true,
          message: "Answers recorded (quiz already completed)",
        });
      }
    }

    // Remove answers from updates object before passing to service
    const { _answers, ...sessionUpdates } = updates;

    // Skip session updates if quiz is already completed
    if (existingSession.status === "completed") {
      return NextResponse.json({
        success: true,
        message: "Quiz is already completed - no updates allowed",
      });
    }

    // Handle special actions
    if (sessionUpdates.action === "start") {
      await quizService.startQuizSession(id, supabase);
    } else if (sessionUpdates.action === "pause") {
      await quizService.pauseQuizSession(id, sessionUpdates.timeRemaining || 0, supabase);
    } else if (sessionUpdates.action === "resume") {
      await quizService.resumeQuizSession(id, supabase);
    } else {
      // Regular update
      await quizService.updateQuizSession(id, sessionUpdates, supabase);
    }

    return NextResponse.json({
      success: true,
      message: "Quiz session updated successfully",
    });
  } catch (error) {
    console.error("Error updating quiz session:", error);
    return NextResponse.json({ error: "Failed to update quiz session" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check if user is authenticated
    const userId = getUserIdFromHeaders(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user owns this quiz session
    const { data: session, error: sessionError } = await supabase
      .from("quiz_sessions")
      .select("user_id")
      .eq("id", id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Quiz session not found" }, { status: 404 });
    }

    if (session.user_id !== userId) {
      return NextResponse.json(
        { error: "Forbidden - You can only delete your own quiz sessions" },
        { status: 403 }
      );
    }

    // Delete quiz attempts first (cascade)
    await supabase.from("quiz_attempts").delete().eq("quiz_session_id", id);

    // Delete quiz session
    const { error: deleteError } = await supabase.from("quiz_sessions").delete().eq("id", id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: "Quiz session deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting quiz session:", error);
    return NextResponse.json({ error: "Failed to delete quiz session" }, { status: 500 });
  }
}
