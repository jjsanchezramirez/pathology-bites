// Quiz Analytics Service
// Handles batch analytics updates to reduce database load and improve reliability

import { createClient } from '@/shared/services/server'

export class QuizAnalyticsService {
  private supabase

  constructor(authenticatedSupabase?: any) {
    this.supabase = authenticatedSupabase
  }

  private getSupabase() {
    return this.supabase || createClient()
  }

  /**
   * Update analytics for all questions in a completed quiz session
   * This replaces the per-question trigger approach with a batch update
   */
  async updateQuizSessionAnalytics(sessionId: string): Promise<void> {
    try {
      console.log('[Analytics] Starting batch analytics update for session:', sessionId)

      // Get all questions from this quiz session
      const { data: attempts, error: attemptsError } = await this.getSupabase()
        .from('quiz_attempts')
        .select('question_id')
        .eq('quiz_session_id', sessionId)

      if (attemptsError) {
        console.error('[Analytics] Error fetching quiz attempts:', attemptsError)
        throw attemptsError
      }

      if (!attempts || attempts.length === 0) {
        console.log('[Analytics] No attempts found for session:', sessionId)
        return
      }

      // Get unique question IDs
      const questionIds = [...new Set(attempts.map((a: any) => a.question_id))] as string[]
      console.log('[Analytics] Updating analytics for questions:', questionIds)

      // Update analytics for each question
      const updatePromises = questionIds.map(questionId =>
        this.updateQuestionAnalytics(questionId)
      )

      await Promise.allSettled(updatePromises)
      console.log('[Analytics] Batch analytics update completed for session:', sessionId)

    } catch (error) {
      console.error('[Analytics] Error in batch analytics update:', error)
      // Don't throw - analytics failures shouldn't break quiz completion
    }
  }

  /**
   * Update analytics for a single question
   */
  private async updateQuestionAnalytics(questionId: string): Promise<void> {
    try {
      // Calculate stats from quiz_attempts
      const { data: stats, error: statsError } = await this.getSupabase()
        .from('quiz_attempts')
        .select('is_correct')
        .eq('question_id', questionId)

      if (statsError) {
        console.error('[Analytics] Error fetching question stats:', statsError)
        return
      }

      if (!stats || stats.length === 0) {
        return
      }

      const totalAttempts = stats.length
      const correctAttempts = stats.filter((s: any) => s.is_correct).length
      const successRate = totalAttempts > 0 ? correctAttempts / totalAttempts : 0
      const difficultyScore = 1.0 - successRate

      // Update or insert analytics record
      const { error: upsertError } = await this.getSupabase()
        .from('question_analytics')
        .upsert({
          question_id: questionId,
          total_attempts: totalAttempts,
          correct_attempts: correctAttempts,
          success_rate: successRate,
          difficulty_score: difficultyScore,
          last_calculated_at: new Date().toISOString()
        }, {
          onConflict: 'question_id'
        })

      if (upsertError) {
        console.error('[Analytics] Error updating question analytics:', upsertError)
      } else {
        console.log('[Analytics] Updated analytics for question:', questionId, {
          totalAttempts,
          correctAttempts,
          successRate: Math.round(successRate * 100) + '%'
        })
      }

    } catch (error) {
      console.error('[Analytics] Error updating question analytics:', error)
      // Don't throw - individual question analytics failures shouldn't break the batch
    }
  }

  /**
   * Update analytics for multiple questions (used by admin tools)
   */
  async updateMultipleQuestionAnalytics(questionIds: string[]): Promise<void> {
    try {
      console.log('[Analytics] Updating analytics for multiple questions:', questionIds.length)

      const updatePromises = questionIds.map(questionId => 
        this.updateQuestionAnalytics(questionId)
      )

      const results = await Promise.allSettled(updatePromises)
      
      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      console.log('[Analytics] Batch update completed:', { successful, failed, total: questionIds.length })

    } catch (error) {
      console.error('[Analytics] Error in multiple question analytics update:', error)
    }
  }

  /**
   * Recalculate all question analytics (admin tool)
   */
  async recalculateAllAnalytics(): Promise<void> {
    try {
      console.log('[Analytics] Starting full analytics recalculation')

      // Get all questions that have attempts
      const { data: questions, error: questionsError } = await this.getSupabase()
        .from('quiz_attempts')
        .select('question_id')

      if (questionsError) {
        console.error('[Analytics] Error fetching questions with attempts:', questionsError)
        throw questionsError
      }

      if (!questions || questions.length === 0) {
        console.log('[Analytics] No questions with attempts found')
        return
      }

      // Get unique question IDs
      const questionIds = [...new Set(questions.map((q: any) => q.question_id))] as string[]

      // Process in batches to avoid overwhelming the database
      const batchSize = 50
      for (let i = 0; i < questionIds.length; i += batchSize) {
        const batch = questionIds.slice(i, i + batchSize)
        await this.updateMultipleQuestionAnalytics(batch)
        
        // Small delay between batches
        if (i + batchSize < questionIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      console.log('[Analytics] Full analytics recalculation completed for', questionIds.length, 'questions')

    } catch (error) {
      console.error('[Analytics] Error in full analytics recalculation:', error)
      throw error
    }
  }

  /**
   * Get analytics summary for a quiz session
   */
  async getSessionAnalyticsSummary(sessionId: string): Promise<{
    totalQuestions: number
    correctAnswers: number
    accuracy: number
    averageTimePerQuestion: number
  } | null> {
    try {
      const { data: attempts, error } = await this.getSupabase()
        .from('quiz_attempts')
        .select('is_correct, time_spent')
        .eq('quiz_session_id', sessionId)

      if (error || !attempts) {
        console.error('[Analytics] Error fetching session summary:', error)
        return null
      }

      const totalQuestions = attempts.length
      const correctAnswers = attempts.filter((a: any) => a.is_correct).length
      const accuracy = totalQuestions > 0 ? correctAnswers / totalQuestions : 0
      const totalTime = attempts.reduce((sum: number, a: any) => sum + (a.time_spent || 0), 0)
      const averageTimePerQuestion = totalQuestions > 0 ? totalTime / totalQuestions : 0

      return {
        totalQuestions,
        correctAnswers,
        accuracy,
        averageTimePerQuestion
      }

    } catch (error) {
      console.error('[Analytics] Error calculating session summary:', error)
      return null
    }
  }
}

// Export singleton instance
export const quizAnalyticsService = new QuizAnalyticsService()
