// src/features/quiz/services/quiz-service.ts
import { createClient as createSupabaseAdminClient, SupabaseClient } from "@supabase/supabase-js";

// quizService is only used from Next.js server route handlers
// (src/app/api/user/quiz/sessions/**). The two RPCs below are SECURITY DEFINER
// with no `authenticated` EXECUTE grant, so they must be invoked via a
// service-role client — which we can build directly here because we're always
// on the server.
function makeServiceRoleClient() {
  return createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function fetchQuestionSuccessRates(questionIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (questionIds.length === 0) return map;
  const { data, error } = await makeServiceRoleClient().rpc("get_question_success_rates", {
    question_ids: questionIds,
  });
  if (error) {
    console.error("[quiz-service] get_question_success_rates RPC error:", error);
    return map;
  }
  (data as Array<{ question_id: string; success_rate: number }> | null)?.forEach((row) =>
    map.set(row.question_id, row.success_rate)
  );
  return map;
}

import {
  QuizSession,
  QuizAttempt,
  QuizConfig,
  QuizResult,
  QuizCreationForm,
  QuizStatus,
  QUIZ_TIMING_CONFIG,
} from "@/features/user/quiz/types/quiz";
import { QuestionWithDetails } from "@/shared/types/questions";
import { unifiedCache } from "@/shared/services/unified-cache";

// Database row type interfaces
interface QuizSessionRow {
  id: string;
  user_id: string;
  title: string;
  config: unknown;
  question_ids: string[];
  current_question_index: number;
  status: string;
  score: number | null;
  total_questions: number;
  correct_answers: number | null;
  total_time_spent: number | null;
  total_time_limit: number | null;
  time_remaining: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface QuestionRow {
  id: string;
  title: string;
  stem: string;
  teaching_point: string;
  question_references: string;
  difficulty: "easy" | "medium" | "hard";
  category_id: string | null;
  question_set_id: string | null;
  status: string;
  created_by: string;
  updated_by: string;
  version_major: number;
  version_minor: number;
  version_patch: number;
  created_at: string;
  updated_at: string;
  lesson?: string;
  topic?: string;
  question_options?: Array<{
    id: string;
    question_id: string;
    text: string;
    is_correct: boolean;
    explanation: string | null;
    order_index: number;
    created_at: string;
    updated_at: string;
  }>;
  question_images?: Array<{
    question_id: string;
    image_id: string;
    question_section: string;
    order_index: number;
    image?: {
      id: string;
      url: string;
      alt_text: string | null;
      description: string | null;
    };
  }>;
  question_set?: Array<{
    id: string;
    name: string;
    source_type: string;
    short_form: string | null;
  }>;
}

interface QuizAttemptRow {
  id: string;
  quiz_session_id: string;
  question_id: string;
  selected_answer_id: string | null;
  first_answer_id: string | null;
  is_correct: boolean | null;
  time_spent: number;
  attempted_at: string;
  reviewed_at: string | null;
}

interface CategoryIdRow {
  id: string;
}

export class QuizService {
  /**
   * Get parent category IDs with caching
   * Categories rarely change, so cache for 7 days
   */
  private async getCachedCategoryParents(
    categoryName: "Anatomic Pathology" | "Clinical Pathology",
    supabase: SupabaseClient
  ): Promise<string[]> {
    const cacheKey = `quiz-category-${categoryName === "Anatomic Pathology" ? "ap" : "cp"}`;

    // Try cache first
    const cached = unifiedCache.get<{ parentId: string; childIds: string[] }>("swr", cacheKey);
    if (cached) {
      return cached.childIds;
    }

    // Cache miss - query database
    const { data: parentCategory } = await supabase
      .from("categories")
      .select("id")
      .eq("name", categoryName)
      .eq("level", 1)
      .single();

    if (!parentCategory?.id) {
      console.warn(`[Quiz Service] ${categoryName} parent category not found`);
      return [];
    }

    const { data: childCategories } = await supabase
      .from("categories")
      .select("id")
      .eq("parent_id", parentCategory.id);

    const childIds = (childCategories as unknown as CategoryIdRow[])?.map((cat) => cat.id) || [];

    // Cache for 7 days (categories rarely change)
    unifiedCache.set(
      "swr",
      cacheKey,
      { parentId: parentCategory.id, childIds },
      { ttl: 7 * 24 * 60 * 60 * 1000 }
    );

    return childIds;
  }

  /**
   * Create a new quiz session
   */
  async createQuizSession(
    userId: string,
    formData: QuizCreationForm,
    supabaseClient: SupabaseClient
  ): Promise<QuizSession> {
    try {
      // Use authenticated client if provided, otherwise fall back to default

      console.log(`[Quiz Creation] Selecting questions for user ${userId}`, {
        questionType: formData.questionType,
        categorySelection: formData.categorySelection,
        requestedCount: formData.questionCount,
        shuffleQuestions: formData.shuffleQuestions,
      });

      // NEW APPROACH: Use optimized SQL function to get question IDs only
      // This replaces the old getQuestionsForQuiz() which fetched ALL questions
      // Performance: 10MB → 1KB, 1500ms → 50ms

      // Prepare category IDs for SQL function
      let categoryIds: string[] | null = null;
      if (formData.categorySelection === "custom" && formData.selectedCategories.length > 0) {
        categoryIds = formData.selectedCategories;
      } else if (formData.categorySelection === "ap_only") {
        categoryIds = await this.getCachedCategoryParents("Anatomic Pathology", supabaseClient);
      } else if (formData.categorySelection === "cp_only") {
        categoryIds = await this.getCachedCategoryParents("Clinical Pathology", supabaseClient);
      }

      // Call optimized SQL function (filters, randomizes, and limits in database)
      const { data: questionIds, error: selectionError } = await supabaseClient.rpc(
        "select_quiz_questions",
        {
          p_user_id: userId,
          p_category_ids: categoryIds,
          p_question_type: formData.questionType,
          p_limit: formData.questionCount,
          p_randomize: formData.shuffleQuestions,
        }
      );

      if (selectionError) {
        console.error("[Quiz Creation] Error selecting questions:", selectionError);
        throw selectionError;
      }

      if (!questionIds || questionIds.length === 0) {
        throw new Error(
          `No ${formData.questionType} questions found for the selected categories. ` +
            `Try selecting "All Questions" or different categories.`
        );
      }

      console.log(`[Quiz Creation] Selected ${questionIds.length} questions`);

      // Extract question IDs from RPC response
      const selectedQuestionIds = questionIds.map(
        (row: { question_id: string }) => row.question_id
      );

      // Calculate total time limit for timed quizzes
      const totalTimeLimit =
        formData.timing === "timed"
          ? QUIZ_TIMING_CONFIG.timed.calculateTotalTime(selectedQuestionIds.length)
          : undefined;

      // Create quiz session with question IDs only (not full question objects)
      const sessionData = {
        user_id: userId,
        title: formData.title || "Custom Quiz",
        config: {
          mode: formData.mode,
          timing: formData.timing,
          questionCount: formData.questionCount,
          questionType: formData.questionType,
          categorySelection: formData.categorySelection,
          selectedCategories: formData.selectedCategories,
          shuffleQuestions: formData.shuffleQuestions,
          shuffleAnswers: formData.shuffleAnswers,
          showProgress: formData.showProgress,
          showExplanations: formData.mode === "tutor",
          totalTimeLimit,
        },
        question_ids: selectedQuestionIds,
        current_question_index: 0,
        status: "not_started",
        total_questions: selectedQuestionIds.length,
        total_time_limit: totalTimeLimit,
        time_remaining: totalTimeLimit,
      };

      const { data: session, error } = await supabaseClient
        .from("quiz_sessions")
        .insert(sessionData)
        .select()
        .single();

      if (error) {
        console.error("Quiz session creation error:", error);
        throw error;
      }

      const sessionRow = session as unknown as QuizSessionRow;

      // NOTE: We no longer fetch questions here - they will be loaded when the quiz starts
      // This eliminates duplicate fetching and reduces creation response from 50KB to 1KB
      return {
        id: sessionRow.id,
        userId: sessionRow.user_id,
        title: sessionRow.title,
        config: sessionRow.config as QuizConfig,
        questions: [], // Empty - questions loaded on quiz start
        currentQuestionIndex: sessionRow.current_question_index,
        status: sessionRow.status as QuizStatus,
        startedAt: sessionRow.started_at || undefined,
        completedAt: sessionRow.completed_at || undefined,
        totalTimeSpent: sessionRow.total_time_spent || undefined,
        score: sessionRow.score || undefined,
        correctAnswers: sessionRow.correct_answers || undefined,
        totalQuestions: sessionRow.total_questions,
        totalTimeLimit: sessionRow.total_time_limit || undefined,
        timeRemaining: sessionRow.time_remaining || undefined,
        quizStartedAt: sessionRow.started_at || undefined,
        createdAt: sessionRow.created_at,
        updatedAt: sessionRow.updated_at,
      };
    } catch (error) {
      console.error("Error creating quiz session:", error);
      throw error;
    }
  }

  /**
   * Get quiz session by ID
   */
  async getQuizSession(
    sessionId: string,
    supabaseClient: SupabaseClient
  ): Promise<QuizSession | null> {
    try {
      // Use authenticated client if provided, otherwise fall back to default

      const { data: session, error } = await supabaseClient
        .from("quiz_sessions")
        .select(
          "id, user_id, title, config, question_ids, current_question_index, status, score, total_questions, correct_answers, total_time_spent, total_time_limit, time_remaining, started_at, completed_at, created_at, updated_at"
        )
        .eq("id", sessionId)
        .single();

      if (error) {
        console.error("Error getting quiz session:", error);
        throw error;
      }
      if (!session) return null;

      const sessionRow = session as unknown as QuizSessionRow;

      // Get questions for this session
      const questions = await this.getQuestionsForSession(sessionRow.question_ids, supabaseClient);

      // Get quiz attempts (answers) for this session
      const { data: attempts, error: attemptsError } = await supabaseClient
        .from("quiz_attempts")
        .select("question_id, selected_answer_id, is_correct, time_spent, attempted_at")
        .eq("quiz_session_id", sessionId);

      if (attemptsError) {
        console.error("Error fetching quiz attempts:", attemptsError);
      }

      // Transform attempts to the format expected by hybrid system
      const answers =
        attempts?.map((attempt) => ({
          questionId: attempt.question_id,
          selectedOptionId: attempt.selected_answer_id,
          isCorrect: attempt.is_correct,
          timeSpent: attempt.time_spent || 0,
          timestamp: new Date(attempt.attempted_at).getTime(),
        })) || [];

      console.log(
        `[Quiz Service] Fetched ${answers.length} existing answers for session ${sessionId}`
      );

      return {
        id: sessionRow.id,
        userId: sessionRow.user_id,
        title: sessionRow.title,
        config: sessionRow.config as QuizConfig,
        questions,
        currentQuestionIndex: sessionRow.current_question_index,
        status: sessionRow.status as QuizStatus,
        startedAt: sessionRow.started_at,
        completedAt: sessionRow.completed_at,
        totalTimeSpent: sessionRow.total_time_spent,
        score: sessionRow.score,
        correctAnswers: sessionRow.correct_answers,
        totalQuestions: sessionRow.total_questions,
        totalTimeLimit: sessionRow.total_time_limit,
        timeRemaining: sessionRow.time_remaining,
        quizStartedAt: sessionRow.started_at,
        createdAt: sessionRow.created_at,
        updatedAt: sessionRow.updated_at,
        answers, // Include answers in the response
      };
    } catch (error) {
      console.error("Error getting quiz session:", error);
      throw error;
    }
  }

  /**
   * Get questions for a session
   */
  private async getQuestionsForSession(
    questionIds: string[],
    supabaseClient: SupabaseClient
  ): Promise<QuestionWithDetails[]> {
    if (!questionIds || questionIds.length === 0) {
      return [];
    }

    const { data: questions, error } = await supabaseClient
      .from("questions")
      .select(
        `
        id,
        title,
        stem,
        teaching_point,
        question_references,
        difficulty,
        category_id,
        question_set_id,
        status,
        created_by,
        updated_by,
        version_major,
        version_minor,
        version_patch,
        created_at,
        updated_at,
        question_options(id, text, is_correct, explanation, order_index),
        question_images(
          question_section,
          order_index,
          image:images(id, url, alt_text, description)
        ),
        question_set:question_sets(id, name, source_type, short_form)
      `
      )
      .in("id", questionIds);

    if (error) throw error;

    // Maintain the order from questionIds and map to expected format
    const questionMap = new Map(
      ((questions as unknown as QuestionRow[]) || []).map((q) => [q.id, q])
    );
    const orderedQuestions = questionIds
      .map((id) => questionMap.get(id))
      .filter(Boolean) as QuestionRow[];

    // Map to QuestionWithDetails format
    const mappedQuestions = orderedQuestions.map((q) => ({
      ...q,
      question_options: q.question_options || [],
    }));

    return mappedQuestions as unknown as QuestionWithDetails[];
  }

  /**
   * Submit an answer for a question
   */
  async submitAnswer(
    sessionId: string,
    questionId: string,
    selectedAnswerId: string | null,
    timeSpent: number,
    supabaseClient: SupabaseClient,
    firstAnswerId?: string | null
  ): Promise<QuizAttempt> {
    try {
      // Use authenticated client if provided, otherwise fall back to default

      // Validate required parameters
      if (!selectedAnswerId) {
        throw new Error("No answer selected");
      }

      // Create quiz attempt - let database triggers handle is_correct calculation
      // This eliminates race conditions and constraint violations
      const { data: attempt, error } = await supabaseClient
        .from("quiz_attempts")
        .insert({
          quiz_session_id: sessionId,
          question_id: questionId,
          selected_answer_id: selectedAnswerId,
          first_answer_id: firstAnswerId,
          // Don't set is_correct - let the database trigger calculate it
          time_spent: timeSpent,
          attempted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("Database error during quiz attempt insertion:", error);
        throw error;
      }

      const attemptRow = attempt as unknown as QuizAttemptRow;
      return {
        id: attemptRow.id,
        quizSessionId: attemptRow.quiz_session_id,
        questionId: attemptRow.question_id,
        selectedAnswerId: attemptRow.selected_answer_id,
        isCorrect: attemptRow.is_correct ?? false,
        timeSpent: attemptRow.time_spent,
        attemptedAt: attemptRow.attempted_at,
        reviewedAt: attemptRow.reviewed_at,
      };
    } catch (error) {
      console.error("Error submitting answer:", error);
      throw error;
    }
  }

  /**
   * Update quiz session progress
   */
  async updateQuizSession(
    sessionId: string,
    updates: Partial<QuizSession>,
    supabaseClient: SupabaseClient
  ): Promise<void> {
    try {
      let query = supabaseClient
        .from("quiz_sessions")
        .update({
          current_question_index: updates.currentQuestionIndex,
          status: updates.status,
          started_at: updates.startedAt,
          completed_at: updates.completedAt,
          total_time_spent: updates.totalTimeSpent,
          score: updates.score,
          correct_answers: updates.correctAnswers,
          total_time_limit: updates.totalTimeLimit,
          time_remaining: updates.timeRemaining,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      // Atomic guard against the timer-expiry TOCTOU race: when /complete
      // marks a session 'completed', a still-in-flight progress PATCH from
      // the auto-save effect can land afterwards and write status back to
      // 'in_progress' / 'paused' (the PATCH route reads existingSession.status
      // before the /complete commit lands, sees 'in_progress', and proceeds).
      // Refuse the write at the DB level if the row is already terminal —
      // unless this update is itself marking it completed.
      if (updates.status !== "completed") {
        query = query.neq("status", "completed");
      }

      const { error } = await query;

      if (error) throw error;
    } catch (error) {
      console.error("Error updating quiz session:", error);
      throw error;
    }
  }

  /**
   * Start a quiz session
   */
  async startQuizSession(sessionId: string, supabaseClient: SupabaseClient): Promise<void> {
    try {
      const now = new Date().toISOString();
      await this.updateQuizSession(
        sessionId,
        {
          status: "in_progress",
          startedAt: now,
        },
        supabaseClient
      );
    } catch (error) {
      console.error("Error starting quiz session:", error);
      throw error;
    }
  }

  /**
   * Pause a quiz session
   * Note: Status remains 'in_progress' - pause state is tracked locally
   */
  async pauseQuizSession(
    sessionId: string,
    timeRemaining: number,
    supabaseClient: SupabaseClient
  ): Promise<void> {
    try {
      await this.updateQuizSession(
        sessionId,
        {
          timeRemaining, // Save current time remaining when pausing
        },
        supabaseClient
      );
    } catch (error) {
      console.error("Error pausing quiz session:", error);
      throw error;
    }
  }

  /**
   * Resume a quiz session
   */
  async resumeQuizSession(sessionId: string, supabaseClient: SupabaseClient): Promise<void> {
    try {
      await this.updateQuizSession(
        sessionId,
        {
          status: "in_progress",
          startedAt: new Date().toISOString(), // Reset timer reference point for pause/resume
        },
        supabaseClient
      );
    } catch (error) {
      console.error("Error resuming quiz session:", error);
      throw error;
    }
  }

  /**
   * Update time remaining for a quiz session
   */
  async updateTimeRemaining(
    sessionId: string,
    timeRemaining: number,
    supabaseClient: SupabaseClient
  ): Promise<void> {
    try {
      await this.updateQuizSession(
        sessionId,
        {
          timeRemaining,
        },
        supabaseClient
      );
    } catch (error) {
      console.error("Error updating time remaining:", error);
      throw error;
    }
  }

  /**
   * Get quiz results for a completed session
   */
  async getQuizResults(
    sessionId: string,
    supabaseClient: SupabaseClient
  ): Promise<QuizResult | null> {
    try {
      const session = await this.getQuizSession(sessionId, supabaseClient);
      if (!session) return null;

      if (session.status !== "completed") {
        throw new Error("Quiz session is not completed yet");
      }

      const { data: attempts, error: attemptsError } = await supabaseClient
        .from("quiz_attempts")
        .select("*")
        .eq("quiz_session_id", sessionId);
      if (attemptsError) throw attemptsError;

      return this.buildQuizResult(
        sessionId,
        session,
        (attempts as unknown as QuizAttemptRow[]) || [],
        supabaseClient,
        session.completedAt || new Date().toISOString()
      );
    } catch (error) {
      console.error("Error getting quiz results:", error);
      throw error;
    }
  }

  /**
   * Complete a quiz: compute results and persist completion to the session row.
   */
  async completeQuiz(sessionId: string, supabaseClient: SupabaseClient): Promise<QuizResult> {
    try {
      const [{ data: attempts, error: attemptsError }, session] = await Promise.all([
        supabaseClient.from("quiz_attempts").select("*").eq("quiz_session_id", sessionId),
        this.getQuizSession(sessionId, supabaseClient),
      ]);
      if (attemptsError) throw attemptsError;
      if (!session) throw new Error("Quiz session not found");

      const attemptsData = (attempts as unknown as QuizAttemptRow[]) || [];
      const completedAt = new Date().toISOString();

      const result = await this.buildQuizResult(
        sessionId,
        session,
        attemptsData,
        supabaseClient,
        completedAt
      );

      await this.updateQuizSession(
        sessionId,
        {
          status: "completed",
          completedAt,
          totalTimeSpent: result.totalTimeSpent,
          score: result.score,
          correctAnswers: result.correctAnswers,
        },
        supabaseClient
      );

      return result;
    } catch (error) {
      console.error("Error completing quiz:", error);
      throw error;
    }
  }

  /**
   * Build a QuizResult from a session + its attempt rows. Shared between
   * `getQuizResults` (which expects an already-completed session) and
   * `completeQuiz` (which then persists the completion). Pulls categories,
   * cross-user success rates, difficulty breakdown, and per-category stats.
   */
  private async buildQuizResult(
    sessionId: string,
    session: QuizSession,
    attemptsData: QuizAttemptRow[],
    supabaseClient: SupabaseClient,
    completedAt: string
  ): Promise<QuizResult> {
    const correctAnswers = attemptsData.filter((a) => a.is_correct).length;
    const totalQuestions = session.totalQuestions;
    const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

    const totalTimeSpent = attemptsData.reduce((sum, a) => sum + (a.time_spent || 0), 0);
    const averageTimePerQuestion =
      totalQuestions > 0 ? Math.round(totalTimeSpent / totalQuestions) : 0;

    const difficultyBreakdown = {
      easy: { correct: 0, total: 0 },
      medium: { correct: 0, total: 0 },
      hard: { correct: 0, total: 0 },
    };

    // Fetch category metadata (with parent short_forms) in one RPC.
    const categoryIds = [...new Set(session.questions.map((q) => q.category_id).filter(Boolean))];
    const { data: categories, error: categoriesError } = await supabaseClient.rpc(
      "get_categories_with_parents",
      { category_ids: categoryIds }
    );
    if (categoriesError) {
      console.error("[Quiz Results] Error fetching categories:", categoriesError);
    }
    const categoryInfoMap = new Map(
      (
        categories as unknown as Array<{
          id: string;
          name: string;
          short_form: string | null;
          color: string | null;
          parent_id: string | null;
          parent_short_form: string | null;
        }>
      )?.map((c) => [
        c.id,
        {
          name: c.name,
          shortForm: c.short_form,
          color: c.color,
          parentShortForm: c.parent_short_form,
        },
      ]) || []
    );

    // Difficulty tally. Skip questions whose difficulty isn't one of the three
    // canonical values rather than coercing them — the data should always be
    // valid, and a forced default would silently distort the breakdown.
    session.questions.forEach((question) => {
      const d = question.difficulty;
      if (d !== "easy" && d !== "medium" && d !== "hard") return;
      const attempt = attemptsData.find((a) => a.question_id === question.id);
      difficultyBreakdown[d].total++;
      if (attempt?.is_correct) difficultyBreakdown[d].correct++;
    });

    // Per-question social-proof success rates (cross-user aggregate via service-role RPC).
    const questionIds = session.questions.map((q) => q.id);
    const successRateMap = await fetchQuestionSuccessRates(questionIds);

    const questionDetails = session.questions.map((question) => {
      const attempt = attemptsData.find((a) => a.question_id === question.id);
      const categoryInfo = categoryInfoMap.get(question.category_id || "");
      return {
        id: question.id,
        title: question.title,
        stem: question.stem,
        difficulty: question.difficulty,
        category: categoryInfo?.name || "Unknown",
        isCorrect: attempt?.is_correct || false,
        selectedAnswerId: attempt?.selected_answer_id || null,
        timeSpent: attempt?.time_spent || 0,
        successRate: successRateMap.get(question.id) || 0,
      };
    });

    // Per-category aggregate (built from questionDetails so isCorrect/timeSpent
    // already align with the per-question view).
    const categoryMap = new Map<
      string,
      {
        name: string;
        shortForm?: string;
        color?: string;
        parentShortForm?: string;
        correct: number;
        total: number;
        totalTime: number;
      }
    >();
    session.questions.forEach((question) => {
      if (!question.category_id) return;
      const detail = questionDetails.find((qd) => qd.id === question.id);
      if (!detail) return;
      if (!categoryMap.has(question.category_id)) {
        const info = categoryInfoMap.get(question.category_id);
        categoryMap.set(question.category_id, {
          name: info?.name || "Unknown Category",
          shortForm: info?.shortForm,
          color: info?.color,
          parentShortForm: info?.parentShortForm,
          correct: 0,
          total: 0,
          totalTime: 0,
        });
      }
      const stats = categoryMap.get(question.category_id)!;
      stats.total++;
      if (detail.isCorrect) stats.correct++;
      stats.totalTime += detail.timeSpent;
    });
    const categoryBreakdown = Array.from(categoryMap.entries()).map(([categoryId, stats]) => ({
      categoryId,
      categoryName: stats.name,
      categoryShortForm: stats.shortForm,
      categoryColor: stats.color,
      parentShortForm: stats.parentShortForm,
      correct: stats.correct,
      total: stats.total,
      totalTime: stats.totalTime,
      averageTime: stats.total > 0 ? Math.round(stats.totalTime / stats.total) : 0,
    }));

    return {
      sessionId,
      score,
      correctAnswers,
      totalQuestions,
      totalTimeSpent,
      averageTimePerQuestion,
      difficultyBreakdown,
      categoryBreakdown,
      questionDetails,
      attempts: attemptsData.map((a) => ({
        id: a.id,
        quizSessionId: a.quiz_session_id,
        questionId: a.question_id,
        selectedAnswerId: a.selected_answer_id,
        isCorrect: a.is_correct ?? false,
        timeSpent: a.time_spent,
        attemptedAt: a.attempted_at,
        reviewedAt: a.reviewed_at,
      })),
      completedAt,
    };
  }
}

export const quizService = new QuizService();
