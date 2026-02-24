// src/features/quiz/services/quiz-service.ts
import { createClient } from "@/shared/services/client";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  QuizSession,
  QuizAttempt,
  QuizConfig,
  QuizResult,
  QuizStats,
  QuizCreationForm,
  QuizStatus,
  QUIZ_TIMING_CONFIG,
} from "@/features/user/quiz/types/quiz";
import { QuestionWithDetails } from "@/shared/types/questions";
import { unifiedCache } from "@/shared/services/unified-cache";

// Database row type interfaces
interface RecentAttempt {
  question_id: string;
  most_recent_correct: boolean | null;
  second_recent_correct: boolean | null;
  total_attempts: number;
}

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

interface UserFavoriteRow {
  question_id: string;
}

export class QuizService {
  private getSupabase(): SupabaseClient {
    return createClient() as SupabaseClient;
  }

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
    authenticatedSupabase?: SupabaseClient
  ): Promise<QuizSession> {
    try {
      // Use authenticated client if provided, otherwise fall back to default
      const supabaseClient = authenticatedSupabase || this.getSupabase();

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
   * Get questions for quiz based on criteria
   * Now includes question type filtering (unused, needsReview, marked, mastered)
   */
  private async getQuestionsForQuiz(
    userId: string,
    formData: QuizCreationForm,
    supabaseClient: SupabaseClient
  ): Promise<QuestionWithDetails[]> {
    const supabase = supabaseClient;

    console.log(`[Quiz Creation] Starting question selection for user ${userId}`, {
      questionType: formData.questionType,
      categorySelection: formData.categorySelection,
      requestedCount: formData.questionCount,
    });

    // Query with proper joins to load images and options - SELECT only needed fields
    const query = supabase
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
      .eq("status", "published");

    const { data: questions, error } = await query;

    if (error) {
      console.error("Error fetching questions:", error);
      throw error;
    }

    // Deduplicate questions by ID (in case joins produce duplicates)
    const uniqueQuestionsMap = new Map<string, QuestionRow>();
    for (const question of (questions as unknown as QuestionRow[]) || []) {
      if (!uniqueQuestionsMap.has(question.id)) {
        uniqueQuestionsMap.set(question.id, question);
      } else {
        console.warn(`[Quiz Creation] Duplicate question detected and removed: ${question.id}`);
      }
    }
    let filteredQuestions = Array.from(uniqueQuestionsMap.values());

    console.log(`[Quiz Creation] Total published questions: ${filteredQuestions.length}`);

    // Filter by category selection
    if (formData.categorySelection === "ap_only") {
      // Get AP subcategory IDs (cached)
      const apCategoryIds = await this.getCachedCategoryParents("Anatomic Pathology", supabase);

      if (apCategoryIds.length > 0) {
        filteredQuestions = filteredQuestions.filter(
          (q) => q.category_id && apCategoryIds.includes(q.category_id)
        );
      }
    } else if (formData.categorySelection === "cp_only") {
      // Get CP subcategory IDs (cached)
      const cpCategoryIds = await this.getCachedCategoryParents("Clinical Pathology", supabase);

      if (cpCategoryIds.length > 0) {
        filteredQuestions = filteredQuestions.filter(
          (q) => q.category_id && cpCategoryIds.includes(q.category_id)
        );
      }
    } else if (formData.categorySelection === "custom" && formData.selectedCategories.length > 0) {
      filteredQuestions = filteredQuestions.filter(
        (q) => q.category_id && formData.selectedCategories.includes(q.category_id)
      );
    }

    console.log(`[Quiz Creation] After category filter: ${filteredQuestions.length} questions`);

    // Filter by question type (unused, needsReview, marked, mastered)
    if (formData.questionType !== "all") {
      filteredQuestions = await this.filterByQuestionType(
        userId,
        filteredQuestions,
        formData.questionType,
        supabase
      );
      console.log(
        `[Quiz Creation] After ${formData.questionType} filter: ${filteredQuestions.length} questions`
      );
    }

    // Convert to QuestionWithDetails format with loaded data
    const questionsWithDetails = filteredQuestions.map((q) => ({
      ...q,
      question_options: q.question_options || [],
      question_images: q.question_images || [],
      question_set: Array.isArray(q.question_set) ? q.question_set[0] : q.question_set,
      categories: undefined, // Not loaded in this query
      tags: undefined, // Not loaded in this query
      analytics: undefined,
      created_by_name: undefined,
      updated_by_name: undefined,
      image_count: q.question_images?.length || 0,
      latest_flag_date: undefined,
      reviewer_id: undefined,
      reviewer_feedback: undefined,
      published_at: undefined,
      anki_card_id: undefined,
      anki_deck_name: undefined,
      lesson: q.lesson || undefined,
      topic: q.topic || undefined,
    })) as QuestionWithDetails[];

    return questionsWithDetails;
  }

  /**
   * Filter questions by type (unused, needsReview, marked, mastered)
   */
  private async filterByQuestionType(
    userId: string,
    questions: QuestionRow[],
    questionType: "unused" | "needsReview" | "marked" | "mastered",
    supabase: SupabaseClient
  ): Promise<QuestionRow[]> {
    // Create a set of valid question IDs (only published questions in this category/selection)
    const validQuestionIds = questions.map((q) => q.id);

    // Get user's recent attempts and favorites in parallel
    // Use SQL function for efficiency - only fetches most recent 2 attempts per question
    const [{ data: recentAttempts, error: attemptsError }, { data: userFavorites }] =
      await Promise.all([
        supabase.rpc("get_most_recent_attempts", {
          p_user_id: userId,
          p_question_ids: validQuestionIds,
        }),
        supabase.from("user_favorites").select("question_id").eq("user_id", userId),
      ]);

    if (attemptsError) {
      console.error("[Quiz Creation] Error fetching recent attempts:", attemptsError);
      throw attemptsError;
    }

    // Build sets for efficient lookup
    const attemptedQuestionIds = new Set(
      (recentAttempts as RecentAttempt[])?.map((a) => a.question_id) || []
    );
    const favoriteQuestionIds = new Set(
      (userFavorites as unknown as UserFavoriteRow[])?.map((f) => f.question_id) || []
    );

    // Track questions by status using the SQL function results
    const incorrectQuestionIds = new Set<string>();
    const masteredQuestionIds = new Set<string>();

    // Process SQL function results - already aggregated per question
    for (const attempt of (recentAttempts as RecentAttempt[]) || []) {
      const { question_id, most_recent_correct, second_recent_correct, total_attempts } = attempt;

      // Needs Review: most recent attempt is incorrect
      if (most_recent_correct === false) {
        incorrectQuestionIds.add(question_id);
      }
      // Mastered: last 2 consecutive attempts are correct
      else if (
        most_recent_correct === true &&
        second_recent_correct === true &&
        total_attempts >= 2
      ) {
        masteredQuestionIds.add(question_id);
      }
    }

    // Apply filter based on question type
    switch (questionType) {
      case "unused":
        return questions.filter((q) => !attemptedQuestionIds.has(q.id));

      case "needsReview":
        return questions.filter((q) => incorrectQuestionIds.has(q.id));

      case "marked":
        return questions.filter((q) => favoriteQuestionIds.has(q.id));

      case "mastered":
        return questions.filter((q) => masteredQuestionIds.has(q.id));

      default:
        return questions;
    }
  }

  /**
   * Get quiz session by ID
   */
  async getQuizSession(
    sessionId: string,
    authenticatedSupabase?: SupabaseClient
  ): Promise<QuizSession | null> {
    try {
      // Use authenticated client if provided, otherwise fall back to default
      const supabaseClient = authenticatedSupabase || this.getSupabase();

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
    authenticatedSupabase?: SupabaseClient
  ): Promise<QuestionWithDetails[]> {
    if (!questionIds || questionIds.length === 0) {
      return [];
    }

    const supabaseClient = authenticatedSupabase || this.getSupabase();
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
    authenticatedSupabase?: SupabaseClient,
    firstAnswerId?: string | null
  ): Promise<QuizAttempt> {
    try {
      // Use authenticated client if provided, otherwise fall back to default
      const supabaseClient = authenticatedSupabase || this.getSupabase();

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
    authenticatedSupabase?: SupabaseClient
  ): Promise<void> {
    try {
      // Use authenticated client if provided, otherwise fall back to default
      const supabaseClient = authenticatedSupabase || this.getSupabase();

      const { error } = await supabaseClient
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

      if (error) throw error;
    } catch (error) {
      console.error("Error updating quiz session:", error);
      throw error;
    }
  }

  /**
   * Start a quiz session
   */
  async startQuizSession(sessionId: string, authenticatedSupabase?: SupabaseClient): Promise<void> {
    try {
      const now = new Date().toISOString();
      await this.updateQuizSession(
        sessionId,
        {
          status: "in_progress",
          startedAt: now,
        },
        authenticatedSupabase
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
    authenticatedSupabase?: SupabaseClient
  ): Promise<void> {
    try {
      await this.updateQuizSession(
        sessionId,
        {
          timeRemaining, // Save current time remaining when pausing
        },
        authenticatedSupabase
      );
    } catch (error) {
      console.error("Error pausing quiz session:", error);
      throw error;
    }
  }

  /**
   * Resume a quiz session
   */
  async resumeQuizSession(
    sessionId: string,
    authenticatedSupabase?: SupabaseClient
  ): Promise<void> {
    try {
      await this.updateQuizSession(
        sessionId,
        {
          status: "in_progress",
          startedAt: new Date().toISOString(), // Reset timer reference point for pause/resume
        },
        authenticatedSupabase
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
    authenticatedSupabase?: SupabaseClient
  ): Promise<void> {
    try {
      await this.updateQuizSession(
        sessionId,
        {
          timeRemaining,
        },
        authenticatedSupabase
      );
    } catch (error) {
      console.error("Error updating time remaining:", error);
      throw error;
    }
  }

  /**
   * Get user quiz statistics for performance analytics
   */
  async getUserQuizStats(userId: string): Promise<QuizStats> {
    try {
      // Get quiz session statistics - only select needed columns (80% data reduction)
      const { data: sessions, error: sessionsError } = await this.getSupabase()
        .from("quiz_sessions")
        .select("status, score, total_time_spent, completed_at")
        .eq("user_id", userId);

      if (sessionsError) throw sessionsError;

      const sessionsData = sessions as unknown as Pick<
        QuizSessionRow,
        "status" | "score" | "total_time_spent" | "completed_at"
      >[];
      const totalQuizzes = sessionsData?.length || 0;
      const completedSessions = sessionsData?.filter((s) => s.status === "completed") || [];
      const completedCount = completedSessions.length;

      // Calculate average score
      const completedWithScores = completedSessions.filter((s) => s.score !== null);
      const averageScore =
        completedWithScores.length > 0
          ? Math.round(
              completedWithScores.reduce((sum, s) => sum + (s.score || 0), 0) /
                completedWithScores.length
            )
          : 0;

      // Calculate total study time
      const totalStudyTime = completedSessions.reduce(
        (sum, s) => sum + (s.total_time_spent || 0),
        0
      );

      // Calculate current streak (simplified - just count recent days with completed quizzes)
      const today = new Date();
      const recentDays = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        return date.toDateString();
      });

      let currentStreak = 0;
      for (const day of recentDays) {
        const hasQuizOnDay = completedSessions.some(
          (s) => new Date(s.completed_at || "").toDateString() === day
        );
        if (hasQuizOnDay) {
          currentStreak++;
        } else {
          break;
        }
      }

      // Get weekly stats (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const weeklyQuizzes = completedSessions.filter(
        (s) => new Date(s.completed_at || "") >= weekAgo
      ).length;

      const weeklyStudyTime = completedSessions
        .filter((s) => new Date(s.completed_at || "") >= weekAgo)
        .reduce((sum, s) => sum + (s.total_time_spent || 0), 0);

      // Get recent performance (last 7 days)
      const recentPerformance: Array<{ date: string; score: number; quizCount: number }> = [];
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        const daySessions = completedSessions.filter((s) => {
          const sessionDate = s.completed_at?.split("T")[0];
          return sessionDate === dateStr;
        });

        if (daySessions.length > 0) {
          const dayScore =
            daySessions.reduce((sum, s) => sum + (s.score || 0), 0) / daySessions.length;
          recentPerformance.push({
            date: dayNames[date.getDay()],
            score: Math.round(dayScore),
            quizCount: daySessions.length,
          });
        }
      }

      // Get category performance (simplified - would need to join with questions and categories)
      // For now, return empty array - this would require more complex queries
      const categoryPerformance: Array<{ categoryName: string; correct: number; total: number }> =
        [];

      return {
        totalQuizzes,
        completedQuizzes: completedCount,
        averageScore,
        totalTimeSpent: totalStudyTime,
        currentStreak,
        longestStreak: 0, // TODO: Calculate longest streak
        favoriteCategories: [], // TODO: Implement
        recentPerformance,
        weeklyQuizzes,
        weeklyStudyTime,
        difficultyStats: {
          easy: { attempted: 0, correct: 0, averageScore: 0 },
          medium: { attempted: 0, correct: 0, averageScore: 0 },
          hard: { attempted: 0, correct: 0, averageScore: 0 },
        },
        categoryPerformance,
      };
    } catch (error) {
      console.error("Error getting user quiz stats:", error);
      throw error;
    }
  }

  /**
   * Get quiz results for a completed session
   */
  async getQuizResults(
    sessionId: string,
    authenticatedSupabase?: SupabaseClient
  ): Promise<QuizResult | null> {
    try {
      // Get session details
      const session = await this.getQuizSession(sessionId, authenticatedSupabase);
      if (!session) return null;

      // Check if quiz is completed
      if (session.status !== "completed") {
        throw new Error("Quiz session is not completed yet");
      }

      // Get all attempts for this session
      const supabaseClient = authenticatedSupabase || this.getSupabase();
      const { data: attempts, error: attemptsError } = await supabaseClient
        .from("quiz_attempts")
        .select("*")
        .eq("quiz_session_id", sessionId);

      if (attemptsError) throw attemptsError;

      const attemptsData = attempts as unknown as QuizAttemptRow[];
      const correctAnswers = attemptsData?.filter((a) => a.is_correct).length || 0;
      const totalQuestions = session.totalQuestions;
      const score = Math.round((correctAnswers / totalQuestions) * 100);

      // Calculate total time spent from individual attempts (more accurate than session.totalTimeSpent)
      const totalTimeSpent =
        attemptsData?.reduce((sum: number, a) => {
          const timeSpent = a.time_spent || 0;
          return sum + timeSpent;
        }, 0) || 0;
      const averageTimePerQuestion =
        totalQuestions > 0 ? Math.round(totalTimeSpent / totalQuestions) : 0;

      // Calculate difficulty breakdown
      const difficultyBreakdown = {
        easy: { correct: 0, total: 0 },
        medium: { correct: 0, total: 0 },
        hard: { correct: 0, total: 0 },
      };

      // Get unique category IDs from questions
      const categoryIds = [...new Set(session.questions.map((q) => q.category_id).filter(Boolean))];

      // Fetch categories with parent short_forms in single query (optimized)
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

      session.questions.forEach((question) => {
        const difficulty = question.difficulty as "easy" | "medium" | "hard";
        const attempt = attemptsData?.find((a) => a.question_id === question.id);

        // Only count if difficulty is valid
        if (difficulty && difficultyBreakdown[difficulty]) {
          difficultyBreakdown[difficulty].total++;
          if (attempt?.is_correct) {
            difficultyBreakdown[difficulty].correct++;
          }
        }
      });

      // Get all success rates using optimized database function
      // This reduces data transfer by ~99% and is ~50× faster than JavaScript filtering
      const questionIds = session.questions.map((q) => q.id);
      const { data: successRates } = await supabaseClient.rpc("get_question_success_rates", {
        question_ids: questionIds,
      });

      // Convert to Map for easy lookup (O(N) instead of O(N²))
      const successRateMap = new Map<string, number>();
      (
        successRates as unknown as Array<{
          question_id: string;
          success_rate: number;
          total_attempts: number;
          correct_attempts: number;
        }>
      )?.forEach((row) => {
        successRateMap.set(row.question_id, row.success_rate);
      });

      // Get detailed question information for review
      const questionDetails = session.questions.map((question) => {
        const attempt = attemptsData?.find((a) => a.question_id === question.id);

        const timeSpent = attempt?.time_spent || 0;

        const categoryInfo = categoryInfoMap.get(question.category_id || "");

        return {
          id: question.id,
          title: question.title,
          stem: question.stem,
          difficulty: question.difficulty,
          category: categoryInfo?.name || "Unknown",
          isCorrect: attempt?.is_correct || false,
          selectedAnswerId: attempt?.selected_answer_id || null,
          timeSpent: timeSpent,
          successRate: successRateMap.get(question.id) || 0,
        };
      });

      // Calculate category breakdown using the same approach as questionDetails
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

        const questionDetail = questionDetails.find((qd) => qd.id === question.id);
        if (!questionDetail) return;

        if (!categoryMap.has(question.category_id)) {
          const categoryInfo = categoryInfoMap.get(question.category_id);
          categoryMap.set(question.category_id, {
            name: categoryInfo?.name || "Unknown Category",
            shortForm: categoryInfo?.shortForm,
            color: categoryInfo?.color,
            parentShortForm: categoryInfo?.parentShortForm,
            correct: 0,
            total: 0,
            totalTime: 0,
          });
        }

        const categoryStats = categoryMap.get(question.category_id)!;
        categoryStats.total++;
        if (questionDetail.isCorrect) {
          categoryStats.correct++;
        }
        categoryStats.totalTime += questionDetail.timeSpent;
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
        attempts:
          attemptsData?.map((a) => ({
            id: a.id,
            quizSessionId: a.quiz_session_id,
            questionId: a.question_id,
            selectedAnswerId: a.selected_answer_id,
            isCorrect: a.is_correct ?? false,
            timeSpent: a.time_spent,
            attemptedAt: a.attempted_at,
            reviewedAt: a.reviewed_at,
          })) || [],
        completedAt: session.completedAt || new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error getting quiz results:", error);
      throw error;
    }
  }

  /**
   * Complete a quiz and calculate results
   */
  async completeQuiz(
    sessionId: string,
    authenticatedSupabase?: SupabaseClient
  ): Promise<QuizResult> {
    try {
      // Use authenticated client if provided, otherwise fall back to default
      const supabaseClient = authenticatedSupabase || this.getSupabase();

      // Get all attempts for this session
      const { data: attempts, error: attemptsError } = await supabaseClient
        .from("quiz_attempts")
        .select("*")
        .eq("quiz_session_id", sessionId);

      if (attemptsError) throw attemptsError;

      // Get session details
      const session = await this.getQuizSession(sessionId, authenticatedSupabase);
      if (!session) throw new Error("Quiz session not found");

      const attemptsData = attempts as unknown as QuizAttemptRow[];

      // Calculate results
      const correctAnswers = attemptsData?.filter((a) => a.is_correct).length || 0;
      const totalQuestions = session.totalQuestions;
      const score = Math.round((correctAnswers / totalQuestions) * 100);
      // Calculate total time spent
      const totalTimeSpent =
        attemptsData?.reduce((sum: number, a) => {
          const timeSpent = a.time_spent || 0;
          return sum + timeSpent;
        }, 0) || 0;
      const averageTimePerQuestion = Math.round(totalTimeSpent / totalQuestions);

      // Calculate difficulty breakdown
      const difficultyBreakdown = {
        easy: { correct: 0, total: 0 },
        medium: { correct: 0, total: 0 },
        hard: { correct: 0, total: 0 },
      };

      // Get unique category IDs from questions
      const categoryIds = [...new Set(session.questions.map((q) => q.category_id).filter(Boolean))];

      // Fetch categories with parent short_forms in single query (optimized)
      const { data: categories, error: categoriesError } = await supabaseClient.rpc(
        "get_categories_with_parents",
        { category_ids: categoryIds }
      );

      if (categoriesError) {
        console.error("[Quiz Complete] Error fetching categories:", categoriesError);
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

      session.questions.forEach((question) => {
        // Ensure difficulty is one of the expected values, default to 'medium' if not
        const difficulty =
          question.difficulty === "easy" ||
          question.difficulty === "medium" ||
          question.difficulty === "hard"
            ? question.difficulty
            : "medium";

        const attempt = attemptsData?.find((a) => a.question_id === question.id);

        // Only count if difficulty is valid
        if (difficulty && difficultyBreakdown[difficulty]) {
          difficultyBreakdown[difficulty].total++;
          if (attempt?.is_correct) {
            difficultyBreakdown[difficulty].correct++;
          }
        }
      });

      // Get all success rates using optimized database function
      const questionIds = session.questions.map((q) => q.id);
      const { data: successRates } = await supabaseClient.rpc("get_question_success_rates", {
        question_ids: questionIds,
      });

      // Convert to Map for easy lookup
      const successRateMap = new Map<string, number>();
      (
        successRates as unknown as Array<{
          question_id: string;
          success_rate: number;
          total_attempts: number;
          correct_attempts: number;
        }>
      )?.forEach((row) => {
        successRateMap.set(row.question_id, row.success_rate);
      });

      // Get detailed question information for review
      const questionDetails = session.questions.map((question) => {
        const attempt = attemptsData?.find((a) => a.question_id === question.id);
        const timeSpent = attempt?.time_spent || 0;
        const categoryInfo = categoryInfoMap.get(question.category_id || "");

        return {
          id: question.id,
          title: question.title,
          stem: question.stem,
          difficulty: question.difficulty,
          category: categoryInfo?.name || "Unknown",
          isCorrect: attempt?.is_correct || false,
          selectedAnswerId: attempt?.selected_answer_id || null,
          timeSpent: timeSpent,
          successRate: successRateMap.get(question.id) || 0,
        };
      });

      // Calculate category breakdown
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

        const questionDetail = questionDetails.find((qd) => qd.id === question.id);
        if (!questionDetail) return;

        if (!categoryMap.has(question.category_id)) {
          const categoryInfo = categoryInfoMap.get(question.category_id);
          categoryMap.set(question.category_id, {
            name: categoryInfo?.name || "Unknown Category",
            shortForm: categoryInfo?.shortForm,
            color: categoryInfo?.color,
            parentShortForm: categoryInfo?.parentShortForm,
            correct: 0,
            total: 0,
            totalTime: 0,
          });
        }

        const categoryStats = categoryMap.get(question.category_id)!;
        categoryStats.total++;
        if (questionDetail.isCorrect) {
          categoryStats.correct++;
        }
        categoryStats.totalTime += questionDetail.timeSpent;
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

      // Update session as completed
      await this.updateQuizSession(
        sessionId,
        {
          status: "completed",
          completedAt: new Date().toISOString(),
          totalTimeSpent,
          score,
          correctAnswers,
        },
        authenticatedSupabase
      );

      // Note: Stats refresh moved to completion route for better separation of concerns
      // The completion route now calls refresh_user_stats_incremental() after quiz completion

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
        attempts:
          attemptsData?.map((a) => ({
            id: a.id,
            quizSessionId: a.quiz_session_id,
            questionId: a.question_id,
            selectedAnswerId: a.selected_answer_id,
            isCorrect: a.is_correct ?? false,
            timeSpent: a.time_spent,
            attemptedAt: a.attempted_at,
            reviewedAt: a.reviewed_at,
          })) || [],
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error completing quiz:", error);
      throw error;
    }
  }

  /**
   * Utility function to shuffle array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

export const quizService = new QuizService();
