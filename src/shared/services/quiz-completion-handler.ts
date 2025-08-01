// src/shared/services/quiz-completion-handler.ts
// Example integration of notification triggers with quiz completion

import { notificationTriggers } from './notification-triggers'
import { createClient } from '@/shared/services/client'
import { ActivityGenerator } from './activity-generator'

export class QuizCompletionHandler {
  private supabase = createClient()

  async handleQuizCompletion(
    userId: string,
    quizAttemptId: string,
    quizResults: {
      score: number
      totalQuestions: number
      correctAnswers: number
      incorrectAnswers: number
      timeSpent: number
      quizType: string
      categories: string[]
      answers: Array<{
        questionId: string
        selectedAnswer: string
        correctAnswer: string
        isCorrect: boolean
        timeSpent: number
      }>
    }
  ): Promise<void> {
    try {
      console.log(`🎯 Processing quiz completion for user ${userId}`)

      // Save quiz results to database
      await this.saveQuizResults(userId, quizAttemptId, quizResults)

      // Create activity for quiz completion
      const activityData = ActivityGenerator.createQuizCompletedActivity({
        id: quizAttemptId,
        title: quizResults.quizType || 'Quiz',
        score: quizResults.score,
        totalQuestions: quizResults.totalQuestions,
        timeSpent: quizResults.timeSpent
      })
      await ActivityGenerator.createActivity(userId, activityData)

      // Update goal progress
      await this.updateGoalProgress(userId, {
        questionsAnswered: quizResults.totalQuestions,
        quizzesCompleted: 1,
        studyTimeMinutes: Math.round((quizResults.timeSpent || 0) / 60),
        accuracy: quizResults.score
      })

      // Trigger notification events
      await notificationTriggers.onQuizCompleted(userId, {
        score: quizResults.score,
        totalQuestions: quizResults.totalQuestions,
        correctAnswers: quizResults.correctAnswers,
        quizType: quizResults.quizType,
        timeSpent: quizResults.timeSpent,
        categories: quizResults.categories
      })

      // Additional processing for study session tracking
      if (quizResults.timeSpent > 30) { // More than 30 minutes
        await notificationTriggers.onStudySessionCompleted(userId, {
          duration: quizResults.timeSpent,
          questionsStudied: quizResults.totalQuestions,
          topicsReviewed: quizResults.categories
        })
      }

      console.log(`✅ Quiz completion processed successfully for user ${userId}`)
    } catch (error) {
      console.error('Error handling quiz completion:', error)
      throw error
    }
  }

  /**
   * Update goal progress based on quiz completion
   */
  private async updateGoalProgress(userId: string, progressData: {
    questionsAnswered: number
    quizzesCompleted: number
    studyTimeMinutes: number
    accuracy: number
  }) {
    try {
      const response = await fetch('/api/user/dashboard/goals/batch/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(progressData)
      })

      if (!response.ok) {
        console.error('Failed to update goal progress:', await response.text())
      }
    } catch (error) {
      console.error('Error updating goal progress:', error)
      // Don't throw - goal progress update shouldn't break quiz completion
    }
  }

  private async saveQuizResults(
    userId: string,
    quizAttemptId: string,
    quizResults: any
  ): Promise<void> {
    try {
      // Update quiz attempt with results
      const { error: updateError } = await this.supabase
        .from('quiz_attempts')
        .update({
          score: quizResults.score,
          total_questions: quizResults.totalQuestions,
          correct_answers: quizResults.correctAnswers,
          incorrect_answers: quizResults.incorrectAnswers,
          time_spent: quizResults.timeSpent,
          completed_at: new Date().toISOString(),
          status: 'completed'
        })
        .eq('id', quizAttemptId)

      if (updateError) {
        console.error('Error updating quiz attempt:', updateError)
        throw updateError
      }

      // Save individual question results
      const questionResults = quizResults.answers.map((answer: any) => ({
        quiz_attempt_id: quizAttemptId,
        question_id: answer.questionId,
        selected_answer: answer.selectedAnswer,
        correct_answer: answer.correctAnswer,
        is_correct: answer.isCorrect,
        time_spent: answer.timeSpent,
        created_at: new Date().toISOString()
      }))

      const { error: resultsError } = await this.supabase
        .from('quiz_question_results')
        .insert(questionResults)

      if (resultsError) {
        console.error('Error saving question results:', resultsError)
        throw resultsError
      }

      // Update user statistics
      await this.updateUserStatistics(userId, quizResults)

    } catch (error) {
      console.error('Error saving quiz results:', error)
      throw error
    }
  }

  private async updateUserStatistics(userId: string, quizResults: any): Promise<void> {
    try {
      // Get current user stats
      const { data: currentStats, error: statsError } = await this.supabase
        .from('user_statistics')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (statsError && statsError.code !== 'PGRST116') { // Not found error
        console.error('Error fetching user stats:', statsError)
        throw statsError
      }

      const stats = currentStats || {
        user_id: userId,
        total_quizzes: 0,
        total_questions_answered: 0,
        total_correct_answers: 0,
        total_study_time: 0,
        current_quiz_streak: 0,
        best_quiz_streak: 0,
        average_score: 0,
        last_quiz_date: null
      }

      // Update statistics
      const newStats = {
        ...stats,
        total_quizzes: stats.total_quizzes + 1,
        total_questions_answered: stats.total_questions_answered + quizResults.totalQuestions,
        total_correct_answers: stats.total_correct_answers + quizResults.correctAnswers,
        total_study_time: stats.total_study_time + quizResults.timeSpent,
        last_quiz_date: new Date().toISOString(),
        average_score: Math.round(
          ((stats.average_score * stats.total_quizzes) + quizResults.score) / 
          (stats.total_quizzes + 1)
        )
      }

      // Update quiz streak
      const today = new Date().toISOString().split('T')[0]
      const lastQuizDate = stats.last_quiz_date ? 
        new Date(stats.last_quiz_date).toISOString().split('T')[0] : null
      
      if (lastQuizDate) {
        const daysDiff = Math.floor(
          (new Date(today).getTime() - new Date(lastQuizDate).getTime()) / 
          (1000 * 60 * 60 * 24)
        )
        
        if (daysDiff === 1) {
          // Consecutive day
          newStats.current_quiz_streak = stats.current_quiz_streak + 1
        } else if (daysDiff > 1) {
          // Streak broken
          newStats.current_quiz_streak = 1
        }
        // Same day doesn't change streak
      } else {
        // First quiz
        newStats.current_quiz_streak = 1
      }

      // Update best streak
      newStats.best_quiz_streak = Math.max(
        stats.best_quiz_streak, 
        newStats.current_quiz_streak
      )

      // Upsert statistics
      const { error: upsertError } = await this.supabase
        .from('user_statistics')
        .upsert(newStats)

      if (upsertError) {
        console.error('Error updating user statistics:', upsertError)
        throw upsertError
      }

      // Update category-specific statistics
      await this.updateCategoryStatistics(userId, quizResults)

    } catch (error) {
      console.error('Error updating user statistics:', error)
      throw error
    }
  }

  private async updateCategoryStatistics(userId: string, quizResults: any): Promise<void> {
    try {
      // Group answers by category
      const categoryStats: Record<string, { correct: number; total: number }> = {}
      
      for (const answer of quizResults.answers) {
        // This would need to be enhanced to get category from question
        // For now, we'll use the quiz categories
        for (const category of quizResults.categories) {
          if (!categoryStats[category]) {
            categoryStats[category] = { correct: 0, total: 0 }
          }
          categoryStats[category].total += 1
          if (answer.isCorrect) {
            categoryStats[category].correct += 1
          }
        }
      }

      // Update category statistics in database
      for (const [category, stats] of Object.entries(categoryStats)) {
        const { data: currentCategoryStats, error: fetchError } = await this.supabase
          .from('user_category_statistics')
          .select('*')
          .eq('user_id', userId)
          .eq('category', category)
          .single()

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error fetching category stats:', fetchError)
          continue
        }

        const existingStats = currentCategoryStats || {
          user_id: userId,
          category,
          total_questions: 0,
          correct_answers: 0,
          accuracy: 0
        }

        const newCategoryStats = {
          ...existingStats,
          total_questions: existingStats.total_questions + stats.total,
          correct_answers: existingStats.correct_answers + stats.correct,
          accuracy: Math.round(
            ((existingStats.correct_answers + stats.correct) / 
             (existingStats.total_questions + stats.total)) * 100
          )
        }

        const { error: upsertError } = await this.supabase
          .from('user_category_statistics')
          .upsert(newCategoryStats)

        if (upsertError) {
          console.error('Error updating category statistics:', upsertError)
        }
      }
    } catch (error) {
      console.error('Error updating category statistics:', error)
    }
  }
}

export const quizCompletionHandler = new QuizCompletionHandler()

// Example usage in a quiz completion API endpoint:
/*
// In your quiz completion API route:
import { quizCompletionHandler } from '@/shared/services/quiz-completion-handler'

export async function POST(request: NextRequest) {
  // ... authentication and validation ...
  
  const { userId, quizAttemptId, quizResults } = await request.json()
  
  await quizCompletionHandler.handleQuizCompletion(
    userId,
    quizAttemptId,
    quizResults
  )
  
  return NextResponse.json({ success: true })
}
*/
