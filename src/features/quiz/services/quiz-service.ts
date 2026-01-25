// src/features/quiz/services/quiz-service.ts
import { createClient } from "@/shared/services/client";
import {
  QuizSession,
  QuizAttempt,
  QuizConfig,
  QuizResult,
  QuizStats,
  QuizCreationForm,
  QuizSessionData as _QuizSessionData,
  QUIZ_TIMING_CONFIG,
} from "@/features/quiz/types/quiz";
import { QuestionWithDetails } from "@/features/questions/types/questions";

export class QuizService {
  private getSupabase() {
    return createClient();
  }

  /**
   * Create a new quiz session
   */
  async createQuizSession(
    userId: string,
    formData: QuizCreationForm,
    authenticatedSupabase?: unknown
  ): Promise<QuizSession> {
    try {
      // Use authenticated client if provided, otherwise fall back to default
      const supabaseClient = authenticatedSupabase || this.getSupabase();

      // First, get questions based on the criteria
      const questions = await this.getQuestionsForQuiz(userId, formData, supabaseClient);

      if (questions.length === 0) {
        throw new Error(
          `No ${formData.questionType} questions found for the selected categories. ` +
            `Try selecting "All Questions" or different categories.`
        );
      }

      // Validate that we have enough questions
      if (questions.length < formData.questionCount) {
        console.warn(
          `Only ${questions.length} questions available, but ${formData.questionCount} requested`
        );
      }

      // Shuffle questions if requested
      const finalQuestions = formData.shuffleQuestions
        ? this.shuffleArray([...questions])
        : questions;

      // Limit to requested count
      const limitedQuestions = finalQuestions.slice(0, formData.questionCount);

      // Calculate total time limit for timed quizzes
      const totalTimeLimit =
        formData.timing === "timed"
          ? QUIZ_TIMING_CONFIG.timed.calculateTotalTime(limitedQuestions.length)
          : undefined;

      // Create quiz session
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
        question_ids: limitedQuestions.map((q) => q.id),
        current_question_index: 0,
        status: "not_started",
        total_questions: limitedQuestions.length,
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

      return {
        ...session,
        questions: limitedQuestions,
        userId: session.user_id,
        config: session.config as QuizConfig,
        currentQuestionIndex: session.current_question_index,
        totalQuestions: session.total_questions,
        totalTimeLimit: session.total_time_limit,
        timeRemaining: session.time_remaining,
        quizStartedAt: session.started_at,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
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
    supabaseClient?: unknown
  ): Promise<QuestionWithDetails[]> {
    const supabase = supabaseClient || this.getSupabase();

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
        version,
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
    const uniqueQuestionsMap = new Map();
    for (const question of questions || []) {
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
      // Get AP subcategory IDs
      const { data: apCategories } = await supabase
        .from("categories")
        .select("id")
        .eq(
          "parent_id",
          (
            await supabase
              .from("categories")
              .select("id")
              .eq("name", "Anatomic Pathology")
              .eq("level", 1)
              .single()
          ).data?.id
        );

      if (apCategories && apCategories.length > 0) {
        const apCategoryIds = apCategories.map((cat) => cat.id);
        filteredQuestions = filteredQuestions.filter(
          (q) => q.category_id && apCategoryIds.includes(q.category_id)
        );
      }
    } else if (formData.categorySelection === "cp_only") {
      // Get CP subcategory IDs
      const { data: cpCategories } = await supabase
        .from("categories")
        .select("id")
        .eq(
          "parent_id",
          (
            await supabase
              .from("categories")
              .select("id")
              .eq("name", "Clinical Pathology")
              .eq("level", 1)
              .single()
          ).data?.id
        );

      if (cpCategories && cpCategories.length > 0) {
        const cpCategoryIds = cpCategories.map((cat) => cat.id);
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
    const questionsWithDetails: QuestionWithDetails[] = filteredQuestions.map((q) => ({
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
    }));

    return questionsWithDetails;
  }

  /**
   * Filter questions by type (unused, needsReview, marked, mastered)
   */
  private async filterByQuestionType(
    userId: string,
    questions: unknown[],
    questionType: "unused" | "needsReview" | "marked" | "mastered",
    supabase: unknown
  ): Promise<unknown[]> {
    // Get user's quiz attempts
    const { data: userAttempts } = await supabase
      .from("quiz_attempts")
      .select("question_id, is_correct")
      .eq("user_id", userId);

    // Get user's favorites (marked questions)
    const { data: userFavorites } = await supabase
      .from("user_favorites")
      .select("question_id")
      .eq("user_id", userId);

    // Build sets for efficient lookup
    const attemptedQuestionIds = new Set(userAttempts?.map((a) => a.question_id) || []);
    const favoriteQuestionIds = new Set(userFavorites?.map((f) => f.question_id) || []);

    // Track questions by status
    const incorrectQuestionIds = new Set<string>();
    const masteredQuestionIds = new Set<string>();

    // Group attempts by question to determine status
    const questionAttemptMap = new Map<string, { correct: number; incorrect: number }>();
    for (const attempt of userAttempts || []) {
      if (!questionAttemptMap.has(attempt.question_id)) {
        questionAttemptMap.set(attempt.question_id, { correct: 0, incorrect: 0 });
      }
      const counts = questionAttemptMap.get(attempt.question_id)!;
      if (attempt.is_correct) {
        counts.correct++;
      } else {
        counts.incorrect++;
      }
    }

    // Classify questions
    for (const [questionId, counts] of questionAttemptMap.entries()) {
      if (counts.incorrect > 0) {
        // Has at least one incorrect attempt
        incorrectQuestionIds.add(questionId);
      } else if (counts.correct > 0) {
        // Has only correct attempts (no incorrect)
        masteredQuestionIds.add(questionId);
      }
    }

    console.log(`[Quiz Creation] Question type stats:`, {
      attempted: attemptedQuestionIds.size,
      favorites: favoriteQuestionIds.size,
      needsReview: incorrectQuestionIds.size,
      mastered: masteredQuestionIds.size,
    });

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
    authenticatedSupabase?: unknown
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

      // Get questions for this session
      const questions = await this.getQuestionsForSession(session.question_ids, supabaseClient);

      return {
        id: session.id,
        userId: session.user_id,
        title: session.title,
        config: session.config as QuizConfig,
        questions,
        currentQuestionIndex: session.current_question_index,
        status: session.status,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        totalTimeSpent: session.total_time_spent,
        score: session.score,
        correctAnswers: session.correct_answers,
        totalQuestions: session.total_questions,
        totalTimeLimit: session.total_time_limit,
        timeRemaining: session.time_remaining,
        quizStartedAt: session.started_at,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
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
    authenticatedSupabase?: unknown
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
        version,
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
    const questionMap = new Map(questions?.map((q: unknown) => [q.id, q]) || []);
    const orderedQuestions = questionIds
      .map((id) => questionMap.get(id))
      .filter(Boolean) as unknown[];

    // Map to QuestionWithDetails format
    const mappedQuestions = orderedQuestions.map((q) => ({
      ...q,
      question_options: q.question_options || [],
    }));

    return mappedQuestions;
  }

  /**
   * Submit an answer for a question
   */
  async submitAnswer(
    sessionId: string,
    questionId: string,
    selectedAnswerId: string | null,
    timeSpent: number,
    authenticatedSupabase?: unknown,
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

      return {
        ...attempt,
        quizSessionId: attempt.quiz_session_id,
        questionId: attempt.question_id,
        selectedAnswerId: attempt.selected_answer_id,
        isCorrect: attempt.is_correct,
        timeSpent: attempt.time_spent,
        attemptedAt: attempt.attempted_at,
        reviewedAt: attempt.reviewed_at,
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
    authenticatedSupabase?: unknown
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
  async startQuizSession(sessionId: string, authenticatedSupabase?: unknown): Promise<void> {
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
    authenticatedSupabase?: unknown
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
  async resumeQuizSession(sessionId: string, authenticatedSupabase?: unknown): Promise<void> {
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
    authenticatedSupabase?: unknown
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
      // Get quiz session statistics
      const { data: sessions, error: sessionsError } = await this.getSupabase()
        .from("quiz_sessions")
        .select("*")
        .eq("user_id", userId);

      if (sessionsError) throw sessionsError;

      const totalQuizzes = sessions?.length || 0;
      const completedQuizzes = sessions?.filter((s) => s.status === "completed").length || 0;

      // Calculate average score
      const completedSessions =
        sessions?.filter((s) => s.status === "completed" && s.score !== null) || [];
      const averageScore =
        completedSessions.length > 0
          ? Math.round(
              completedSessions.reduce((sum, s) => sum + (s.score || 0), 0) /
                completedSessions.length
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

      const _weeklyQuizzes = completedSessions.filter(
        (s) => new Date(s.completed_at || "") >= weekAgo
      ).length;

      const _weeklyStudyTime = completedSessions
        .filter((s) => new Date(s.completed_at || "") >= weekAgo)
        .reduce((sum, s) => sum + (s.total_time_spent || 0), 0);

      // Get recent quizzes (last 5)
      const _recentQuizzes = completedSessions
        .sort(
          (a, b) =>
            new Date(b.completed_at || "").getTime() - new Date(a.completed_at || "").getTime()
        )
        .slice(0, 5)
        .map((s) => ({
          title: s.title,
          score: s.score || 0,
          completedAt: s.completed_at || "",
        }));

      // Get category performance (simplified - would need to join with questions and categories)
      // For now, return empty array - this would require more complex queries
      const _categoryPerformance: Array<{ categoryName: string; correct: number; total: number }> =
        [];

      return {
        totalQuizzes,
        completedQuizzes,
        averageScore,
        totalTimeSpent: totalStudyTime,
        currentStreak,
        longestStreak: 0, // TODO: Calculate longest streak
        favoriteCategories: [], // TODO: Implement
        recentPerformance: [], // TODO: Implement
        difficultyStats: {
          easy: { attempted: 0, correct: 0, averageScore: 0 },
          medium: { attempted: 0, correct: 0, averageScore: 0 },
          hard: { attempted: 0, correct: 0, averageScore: 0 },
        },
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
    authenticatedSupabase?: unknown
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

      // Calculate results
      const correctAnswers = attempts?.filter((a: unknown) => a.is_correct).length || 0;
      const totalQuestions = session.totalQuestions;
      const score = Math.round((correctAnswers / totalQuestions) * 100);

      // Calculate total time spent from individual attempts (more accurate than session.totalTimeSpent)
      const totalTimeSpent =
        attempts?.reduce((sum: number, a: unknown) => {
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

      // Fetch category names, short forms, and colors
      const { data: categories, error: categoriesError } = await supabaseClient
        .from("categories")
        .select("id, name, short_form, color, parent_id")
        .in("id", categoryIds);

      if (categoriesError) {
        console.error("[Quiz Results] Error fetching categories:", categoriesError);
      }

      // If we have parent IDs, fetch parent short forms separately
      const parentIds = [
        ...new Set(categories?.map((c: unknown) => c.parent_id).filter(Boolean) || []),
      ];
      let parentMap = new Map<string, string>();

      if (parentIds.length > 0) {
        const { data: parents } = await supabaseClient
          .from("categories")
          .select("id, short_form")
          .in("id", parentIds);

        parentMap = new Map(parents?.map((p: unknown) => [p.id, p.short_form]) || []);
      }

      const categoryInfoMap = new Map(
        categories?.map((c: unknown) => [
          c.id,
          {
            name: c.name,
            shortForm: c.short_form,
            color: c.color,
            parentShortForm: c.parent_id ? parentMap.get(c.parent_id) : undefined,
          },
        ]) || []
      );

      session.questions.forEach((question) => {
        const difficulty = question.difficulty as "easy" | "medium" | "hard";
        const attempt = attempts?.find((a: unknown) => a.question_id === question.id);

        // Only count if difficulty is valid
        if (difficulty && difficultyBreakdown[difficulty]) {
          difficultyBreakdown[difficulty].total++;
          if (attempt?.is_correct) {
            difficultyBreakdown[difficulty].correct++;
          }
        }
      });

      // Get all success rates in a single batched query
      const questionIds = session.questions.map((q) => q.id);
      const { data: allQuestionAttempts } = await supabaseClient
        .from("quiz_attempts")
        .select("question_id, is_correct")
        .in("question_id", questionIds);

      // Calculate success rates for all questions
      const successRateMap = new Map<string, number>();
      questionIds.forEach((questionId) => {
        const questionAttempts =
          allQuestionAttempts?.filter((a: unknown) => a.question_id === questionId) || [];
        const totalAttempts = questionAttempts.length;
        const correctAttempts = questionAttempts.filter((a: unknown) => a.is_correct).length;
        const successRate =
          totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
        successRateMap.set(questionId, successRate);
      });

      // Get detailed question information for review
      const questionDetails = session.questions.map((question) => {
        const attempt = attempts?.find((a: unknown) => a.question_id === question.id);

        const timeSpent = attempt?.time_spent || 0;

        return {
          id: question.id,
          title: question.title,
          stem: question.stem,
          difficulty: question.difficulty,
          category: categoryInfoMap.get(question.category_id || "")?.name || "Unknown",
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
          attempts?.map((a: unknown) => ({
            ...a,
            quizSessionId: a.quiz_session_id,
            questionId: a.question_id,
            selectedAnswerId: a.selected_answer_id,
            isCorrect: a.is_correct,
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
  async completeQuiz(sessionId: string, authenticatedSupabase?: unknown): Promise<QuizResult> {
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

      // Calculate results
      const correctAnswers = attempts?.filter((a: unknown) => a.is_correct).length || 0;
      const totalQuestions = session.totalQuestions;
      const score = Math.round((correctAnswers / totalQuestions) * 100);
      // Calculate total time spent
      const totalTimeSpent =
        attempts?.reduce((sum: number, a: unknown) => {
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

      session.questions.forEach((question) => {
        // Ensure difficulty is one of the expected values, default to 'medium' if not
        const difficulty =
          question.difficulty === "easy" ||
          question.difficulty === "medium" ||
          question.difficulty === "hard"
            ? question.difficulty
            : "medium";

        const attempt = attempts?.find((a: unknown) => a.question_id === question.id);

        difficultyBreakdown[difficulty].total++;
        if (attempt?.is_correct) {
          difficultyBreakdown[difficulty].correct++;
        }
      });

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

      // Refresh user statistics after quiz completion for better performance
      try {
        const { data: session } = await supabaseClient
          .from("quiz_sessions")
          .select("user_id")
          .eq("id", sessionId)
          .single();

        if (session?.user_id) {
          await supabaseClient.rpc("refresh_user_category_stats", {
            p_user_id: session.user_id,
          });
          console.log("User statistics refreshed after quiz completion");
        }
      } catch (statsError) {
        console.warn("Failed to refresh user statistics:", statsError);
        // Don't fail the quiz completion if stats refresh fails
      }

      return {
        sessionId,
        score,
        correctAnswers,
        totalQuestions,
        totalTimeSpent,
        averageTimePerQuestion,
        difficultyBreakdown,
        categoryBreakdown: [], // TODO: Implement category breakdown
        questionDetails: [], // TODO: Implement question details
        attempts:
          attempts?.map((a: unknown) => ({
            ...a,
            quizSessionId: a.quiz_session_id,
            questionId: a.question_id,
            selectedAnswerId: a.selected_answer_id,
            isCorrect: a.is_correct,
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
