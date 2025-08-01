// src/features/quiz/services/quiz-service.ts
import { createClient } from '@/shared/services/client'
import {
  QuizSession,
  QuizAttempt,
  QuizConfig,
  QuizResult,
  QuizStats,
  QuizCreationForm,
  QUIZ_TIMING_CONFIG
} from '@/features/quiz/types/quiz'
import { QuestionWithDetails } from '@/features/questions/types/questions'

export class QuizService {
  private supabase = createClient()

  /**
   * Create a new quiz session
   */
  async createQuizSession(userId: string, formData: QuizCreationForm, authenticatedSupabase?: any): Promise<QuizSession> {
    try {
      // Use authenticated client if provided, otherwise fall back to default
      const supabaseClient = authenticatedSupabase || this.supabase

      // First, get questions based on the criteria
      const questions = await this.getQuestionsForQuiz(formData)
      
      if (questions.length === 0) {
        throw new Error('No questions found matching the specified criteria')
      }

      // Shuffle questions if requested
      const finalQuestions = formData.shuffleQuestions 
        ? this.shuffleArray([...questions])
        : questions

      // Limit to requested count
      const limitedQuestions = finalQuestions.slice(0, formData.questionCount)

      // Calculate total time limit for timed quizzes
      const totalTimeLimit = formData.timing === 'timed'
        ? QUIZ_TIMING_CONFIG.timed.calculateTotalTime(limitedQuestions.length)
        : undefined

      // Create quiz session
      const sessionData = {
        user_id: userId,
        title: formData.title || 'Custom Quiz',
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
          showExplanations: formData.mode === 'tutor',
          timePerQuestion: formData.timing === 'timed' ? 60 : undefined, // kept for backward compatibility
          totalTimeLimit
        },
        questions: limitedQuestions.map(q => q.id),
        current_question_index: 0,
        status: 'not_started',
        total_questions: limitedQuestions.length,
        total_time_limit: totalTimeLimit,
        time_remaining: totalTimeLimit
      }

      console.log('Creating quiz session with data:', sessionData)

      const { data: session, error } = await supabaseClient
        .from('quiz_sessions')
        .insert(sessionData)
        .select()
        .single()

      if (error) {
        console.error('Quiz session creation error:', error)
        throw error
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
        quizStartedAt: session.quiz_started_at,
        createdAt: session.created_at,
        updatedAt: session.updated_at
      }
    } catch (error) {
      console.error('Error creating quiz session:', error)
      throw error
    }
  }

  /**
   * Get questions for quiz based on criteria
   */
  private async getQuestionsForQuiz(formData: QuizCreationForm): Promise<QuestionWithDetails[]> {
    console.log('Getting questions for quiz with criteria:', formData)

    // Query with proper joins to load images and options
    const query = this.supabase
      .from('questions')
      .select(`
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
        version_major,
        version_minor,
        version_patch,
        version_string,
        is_flagged,
        flag_count,
        created_at,
        updated_at,
        search_vector,
        question_options(*),
        question_images(*, image:images(*)),
        question_set:sets(*)
      `)
      .eq('status', 'approved')

    const { data: questions, error } = await query

    if (error) {
      console.error('Error fetching questions:', error)
      throw error
    }

    console.log(`Found ${questions?.length || 0} approved questions`)
    let filteredQuestions = questions || []

    // Filter by category selection
    if (formData.categorySelection === 'ap_only') {
      // Get AP subcategory IDs
      const { data: apCategories } = await this.supabase
        .from('categories')
        .select('id')
        .eq('parent_id', (
          await this.supabase
            .from('categories')
            .select('id')
            .eq('name', 'Anatomic Pathology')
            .eq('level', 1)
            .single()
        ).data?.id)

      if (apCategories && apCategories.length > 0) {
        const apCategoryIds = apCategories.map(cat => cat.id)
        filteredQuestions = filteredQuestions.filter(q =>
          q.category_id && apCategoryIds.includes(q.category_id)
        )
      }
    } else if (formData.categorySelection === 'cp_only') {
      // Get CP subcategory IDs
      const { data: cpCategories } = await this.supabase
        .from('categories')
        .select('id')
        .eq('parent_id', (
          await this.supabase
            .from('categories')
            .select('id')
            .eq('name', 'Clinical Pathology')
            .eq('level', 1)
            .single()
        ).data?.id)

      if (cpCategories && cpCategories.length > 0) {
        const cpCategoryIds = cpCategories.map(cat => cat.id)
        filteredQuestions = filteredQuestions.filter(q =>
          q.category_id && cpCategoryIds.includes(q.category_id)
        )
      }
    } else if (formData.categorySelection === 'custom' && formData.selectedCategories.length > 0) {
      filteredQuestions = filteredQuestions.filter(q =>
        q.category_id && formData.selectedCategories.includes(q.category_id)
      )
    }

    console.log(`After filtering by category selection (${formData.categorySelection}): ${filteredQuestions.length} questions`)

    // TODO: Filter by question type (unused, incorrect, marked, correct)
    // This would require user-specific data about question attempts and flags
    // For now, we'll return all questions matching the category criteria

    // Convert to QuestionWithDetails format with loaded data
    const questionsWithDetails: QuestionWithDetails[] = filteredQuestions.map(q => ({
      ...q,
      question_options: q.question_options || [],
      question_images: q.question_images || [],
      question_set: Array.isArray(q.question_set) ? q.question_set[0] : q.question_set,
      set: Array.isArray(q.question_set) ? q.question_set[0] : q.question_set, // Backward compatibility
      answer_options: q.question_options || [], // Backward compatibility
      categories: undefined, // Not loaded in this query
      tags: undefined, // Not loaded in this query
      analytics: undefined,
      created_by_name: undefined,
      updated_by_name: undefined,
      image_count: q.question_images?.length || 0,
      latest_flag_date: undefined
    }))



    return questionsWithDetails
  }

  /**
   * Get quiz session by ID
   */
  async getQuizSession(sessionId: string, authenticatedSupabase?: any): Promise<QuizSession | null> {
    try {
      // Use authenticated client if provided, otherwise fall back to default
      const supabaseClient = authenticatedSupabase || this.supabase

      console.log('Getting quiz session:', sessionId)

      const { data: session, error } = await supabaseClient
        .from('quiz_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (error) {
        console.error('Error getting quiz session:', error)
        throw error
      }
      if (!session) return null

      // Get questions for this session
      const questions = await this.getQuestionsForSession(session.questions, supabaseClient)

      return {
        ...session,
        questions,
        userId: session.user_id,
        config: session.config as QuizConfig,
        currentQuestionIndex: session.current_question_index,
        totalQuestions: session.total_questions,
        totalTimeLimit: session.total_time_limit,
        timeRemaining: session.time_remaining,
        quizStartedAt: session.quiz_started_at,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        totalTimeSpent: session.total_time_spent,
        score: session.score,
        correctAnswers: session.correct_answers,
        createdAt: session.created_at,
        updatedAt: session.updated_at
      }
    } catch (error) {
      console.error('Error getting quiz session:', error)
      throw error
    }
  }

  /**
   * Get questions for a session
   */
  private async getQuestionsForSession(questionIds: string[], authenticatedSupabase?: any): Promise<QuestionWithDetails[]> {
    const supabaseClient = authenticatedSupabase || this.supabase
    const { data: questions, error } = await supabaseClient
      .from('questions')
      .select(`
        *,
        question_options(*),
        question_images(*, image:images(*)),
        question_set:sets(*)
      `)
      .in('id', questionIds)

    if (error) throw error

    // Maintain the order from questionIds and map to expected format
    const questionMap = new Map(questions?.map((q: any) => [q.id, q]) || [])
    const orderedQuestions = questionIds.map(id => questionMap.get(id)).filter(Boolean) as any[]

    // Map to QuestionWithDetails format with proper answer_options mapping
    const mappedQuestions = orderedQuestions.map(q => ({
      ...q,
      answer_options: q.question_options || [], // Map question_options to answer_options for backward compatibility
      question_options: q.question_options || []
    }))

    return mappedQuestions
  }

  /**
   * Submit an answer for a question
   */
  async submitAnswer(
    sessionId: string,
    questionId: string,
    selectedAnswerId: string | null,
    timeSpent: number,
    authenticatedSupabase?: any,
    firstAnswerId?: string | null
  ): Promise<QuizAttempt> {
    try {
      // Use authenticated client if provided, otherwise fall back to default
      const supabaseClient = authenticatedSupabase || this.supabase

      // Validate required parameters
      if (!selectedAnswerId) {
        throw new Error('No answer selected')
      }

      console.log('Submitting answer:', { sessionId, questionId, selectedAnswerId, firstAnswerId, timeSpent })

      // Create quiz attempt - let database triggers handle is_correct calculation
      // This eliminates race conditions and constraint violations
      const { data: attempt, error } = await supabaseClient
        .from('quiz_attempts')
        .insert({
          quiz_session_id: sessionId,
          question_id: questionId,
          selected_answer_id: selectedAnswerId,
          first_answer_id: firstAnswerId,
          // Don't set is_correct - let the database trigger calculate it
          time_spent: timeSpent,
          attempted_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Database error during quiz attempt insertion:', error)
        throw error
      }

      console.log('Quiz attempt created successfully:', {
        attemptId: attempt.id,
        isCorrect: attempt.is_correct,
        selectedAnswerId: attempt.selected_answer_id
      })

      return {
        ...attempt,
        quizSessionId: attempt.quiz_session_id,
        questionId: attempt.question_id,
        selectedAnswerId: attempt.selected_answer_id,
        isCorrect: attempt.is_correct,
        timeSpent: attempt.time_spent,
        attemptedAt: attempt.attempted_at,
        reviewedAt: attempt.reviewed_at
      }
    } catch (error) {
      console.error('Error submitting answer:', error)
      throw error
    }
  }

  /**
   * Update quiz session progress
   */
  async updateQuizSession(sessionId: string, updates: Partial<QuizSession>, authenticatedSupabase?: any): Promise<void> {
    try {
      // Use authenticated client if provided, otherwise fall back to default
      const supabaseClient = authenticatedSupabase || this.supabase

      const { error } = await supabaseClient
        .from('quiz_sessions')
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
          quiz_started_at: updates.quizStartedAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)

      if (error) throw error
    } catch (error) {
      console.error('Error updating quiz session:', error)
      throw error
    }
  }

  /**
   * Start a quiz session
   */
  async startQuizSession(sessionId: string, authenticatedSupabase?: any): Promise<void> {
    try {
      const now = new Date().toISOString()
      await this.updateQuizSession(sessionId, {
        status: 'in_progress',
        startedAt: now,
        quizStartedAt: now // Set when the global timer starts
      }, authenticatedSupabase)
    } catch (error) {
      console.error('Error starting quiz session:', error)
      throw error
    }
  }

  /**
   * Pause a quiz session
   */
  async pauseQuizSession(sessionId: string, timeRemaining: number, authenticatedSupabase?: any): Promise<void> {
    try {
      await this.updateQuizSession(sessionId, {
        status: 'paused',
        timeRemaining // Save current time remaining when pausing
      }, authenticatedSupabase)
    } catch (error) {
      console.error('Error pausing quiz session:', error)
      throw error
    }
  }

  /**
   * Resume a quiz session
   */
  async resumeQuizSession(sessionId: string, authenticatedSupabase?: any): Promise<void> {
    try {
      await this.updateQuizSession(sessionId, {
        status: 'in_progress',
        quizStartedAt: new Date().toISOString() // Reset timer start time for accurate tracking
      }, authenticatedSupabase)
    } catch (error) {
      console.error('Error resuming quiz session:', error)
      throw error
    }
  }

  /**
   * Update time remaining for a quiz session
   */
  async updateTimeRemaining(sessionId: string, timeRemaining: number, authenticatedSupabase?: any): Promise<void> {
    try {
      await this.updateQuizSession(sessionId, {
        timeRemaining
      }, authenticatedSupabase)
    } catch (error) {
      console.error('Error updating time remaining:', error)
      throw error
    }
  }



  /**
   * Get user quiz statistics for performance analytics
   */
  async getUserQuizStats(userId: string): Promise<QuizStats> {
    try {
      // Get quiz session statistics
      const { data: sessions, error: sessionsError } = await this.supabase
        .from('quiz_sessions')
        .select('*')
        .eq('user_id', userId)

      if (sessionsError) throw sessionsError

      const totalQuizzes = sessions?.length || 0
      const completedQuizzes = sessions?.filter(s => s.status === 'completed').length || 0

      // Calculate average score
      const completedSessions = sessions?.filter(s => s.status === 'completed' && s.score !== null) || []
      const averageScore = completedSessions.length > 0
        ? Math.round(completedSessions.reduce((sum, s) => sum + (s.score || 0), 0) / completedSessions.length)
        : 0

      // Calculate total study time
      const totalStudyTime = completedSessions.reduce((sum, s) => sum + (s.total_time_spent || 0), 0)

      // Calculate current streak (simplified - just count recent days with completed quizzes)
      const today = new Date()
      const recentDays = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        return date.toDateString()
      })

      let currentStreak = 0
      for (const day of recentDays) {
        const hasQuizOnDay = completedSessions.some(s =>
          new Date(s.completed_at || '').toDateString() === day
        )
        if (hasQuizOnDay) {
          currentStreak++
        } else {
          break
        }
      }

      // Get weekly stats (last 7 days)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)

      const weeklyQuizzes = completedSessions.filter(s =>
        new Date(s.completed_at || '') >= weekAgo
      ).length

      const weeklyStudyTime = completedSessions
        .filter(s => new Date(s.completed_at || '') >= weekAgo)
        .reduce((sum, s) => sum + (s.total_time_spent || 0), 0)

      // Get recent quizzes (last 5)
      const recentQuizzes = completedSessions
        .sort((a, b) => new Date(b.completed_at || '').getTime() - new Date(a.completed_at || '').getTime())
        .slice(0, 5)
        .map(s => ({
          title: s.title,
          score: s.score || 0,
          completedAt: s.completed_at || ''
        }))

      // Get category performance (simplified - would need to join with questions and categories)
      // For now, return empty array - this would require more complex queries
      const categoryPerformance: Array<{ categoryName: string, correct: number, total: number }> = []

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
          hard: { attempted: 0, correct: 0, averageScore: 0 }
        }
      }
    } catch (error) {
      console.error('Error getting user quiz stats:', error)
      throw error
    }
  }

  /**
   * Get quiz results for a completed session
   */
  async getQuizResults(sessionId: string, authenticatedSupabase?: any): Promise<QuizResult | null> {
    try {
      // Get session details
      const session = await this.getQuizSession(sessionId, authenticatedSupabase)
      if (!session) return null

      // Check if quiz is completed
      if (session.status !== 'completed') {
        throw new Error('Quiz session is not completed yet')
      }

      // Get all attempts for this session
      const supabaseClient = authenticatedSupabase || this.supabase
      const { data: attempts, error: attemptsError } = await supabaseClient
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_session_id', sessionId)

      if (attemptsError) throw attemptsError

      // Calculate results
      const correctAnswers = attempts?.filter((a: any) => a.is_correct).length || 0
      const totalQuestions = session.totalQuestions
      const score = Math.round((correctAnswers / totalQuestions) * 100)
      const totalTimeSpent = session.totalTimeSpent || 0
      const averageTimePerQuestion = Math.round(totalTimeSpent / totalQuestions)

      // Calculate difficulty breakdown
      const difficultyBreakdown = {
        easy: { correct: 0, total: 0 },
        medium: { correct: 0, total: 0 },
        hard: { correct: 0, total: 0 }
      }

      // Calculate category breakdown
      const categoryMap = new Map<string, { name: string, correct: number, total: number }>()

      // Get unique category IDs from questions
      const categoryIds = [...new Set(session.questions.map(q => q.category_id).filter(Boolean))]

      // Fetch category names
      const { data: categories } = await supabaseClient
        .from('categories')
        .select('id, name')
        .in('id', categoryIds)

      const categoryNameMap = new Map(categories?.map((c: any) => [c.id, c.name]) || [])

      session.questions.forEach(question => {
        const difficulty = question.difficulty as 'easy' | 'medium' | 'hard'
        const attempt = attempts?.find((a: any) => a.question_id === question.id)

        difficultyBreakdown[difficulty].total++
        if (attempt?.is_correct) {
          difficultyBreakdown[difficulty].correct++
        }

        // Category breakdown
        if (question.category_id) {
          if (!categoryMap.has(question.category_id)) {
            categoryMap.set(question.category_id, {
              name: (categoryNameMap.get(question.category_id) as string) || 'Unknown Category',
              correct: 0,
              total: 0
            })
          }
          const categoryStats = categoryMap.get(question.category_id)!
          categoryStats.total++
          if (attempt?.is_correct) {
            categoryStats.correct++
          }
        }
      })

      const categoryBreakdown = Array.from(categoryMap.entries()).map(([categoryId, stats]) => ({
        categoryId,
        categoryName: stats.name,
        correct: stats.correct,
        total: stats.total
      }))

      // Get detailed question information for review
      const questionDetails = await Promise.all(session.questions.map(async question => {
        const attempt = attempts?.find((a: any) => a.question_id === question.id)

        // Get category name
        const { data: category } = await supabaseClient
          .from('categories')
          .select('name')
          .eq('id', question.category_id)
          .single()

        // Get success rate for this question
        const { data: allAttempts } = await supabaseClient
          .from('quiz_attempts')
          .select('is_correct')
          .eq('question_id', question.id)

        const totalAttempts = allAttempts?.length || 0
        const correctAttempts = allAttempts?.filter((a: any) => a.is_correct).length || 0
        const successRate = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0

        return {
          id: question.id,
          title: question.title,
          stem: question.stem,
          difficulty: question.difficulty,
          category: category?.name || 'Unknown',
          isCorrect: attempt?.is_correct || false,
          selectedAnswerId: attempt?.selected_answer_id || null,
          timeSpent: attempt?.time_spent || 0,
          successRate
        }
      }))

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
        attempts: attempts?.map((a: any) => ({
          ...a,
          quizSessionId: a.quiz_session_id,
          questionId: a.question_id,
          selectedAnswerId: a.selected_answer_id,
          isCorrect: a.is_correct,
          timeSpent: a.time_spent,
          attemptedAt: a.attempted_at,
          reviewedAt: a.reviewed_at
        })) || [],
        completedAt: session.completedAt || new Date().toISOString()
      }
    } catch (error) {
      console.error('Error getting quiz results:', error)
      throw error
    }
  }

  /**
   * Complete a quiz and calculate results
   */
  async completeQuiz(sessionId: string, authenticatedSupabase?: any): Promise<QuizResult> {
    try {
      // Use authenticated client if provided, otherwise fall back to default
      const supabaseClient = authenticatedSupabase || this.supabase

      // Get all attempts for this session
      const { data: attempts, error: attemptsError } = await supabaseClient
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_session_id', sessionId)

      if (attemptsError) throw attemptsError

      // Get session details
      const session = await this.getQuizSession(sessionId, authenticatedSupabase)
      if (!session) throw new Error('Quiz session not found')

      // Calculate results
      const correctAnswers = attempts?.filter((a: any) => a.is_correct).length || 0
      const totalQuestions = session.totalQuestions
      const score = Math.round((correctAnswers / totalQuestions) * 100)
      const totalTimeSpent = attempts?.reduce((sum: number, a: any) => sum + (a.time_spent || 0), 0) || 0
      const averageTimePerQuestion = Math.round(totalTimeSpent / totalQuestions)

      // Calculate difficulty breakdown
      const difficultyBreakdown = {
        easy: { correct: 0, total: 0 },
        medium: { correct: 0, total: 0 },
        hard: { correct: 0, total: 0 }
      }

      session.questions.forEach(question => {
        const difficulty = question.difficulty as 'easy' | 'medium' | 'hard'
        const attempt = attempts?.find((a: any) => a.question_id === question.id)

        difficultyBreakdown[difficulty].total++
        if (attempt?.is_correct) {
          difficultyBreakdown[difficulty].correct++
        }
      })

      // Update session as completed
      await this.updateQuizSession(sessionId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        totalTimeSpent,
        score,
        correctAnswers
      }, authenticatedSupabase)

      // Refresh user statistics after quiz completion for better performance
      try {
        const { data: session } = await supabaseClient
          .from('quiz_sessions')
          .select('user_id')
          .eq('id', sessionId)
          .single()

        if (session?.user_id) {
          await supabaseClient.rpc('refresh_user_category_stats', {
            p_user_id: session.user_id
          })
          console.log('User statistics refreshed after quiz completion')
        }
      } catch (statsError) {
        console.warn('Failed to refresh user statistics:', statsError)
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
        attempts: attempts?.map((a: any) => ({
          ...a,
          quizSessionId: a.quiz_session_id,
          questionId: a.question_id,
          selectedAnswerId: a.selected_answer_id,
          isCorrect: a.is_correct,
          timeSpent: a.time_spent,
          attemptedAt: a.attempted_at,
          reviewedAt: a.reviewed_at
        })) || [],
        completedAt: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error completing quiz:', error)
      throw error
    }
  }



  /**
   * Utility function to shuffle array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
}

export const quizService = new QuizService()
