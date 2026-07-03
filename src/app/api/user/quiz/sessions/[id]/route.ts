// src/app/api/user/quiz/sessions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/shared/services/server";
import { quizService } from "@/features/user/quiz/services/quiz-service";
import { requireUser } from "@/shared/utils/api/api-guard";
import { parseBody } from "@/shared/utils/api/parse-body";
import { QuizStatus } from "@/features/user/quiz/types/quiz";
import { log } from "@/shared/utils/logging";

interface QuizSessionUpdate {
  action?: "start" | "pause" | "resume";
  timeRemaining?: number;
  currentQuestionIndex?: number;
  totalTimeSpent?: number;
  status?: QuizStatus;
}

/**
 * @swagger
 * /api/user/quiz/sessions/{id}:
 *   get:
 *     summary: Get quiz session details
 *     description: Retrieve detailed information about a specific quiz session. Users can only access their own quiz sessions. Requires authentication.
 *     tags:
 *       - User - Quiz
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Quiz session ID
 *     responses:
 *       200:
 *         description: Quiz session retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: Quiz session details including config, status, and progress
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - user can only access own quiz sessions
 *       404:
 *         description: Quiz session not found
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check if user is authenticated
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

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
    log.error("Error fetching quiz session:", error);
    return NextResponse.json({ error: "Failed to fetch quiz session" }, { status: 500 });
  }
}

const batchAnswerSchema = z.object({
  questionId: z.string(),
  selectedAnswerId: z.string(),
  timeSpent: z.number().optional(),
  timestamp: z.number(),
});

// Loose on purpose: `action`/`status` stay plain strings (unknown actions fall
// through to the regular-update path, as before), and passthrough preserves
// extra keys quizService.updateQuizSession reads off the same object (score,
// correctAnswers, startedAt, completedAt, totalTimeLimit).
const quizSessionPatchSchema = z
  .object({
    action: z.string().optional(),
    timeRemaining: z.number().optional(),
    currentQuestionIndex: z.number().optional(),
    totalTimeSpent: z.number().optional(),
    status: z.string().optional(),
    answers: z.array(batchAnswerSchema).optional(),
  })
  .passthrough();

/**
 * @swagger
 * /api/user/quiz/sessions/{id}:
 *   patch:
 *     summary: Update quiz session
 *     description: Update quiz session progress, state, or submit answers in batch. Supports actions like start, pause, resume, and general progress updates. Optimized to accept answer submissions to reduce API calls. Requires authentication.
 *     tags:
 *       - User - Quiz
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Quiz session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [start, pause, resume]
 *                 description: Action to perform on quiz session
 *               timeRemaining:
 *                 type: integer
 *                 description: Time remaining in seconds (for timed quizzes)
 *               currentQuestionIndex:
 *                 type: integer
 *                 description: Current question index
 *               totalTimeSpent:
 *                 type: integer
 *                 description: Total time spent in seconds
 *               status:
 *                 type: string
 *                 enum: [active, paused, completed, abandoned]
 *                 description: Quiz session status
 *               answers:
 *                 type: array
 *                 description: Batch answer submissions (optimization to reduce API calls)
 *                 items:
 *                   type: object
 *                   required:
 *                     - questionId
 *                     - selectedAnswerId
 *                     - timeSpent
 *                     - timestamp
 *                   properties:
 *                     questionId:
 *                       type: string
 *                       format: uuid
 *                     selectedAnswerId:
 *                       type: string
 *                       format: uuid
 *                     timeSpent:
 *                       type: integer
 *                     timestamp:
 *                       type: integer
 *                       description: Unix timestamp in milliseconds
 *     responses:
 *       200:
 *         description: Quiz session updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - user can only update own quiz sessions
 *       404:
 *         description: Quiz session not found
 *       500:
 *         description: Internal server error
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check if user is authenticated
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    // Parse request body
    const updates = await parseBody(request, quizSessionPatchSchema);
    if (updates instanceof NextResponse) return updates;

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
        log.debug(
          "[Quiz PATCH] Quiz already completed - accepting answers but not updating session"
        );
        // Continue to answer submission below, but skip session update
      } else {
        log.debug("[Quiz PATCH] Attempted to update completed quiz - blocking update");
        return NextResponse.json({
          success: true,
          message: "Quiz is already completed - no updates allowed",
        });
      }
    }

    // OPTIMIZATION: Submit answers if provided (eliminates separate batch call!)
    if (updates.answers && updates.answers.length > 0) {
      log.debug(`[Quiz PATCH] Submitting ${updates.answers.length} answers during progress update`);

      const attemptData = updates.answers.map((answer) => ({
        quiz_session_id: id,
        question_id: answer.questionId,
        selected_answer_id: answer.selectedAnswerId,
        time_spent: answer.timeSpent || 0,
        attempted_at: new Date(answer.timestamp).toISOString(),
      }));

      // Upsert with ignoreDuplicates so a concurrent PATCH or /complete POST carrying
      // the same answer can't race this insert and trip the unique_session_question
      // constraint. The previous SELECT-then-filter dedup was TOCTOU under concurrent
      // requests. Fail the request if this errors — silently swallowing caused
      // score=0 quizzes for ~30 days when a downstream trigger broke.
      const { error: insertError } = await supabase.from("quiz_attempts").upsert(attemptData, {
        onConflict: "quiz_session_id,question_id",
        ignoreDuplicates: true,
      });

      if (insertError) {
        log.error("[Quiz PATCH] Error inserting answers:", insertError);
        return NextResponse.json(
          {
            error: "Failed to record quiz answers",
            code: insertError.code,
            details: insertError.message,
          },
          { status: 500 }
        );
      }
      log.debug(`[Quiz PATCH] Upserted ${attemptData.length} answers`);

      // If quiz was already completed and we just submitted answers, return success
      if (existingSession.status === "completed") {
        return NextResponse.json({
          success: true,
          message: "Answers recorded (quiz already completed)",
        });
      }
    }

    // Remove answers from updates object before passing to service
    const sessionUpdates = updates as QuizSessionUpdate;

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
    log.error("Error updating quiz session:", error);
    return NextResponse.json({ error: "Failed to update quiz session" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/user/quiz/sessions/{id}:
 *   delete:
 *     summary: Delete quiz session
 *     description: Delete a quiz session and all associated quiz attempts. Users can only delete their own quiz sessions. Requires authentication.
 *     tags:
 *       - User - Quiz
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Quiz session ID
 *     responses:
 *       200:
 *         description: Quiz session deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - user can only delete own quiz sessions
 *       404:
 *         description: Quiz session not found
 *       500:
 *         description: Internal server error
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check if user is authenticated
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

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
    log.error("Error deleting quiz session:", error);
    return NextResponse.json({ error: "Failed to delete quiz session" }, { status: 500 });
  }
}
