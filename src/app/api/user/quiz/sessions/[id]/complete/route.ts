// src/app/api/user/quiz/sessions/[id]/complete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { quizAnalyticsService } from "@/features/user/quiz/services/analytics-service";
import { quizService } from "@/features/user/quiz/services/quiz-service";
import { ActivityGenerator } from "@/shared/services/activity-generator";
import { awardAchievements } from "@/features/user/achievements/services/achievement-service.server";

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
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      console.log(`[Quiz Complete] Submitting ${requestBody.answers.length} final answers`);

      const attemptData = requestBody.answers.map((answer) => ({
        quiz_session_id: id,
        question_id: answer.questionId,
        selected_answer_id: answer.selectedAnswerId,
        time_spent: answer.timeSpent || 0,
        attempted_at: new Date(answer.timestamp).toISOString(),
      }));

      // Check for existing attempts to prevent duplicates
      const questionIds = requestBody.answers.map((a) => a.questionId);
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
          console.error("[Quiz Complete] Error inserting final answers:", insertError);
          // Don't fail completion - answers may have been submitted already
        } else {
          console.log(`[Quiz Complete] Inserted ${newAttemptData.length} final answers`);
        }
      }
    }

    // Complete the quiz using the service
    const result = await quizService.completeQuiz(id, supabase);

    // Validate result has required properties
    if (!result || typeof result.score !== "number" || typeof result.totalQuestions !== "number") {
      console.error("[Quiz Complete] Invalid result from completeQuiz:", result);
      throw new Error("Invalid quiz completion result");
    }

    // Update analytics for all questions in this quiz session (batch update)
    try {
      console.log("[Quiz Complete] Starting batch analytics update for session:", id);
      await quizAnalyticsService.updateQuizSessionAnalytics(id);
      console.log("[Quiz Complete] Batch analytics update completed successfully");
    } catch (analyticsError) {
      // Don't fail the quiz completion if analytics update fails
      console.error("[Quiz Complete] Failed to update analytics:", analyticsError);
    }

    // Generate activity for quiz completion
    try {
      const activityData = ActivityGenerator.createQuizCompletedActivity({
        id: id,
        title: `Quiz Session`, // We could get the actual quiz title from the session if needed
        score: result.score,
        totalQuestions: result.totalQuestions,
        timeSpent: result.totalTimeSpent || 0,
      });

      await ActivityGenerator.createActivity(userId, activityData);
      console.log("✅ Activity created for quiz completion:", id);
    } catch (activityError) {
      // Don't fail the quiz completion if activity creation fails
      console.error("Failed to create activity for quiz completion:", activityError);
    }

    // Check and award achievements
    let newAchievements = [];
    let metadata = undefined;
    try {
      console.log("[Quiz Complete] Checking for new achievements...");
      const clientAchievementIds = requestBody.achievementIds || [];
      console.log("[Quiz Complete] Client provided achievement IDs:", clientAchievementIds);

      const achievementResult = await awardAchievements(userId, clientAchievementIds);
      newAchievements = achievementResult.newAchievements;
      metadata = achievementResult.metadata;

      if (newAchievements.length > 0) {
        console.log(
          `✅ Awarded ${newAchievements.length} new achievement(s):`,
          newAchievements.map((a) => a.title)
        );
      }
      console.log("[Quiz Complete] Stats metadata for cache validation:", metadata);
    } catch (achievementError) {
      // Don't fail the quiz completion if achievement check fails
      console.error("Failed to check/award achievements:", achievementError);
    }

    return NextResponse.json({
      success: true,
      data: result,
      newAchievements,
      metadata, // Include for client-side cache validation
    });
  } catch (error) {
    console.error("Error completing quiz:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to complete quiz" }, { status: 500 });
  }
}
