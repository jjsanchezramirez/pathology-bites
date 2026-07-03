// src/app/api/user/quiz/sessions/[id]/complete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { requireUser } from "@/shared/utils/api/api-guard";
import { quizAnalyticsService } from "@/features/user/quiz/services/analytics-service";
import { quizService } from "@/features/user/quiz/services/quiz-service";
import { awardAchievements } from "@/features/user/achievements/services/achievement-service.server";
import { log } from "@/shared/utils/logging";

interface BatchAnswerSubmission {
  questionId: string;
  selectedAnswerId: string;
  timeSpent: number;
  timestamp: number;
}

interface CompleteQuizRequest {
  answers?: BatchAnswerSubmission[];
  achievementIds?: string[]; // Client-calculated achievement IDs to unlock
}

/**
 * @swagger
 * /api/user/quiz/sessions/{id}/complete:
 *   post:
 *     summary: Complete quiz session
 *     description: Mark a quiz session as completed, calculate final score, update analytics, check achievements, and generate activity. Supports submitting final answers in the same request for optimization. Idempotent - safe to call multiple times. Requires authentication.
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
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               answers:
 *                 type: array
 *                 description: Final answer submissions (optimization to reduce API calls)
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
 *               achievementIds:
 *                 type: array
 *                 description: Client-calculated achievement IDs to check and unlock
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Quiz completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     score:
 *                       type: number
 *                       description: Final quiz score percentage
 *                     totalQuestions:
 *                       type: integer
 *                     correctAnswers:
 *                       type: integer
 *                     totalTimeSpent:
 *                       type: integer
 *                       description: Total time spent in seconds
 *                     completedAt:
 *                       type: string
 *                       format: date-time
 *                 newAchievements:
 *                   type: array
 *                   description: Newly unlocked achievements
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       category:
 *                         type: string
 *                 metadata:
 *                   type: object
 *                   description: Stats metadata for client-side cache validation
 *                 message:
 *                   type: string
 *                   description: Message if quiz was already completed (idempotency)
 *       401:
 *         description: Unauthorized - missing authentication
 *       403:
 *         description: Forbidden - user can only complete own quiz sessions
 *       404:
 *         description: Quiz session not found
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check if user is authenticated
    const auth = requireUser(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    // OPTIMIZATION: Parse request body for optional answers and achievement IDs
    let requestBody: CompleteQuizRequest = {};
    try {
      const text = await request.text();
      if (text) {
        requestBody = JSON.parse(text);
      }
    } catch {
      // Empty body is fine - means no final answers or achievements to submit
    }

    // Verify user owns the quiz session
    const { data: session, error: sessionError } = await supabase
      .from("quiz_sessions")
      .select("user_id, status")
      .eq("id", id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Quiz session not found" }, { status: 404 });
    }

    if (session.user_id !== userId) {
      return NextResponse.json(
        { error: "Forbidden - You can only complete your own quiz sessions" },
        { status: 403 }
      );
    }

    // Check if quiz is already completed - return success for idempotency
    if (session.status === "completed") {
      // Get the existing quiz results
      const existingResults = await quizService.getQuizResults(id, supabase);

      return NextResponse.json({
        success: true,
        data: existingResults,
        message: "Quiz was already completed",
      });
    }

    // OPTIMIZATION: Submit final answers if provided (eliminates separate batch call!)
    if (requestBody.answers && requestBody.answers.length > 0) {
      log.debug(`[Quiz Complete] Submitting ${requestBody.answers.length} final answers`);

      const attemptData = requestBody.answers.map((answer) => ({
        quiz_session_id: id,
        question_id: answer.questionId,
        selected_answer_id: answer.selectedAnswerId,
        time_spent: answer.timeSpent || 0,
        attempted_at: new Date(answer.timestamp).toISOString(),
      }));

      // Upsert with ignoreDuplicates so a still-in-flight PATCH for the same answer
      // can't race this insert and trip the unique_session_question constraint. The
      // previous SELECT-then-filter dedup was TOCTOU under concurrent requests.
      // Fail the request if this errors — silently swallowing caused score=0 quizzes
      // for ~30 days when a downstream trigger broke.
      const { error: insertError } = await supabase.from("quiz_attempts").upsert(attemptData, {
        onConflict: "quiz_session_id,question_id",
        ignoreDuplicates: true,
      });

      if (insertError) {
        log.error("[Quiz Complete] Error inserting final answers:", insertError);
        return NextResponse.json(
          {
            error: "Failed to record quiz answers",
            code: insertError.code,
            details: insertError.message,
          },
          { status: 500 }
        );
      }
      log.debug(`[Quiz Complete] Upserted ${attemptData.length} final answers`);
    }

    // Complete the quiz using the service
    const result = await quizService.completeQuiz(id, supabase);

    // Validate result has required properties
    if (!result || typeof result.score !== "number" || typeof result.totalQuestions !== "number") {
      log.error("[Quiz Complete] Invalid result from completeQuiz:", result);
      throw new Error("Invalid quiz completion result");
    }

    // OPTIMIZATION: Extract question IDs from result to avoid redundant fetch
    const questionIds = result.attempts?.map((attempt) => attempt.questionId) || [];

    // Update analytics for all questions in this quiz session (batch update)
    try {
      log.debug("[Quiz Complete] Starting batch analytics update for session:", id);
      // Pass question IDs to avoid re-fetching them from database
      await quizAnalyticsService.updateQuizSessionAnalytics(id, questionIds);
      log.debug("[Quiz Complete] Batch analytics update completed successfully");
    } catch (analyticsError) {
      // Don't fail the quiz completion if analytics update fails
      log.error("[Quiz Complete] Failed to update analytics:", analyticsError);
    }

    // Note: Activity generation removed - dashboard now gets activities directly
    // from quiz_sessions and user_achievements tables via unified API

    // Check and award achievements
    let newAchievements = [];
    let metadata = undefined;
    try {
      log.debug("[Quiz Complete] Checking for new achievements...");
      const clientAchievementIds = requestBody.achievementIds || [];
      log.debug("[Quiz Complete] Client provided achievement IDs:", clientAchievementIds);

      const achievementResult = await awardAchievements(userId, clientAchievementIds);
      newAchievements = achievementResult.newAchievements;
      metadata = achievementResult.metadata;

      if (newAchievements.length > 0) {
        log.debug(
          `✅ Awarded ${newAchievements.length} new achievement(s):`,
          newAchievements.map((a) => a.title)
        );
      }
      log.debug("[Quiz Complete] Stats metadata for cache validation:", metadata);
    } catch (achievementError) {
      // Don't fail the quiz completion if achievement check fails
      log.error("Failed to check/award achievements:", achievementError);
    }

    return NextResponse.json({
      success: true,
      data: result,
      newAchievements,
      metadata, // Include for client-side cache validation
    });
  } catch (error) {
    log.error("Error completing quiz:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to complete quiz" }, { status: 500 });
  }
}
