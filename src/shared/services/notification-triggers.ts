// src/shared/services/notification-triggers.ts
// Event triggers for creating user notifications

import { notificationGenerators } from './notification-generators'
import { createClient } from '@/shared/services/client'

export class NotificationTriggers {
  private supabase = createClient()

  // Quiz completion trigger
  async onQuizCompleted(
    userId: string,
    quizData: {
      score: number
      totalQuestions: number
      correctAnswers: number
      quizType: string
      timeSpent: number
      categories: string[]
    }
  ): Promise<void> {
    try {

      // Check for perfect score achievement
      if (quizData.score === 100) {
        await notificationGenerators.createPerfectScoreNotification(
          userId,
          quizData.quizType,
          quizData.totalQuestions
        )
      }

      // Update user statistics and check for milestones
      await this.updateUserStats(userId, quizData)

      // Check for various milestones
      const userStats = await this.getUserStats(userId)
      if (userStats) {
        await notificationGenerators.checkQuestionsAnsweredMilestone(
          userId,
          userStats.totalQuestionsAnswered
        )

        await notificationGenerators.checkQuizStreakMilestone(
          userId,
          userStats.currentQuizStreak
        )

        // Check category mastery for each category in the quiz
        for (const category of quizData.categories) {
          const categoryStats = await this.getCategoryStats(userId, category)
          if (categoryStats && categoryStats.accuracy >= 90) {
            await notificationGenerators.checkCategoryMasteryMilestone(
              userId,
              category,
              categoryStats.accuracy
            )
          }
        }
      }
    } catch (error) {
    }
  }

  // User login trigger
  async onUserLogin(userId: string): Promise<void> {
    try {

      // Update login streak
      const loginStreak = await this.updateLoginStreak(userId)

      // Check for login streak milestones
      await notificationGenerators.checkLoginStreakMilestone(userId, loginStreak)

      // Check if user needs daily quiz reminder (after some time)
      setTimeout(async () => {
        await this.checkDailyQuizReminder(userId)
      }, 2 * 60 * 60 * 1000) // 2 hours after login
    } catch (error) {
    }
  }

  // Goal completion trigger
  async onGoalCompleted(
    userId: string,
    goalData: {
      id: string
      title: string
      description: string
      goalType: string
      targetValue: number
      currentValue: number
    }
  ): Promise<void> {
    try {

      await notificationGenerators.createAchievementNotification(
        userId,
        'goal_completion',
        `🏆 Goal Completed: ${goalData.title}`,
        `Congratulations! You've successfully completed your goal: ${goalData.title}. Time to set new challenges!`,
        {
          goal_id: goalData.id,
          goal_type: goalData.goalType,
          target_value: goalData.targetValue,
          achieved_value: goalData.currentValue
        }
      )
    } catch (error) {
    }
  }

  // Study session completion trigger
  async onStudySessionCompleted(
    userId: string,
    sessionData: {
      duration: number // in minutes
      questionsStudied: number
      topicsReviewed: string[]
    }
  ): Promise<void> {
    try {

      // Update total study time
      const totalStudyHours = await this.updateStudyTime(userId, sessionData.duration)

      // Check for study time milestones
      await notificationGenerators.checkStudyTimeMilestone(userId, Math.floor(totalStudyHours))

      // If it's a long study session, create an achievement
      if (sessionData.duration >= 120) { // 2+ hours
        await notificationGenerators.createAchievementNotification(
          userId,
          'long_study_session',
          '📖 Marathon Study Session!',
          `Impressive! You just completed a ${Math.floor(sessionData.duration / 60)} hour study session. Your dedication is remarkable!`,
          {
            duration_minutes: sessionData.duration,
            questions_studied: sessionData.questionsStudied,
            topics_reviewed: sessionData.topicsReviewed
          }
        )
      }
    } catch (error) {
    }
  }

  // Learning path progress trigger
  async onLearningPathProgress(
    userId: string,
    pathData: {
      pathId: string
      pathName: string
      completionPercentage: number
      newTopicsUnlocked: string[]
    }
  ): Promise<void> {
    try {

      // Check for completion milestones
      const milestones = [25, 50, 75, 100]
      const currentMilestone = milestones.find(m => 
        pathData.completionPercentage >= m && 
        pathData.completionPercentage - 10 < m // Assuming 10% progress increments
      )

      if (currentMilestone) {
        if (currentMilestone === 100) {
          await notificationGenerators.createAchievementNotification(
            userId,
            'learning_path_completion',
            `🎉 Learning Path Completed!`,
            `Congratulations! You've successfully completed the ${pathData.pathName} learning path. Ready for the next challenge?`,
            {
              path_id: pathData.pathId,
              path_name: pathData.pathName,
              completion_percentage: pathData.completionPercentage
            }
          )
        } else {
          await notificationGenerators.createAchievementNotification(
            userId,
            'learning_path_milestone',
            `🎯 Learning Path Milestone`,
            `You've completed ${currentMilestone}% of your ${pathData.pathName} learning path. Keep going!`,
            {
              path_id: pathData.pathId,
              path_name: pathData.pathName,
              completion_percentage: pathData.completionPercentage,
              milestone: currentMilestone
            }
          )
        }
      }

      // Notify about new topics unlocked
      if (pathData.newTopicsUnlocked.length > 0) {
        await notificationGenerators.createAchievementNotification(
          userId,
          'topics_unlocked',
          `🔓 New Topics Unlocked!`,
          `Great progress! You've unlocked ${pathData.newTopicsUnlocked.length} new topics: ${pathData.newTopicsUnlocked.join(', ')}`,
          {
            path_id: pathData.pathId,
            unlocked_topics: pathData.newTopicsUnlocked
          }
        )
      }
    } catch (error) {
    }
  }

  // System maintenance notification trigger
  async onSystemMaintenance(
    title: string,
    message: string,
    scheduledTime: string,
    duration: string
  ): Promise<void> {
    try {

      await notificationGenerators.broadcastSystemUpdate(
        title,
        message,
        'maintenance',
        'warning',
        'all'
      )
    } catch (error) {
    }
  }

  // New feature announcement trigger
  async onNewFeatureAnnouncement(
    featureName: string,
    description: string,
    targetAudience: 'all' | 'admin' | 'user' | 'creator' | 'reviewer' = 'all'
  ): Promise<void> {
    try {

      await notificationGenerators.broadcastSystemUpdate(
        `New Feature: ${featureName}`,
        `We've added a new feature to enhance your learning experience: ${description}`,
        'feature',
        'info',
        targetAudience
      )
    } catch (error) {
    }
  }

  // Helper methods
  private async updateUserStats(userId: string, quizData: any): Promise<void> {
    // This would update user statistics in the database
    // Implementation depends on your user stats schema
  }

  private async getUserStats(userId: string): Promise<{
    totalQuestionsAnswered: number
    currentQuizStreak: number
  } | null> {
    // This would fetch current user statistics
    // For now, return mock data
    return {
      totalQuestionsAnswered: 0,
      currentQuizStreak: 0
    }
  }

  private async getCategoryStats(userId: string, category: string): Promise<{
    accuracy: number
    questionsAnswered: number
  } | null> {
    // This would fetch category-specific statistics
    // For now, return mock data
    return {
      accuracy: 0,
      questionsAnswered: 0
    }
  }

  private async updateLoginStreak(userId: string): Promise<number> {
    // This would update and return the user's login streak
    // For now, return mock data
    return 1
  }

  private async updateStudyTime(userId: string, minutes: number): Promise<number> {
    // This would update and return total study time in hours
    // For now, return mock data
    return 1
  }

  private async checkDailyQuizReminder(userId: string): Promise<void> {
    // Check if user has taken a quiz today, if not send reminder
    const hasQuizToday = await this.hasUserTakenQuizToday(userId)
    
    if (!hasQuizToday) {
      await notificationGenerators.createReminderNotification(
        userId,
        'daily_quiz',
        '📝 Daily Quiz Reminder',
        "Don't forget to take your daily quiz! Consistent practice leads to better retention."
      )
    }
  }

  private async hasUserTakenQuizToday(userId: string): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0]
    
    const { data, error } = await this.supabase
      .from('quiz_attempts')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lt('created_at', `${today}T23:59:59.999Z`)
      .limit(1)

    if (error) {
      return false
    }

    return (data?.length || 0) > 0
  }
}

export const notificationTriggers = new NotificationTriggers()
