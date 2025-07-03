// src/features/quiz/services/quiz-service.ts
import { createClient } from '@/shared/services/client'
import { 
  QuizSession, 
  QuizAttempt, 
  QuizConfig, 
  QuizResult,
  QuizStats,
  QuizCreationForm 
} from '@/features/quiz/types/quiz'
import { QuestionWithDetails } from '@/features/questions/types/questions'

export class QuizService {
  private supabase = createClient()

  /**
   * Create a new quiz session
   */
  async createQuizSession(userId: string, formData: QuizCreationForm): Promise<QuizSession> {
    try {
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

      // Create quiz session
      const { data: session, error } = await this.supabase
        .from('quiz_sessions')
        .insert({
          user_id: userId,
          title: formData.title,
          config: {
            mode: formData.mode,
            questionCount: formData.questionCount,
            timeLimit: formData.timeLimit,
            timePerQuestion: formData.timePerQuestion,
            difficulty: formData.difficulty,
            categories: formData.selectedCategories,
            tags: formData.selectedTags,
            questionSets: formData.selectedQuestionSets,
            shuffleQuestions: formData.shuffleQuestions,
            shuffleAnswers: formData.shuffleAnswers,
            showExplanations: formData.showExplanations,
            allowReview: formData.allowReview,
            showProgress: formData.showProgress
          },
          questions: limitedQuestions.map(q => q.id),
          current_question_index: 0,
          status: 'not_started',
          total_questions: limitedQuestions.length
        })
        .select()
        .single()

      if (error) throw error

      return {
        ...session,
        questions: limitedQuestions,
        userId: session.user_id,
        config: session.config as QuizConfig,
        currentQuestionIndex: session.current_question_index,
        totalQuestions: session.total_questions,
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
    let query = this.supabase
      .from('questions')
      .select(`
        *,
        question_options(*),
        question_images(*, image:images(*)),
        question_set:sets(*)
      `)
      .eq('status', 'published')

    // Filter by difficulty
    if (formData.difficulty && formData.difficulty !== 'mixed') {
      query = query.eq('difficulty', formData.difficulty)
    }

    // Filter by question sets
    if (formData.selectedQuestionSets.length > 0) {
      query = query.in('question_set_id', formData.selectedQuestionSets)
    }

    const { data: questions, error } = await query

    if (error) throw error

    // Filter by categories if specified
    let filteredQuestions = questions || []

    if (formData.selectedCategories.length > 0) {
      filteredQuestions = filteredQuestions.filter(q =>
        q.category_id && formData.selectedCategories.includes(q.category_id)
      )
    }

    return filteredQuestions
  }

  /**
   * Get quiz session by ID
   */
  async getQuizSession(sessionId: string): Promise<QuizSession | null> {
    try {
      const { data: session, error } = await this.supabase
        .from('quiz_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (error) throw error
      if (!session) return null

      // Get questions for this session
      const questions = await this.getQuestionsForSession(session.questions)

      return {
        ...session,
        questions,
        userId: session.user_id,
        config: session.config as QuizConfig,
        currentQuestionIndex: session.current_question_index,
        totalQuestions: session.total_questions,
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
  private async getQuestionsForSession(questionIds: string[]): Promise<QuestionWithDetails[]> {
    const { data: questions, error } = await this.supabase
      .from('questions')
      .select(`
        *,
        question_options(*),
        question_images(*, image:images(*)),
        question_set:sets(*)
      `)
      .in('id', questionIds)

    if (error) throw error

    // Maintain the order from questionIds
    const questionMap = new Map(questions?.map(q => [q.id, q]) || [])
    return questionIds.map(id => questionMap.get(id)).filter(Boolean) as QuestionWithDetails[]
  }

  /**
   * Submit an answer for a question
   */
  async submitAnswer(
    sessionId: string, 
    questionId: string, 
    selectedAnswerId: string | null,
    timeSpent: number
  ): Promise<QuizAttempt> {
    try {
      // Get the correct answer
      const { data: answerOptions, error: answerError } = await this.supabase
        .from('question_options')
        .select('*')
        .eq('question_id', questionId)

      if (answerError) throw answerError

      const selectedAnswer = answerOptions?.find(opt => opt.id === selectedAnswerId)
      const isCorrect = selectedAnswer?.is_correct || false

      // Create quiz attempt
      const { data: attempt, error } = await this.supabase
        .from('quiz_attempts')
        .insert({
          quiz_session_id: sessionId,
          question_id: questionId,
          selected_answer_id: selectedAnswerId,
          is_correct: isCorrect,
          time_spent: timeSpent,
          attempted_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

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
  async updateQuizSession(sessionId: string, updates: Partial<QuizSession>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('quiz_sessions')
        .update({
          current_question_index: updates.currentQuestionIndex,
          status: updates.status,
          started_at: updates.startedAt,
          completed_at: updates.completedAt,
          total_time_spent: updates.totalTimeSpent,
          score: updates.score,
          correct_answers: updates.correctAnswers,
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
   * Complete a quiz and calculate results
   */
  async completeQuiz(sessionId: string): Promise<QuizResult> {
    try {
      // Get all attempts for this session
      const { data: attempts, error: attemptsError } = await this.supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_session_id', sessionId)

      if (attemptsError) throw attemptsError

      // Get session details
      const session = await this.getQuizSession(sessionId)
      if (!session) throw new Error('Quiz session not found')

      // Calculate results
      const correctAnswers = attempts?.filter(a => a.is_correct).length || 0
      const totalQuestions = session.totalQuestions
      const score = Math.round((correctAnswers / totalQuestions) * 100)
      const totalTimeSpent = attempts?.reduce((sum, a) => sum + (a.time_spent || 0), 0) || 0
      const averageTimePerQuestion = Math.round(totalTimeSpent / totalQuestions)

      // Calculate difficulty breakdown
      const difficultyBreakdown = {
        easy: { correct: 0, total: 0 },
        medium: { correct: 0, total: 0 },
        hard: { correct: 0, total: 0 }
      }

      session.questions.forEach(question => {
        const difficulty = question.difficulty as 'easy' | 'medium' | 'hard'
        const attempt = attempts?.find(a => a.question_id === question.id)
        
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
      })

      return {
        sessionId,
        score,
        correctAnswers,
        totalQuestions,
        totalTimeSpent,
        averageTimePerQuestion,
        difficultyBreakdown,
        categoryBreakdown: [], // TODO: Implement category breakdown
        attempts: attempts?.map(a => ({
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
   * Get user quiz statistics
   */
  async getUserQuizStats(userId: string): Promise<QuizStats> {
    try {
      // Get all completed quiz sessions for user
      const { data: sessions, error } = await this.supabase
        .from('quiz_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'completed')

      if (error) throw error

      const completedSessions = sessions || []
      const totalQuizzes = completedSessions.length
      const averageScore = totalQuizzes > 0 
        ? Math.round(completedSessions.reduce((sum, s) => sum + (s.score || 0), 0) / totalQuizzes)
        : 0
      const totalTimeSpent = completedSessions.reduce((sum, s) => sum + (s.total_time_spent || 0), 0)

      return {
        totalQuizzes,
        completedQuizzes: totalQuizzes,
        averageScore,
        totalTimeSpent,
        currentStreak: 0, // TODO: Calculate streak
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
