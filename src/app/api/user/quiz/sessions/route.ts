// src/app/api/user/quiz/sessions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { QuizCreationForm } from "@/features/user/quiz/types/quiz";
import { quizService } from "@/features/user/quiz/services/quiz-service";
import { TABLE_NAMES } from "@/shared/types/database";
import { devLog } from "@/shared/utils/logging/dev-logger";

/**
 * @swagger
 * /api/user/quiz/sessions:
 *   post:
 *     summary: Create a new quiz session
 *     description: Create a new quiz session with specified configuration. Requires authentication.
 *     tags:
 *       - User - Quiz
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - mode
 *               - questionCount
 *             properties:
 *               title:
 *                 type: string
 *                 description: Title for the quiz session
 *               mode:
 *                 type: string
 *                 enum: [study, exam, timed]
 *                 description: Quiz mode
 *               questionCount:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 description: Number of questions to include
 *               categorySelection:
 *                 type: string
 *                 enum: [all, custom]
 *                 description: Category selection mode
 *               selectedCategories:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of category IDs (required when categorySelection is 'custom')
 *     responses:
 *       200:
 *         description: Quiz session created successfully
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
 *                     sessionId:
 *                       type: string
 *                       format: uuid
 *                     title:
 *                       type: string
 *                     questionCount:
 *                       type: integer
 *                     mode:
 *                       type: string
 *       400:
 *         description: Bad request - missing required fields or invalid data
 *       401:
 *         description: Unauthorized - missing authentication
 *       500:
 *         description: Internal server error
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get("x-request-id") || "unknown";

  try {
    devLog.info("Creating quiz session", { requestId });

    const supabase = await createClient();

    // Auth is now handled by middleware - get user info from headers
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      devLog.warn("Quiz session creation - unauthorized", { requestId });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const formData: QuizCreationForm = await request.json();
    devLog.debug("Quiz form data parsed", {
      requestId,
      userId,
      mode: formData.mode,
      questionCount: formData.questionCount,
      categorySelection: formData.categorySelection,
    });

    // Validate required fields
    if (!formData.title || !formData.mode || !formData.questionCount) {
      devLog.warn("Quiz validation failed - missing fields", { requestId, userId });
      return NextResponse.json(
        { error: "Missing required fields: title, mode, questionCount" },
        { status: 400 }
      );
    }

    // Validate question count
    if (formData.questionCount < 1 || formData.questionCount > 100) {
      devLog.warn("Quiz validation failed - invalid question count", {
        requestId,
        userId,
        questionCount: formData.questionCount,
      });
      return NextResponse.json(
        { error: "Question count must be between 1 and 100" },
        { status: 400 }
      );
    }

    // Validate that at least one source is selected
    if (formData.categorySelection === "custom" && formData.selectedCategories.length === 0) {
      devLog.warn("Quiz validation failed - no categories selected", { requestId, userId });
      return NextResponse.json(
        { error: "Please select at least one category when using custom selection" },
        { status: 400 }
      );
    }

    // Create quiz session using the service
    const serviceStart = Date.now();
    const quizSession = await quizService.createQuizSession(userId, formData, supabase);
    const serviceDuration = Date.now() - serviceStart;

    devLog.performance("Quiz session creation", serviceDuration, {
      requestId,
      userId,
      sessionId: quizSession.id,
      questionCount: quizSession.totalQuestions,
    });

    const totalDuration = Date.now() - startTime;
    devLog.info("Quiz session created successfully", {
      requestId,
      userId,
      sessionId: quizSession.id,
      duration: totalDuration,
    });

    return NextResponse.json({
      success: true,
      data: {
        sessionId: quizSession.id,
        title: quizSession.title,
        questionCount: quizSession.totalQuestions,
        mode: quizSession.config.mode,
      },
    });
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    devLog.error("Quiz session creation failed", error);
    devLog.performance("Quiz session creation error", totalDuration, {
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to create quiz session" }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/user/quiz/sessions:
 *   get:
 *     summary: Get user's quiz sessions
 *     description: Retrieve a paginated list of the user's quiz sessions with optional status filtering. Requires authentication.
 *     tags:
 *       - User - Quiz
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, abandoned]
 *         description: Filter sessions by status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of sessions to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of sessions to skip
 *     responses:
 *       200:
 *         description: Quiz sessions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       title:
 *                         type: string
 *                       status:
 *                         type: string
 *                       mode:
 *                         type: string
 *                       totalQuestions:
 *                         type: integer
 *                       score:
 *                         type: number
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       401:
 *         description: Unauthorized - missing authentication
 *       500:
 *         description: Internal server error
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get("x-request-id") || "unknown";

  try {
    devLog.info("Fetching quiz sessions", { requestId });

    const supabase = await createClient();

    // Auth is now handled by middleware
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      devLog.warn("Quiz sessions fetch - unauthorized", { requestId });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");

    devLog.debug("Quiz sessions query params", {
      requestId,
      userId,
      status,
      limit,
      offset,
    });

    // Build query
    let query = supabase
      .from(TABLE_NAMES.QUIZ_SESSIONS)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status if provided
    if (status) {
      query = query.eq("status", status);
    }

    const queryStart = Date.now();
    const { data: sessions, error } = await query;
    const queryDuration = Date.now() - queryStart;

    devLog.database({
      query: `SELECT * FROM ${TABLE_NAMES.QUIZ_SESSIONS} WHERE user_id = $1 ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      duration: queryDuration,
      rows: sessions?.length || 0,
    });

    if (error) {
      devLog.error("Quiz sessions query failed", error);
      throw error;
    }

    // Map database fields to expected format
    const mappedSessions =
      sessions?.map((session) => ({
        id: session.id,
        title: session.title,
        status: session.status,
        mode: session.config?.mode || "unknown",
        difficulty: session.config?.difficulty,
        totalQuestions: session.total_questions,
        score: session.score,
        correctAnswers: session.correct_answers,
        createdAt: session.created_at,
        completedAt: session.completed_at,
        totalTimeSpent: session.total_time_spent,
        currentQuestionIndex: session.current_question_index,
        totalTimeLimit: session.total_time_limit,
        timeRemaining: session.time_remaining,
        isTimedMode: session.config?.timing === "timed",
        config: session.config,
      })) || [];

    const totalDuration = Date.now() - startTime;
    devLog.info("Quiz sessions fetched successfully", {
      requestId,
      userId,
      count: mappedSessions.length,
      duration: totalDuration,
    });

    return NextResponse.json({
      success: true,
      data: mappedSessions,
      pagination: {
        limit,
        offset,
        total: sessions?.length || 0,
      },
    });
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    devLog.error("Failed to fetch quiz sessions", error);
    devLog.performance("Quiz sessions fetch error", totalDuration, {
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json({ error: "Failed to fetch quiz sessions" }, { status: 500 });
  }
}
