// src/shared/services/notification-jobs.ts
// Background jobs for processing notifications

import { createClient } from '@/shared/services/client'
import { notificationGenerators } from './notification-generators'
import { userSettingsService } from './user-settings'

export class NotificationJobs {
  private supabase = createClient()

  // Daily reminder job - check user preferences and send reminders
  async processDailyReminders(): Promise<void> {
    try {

      // Get all active users who have quiz reminders enabled
      const { data: users, error } = await this.supabase
        .from('user_profiles')
        .select('user_id, created_at')
        .eq('status', 'active')

      if (error) {
        return
      }

      for (const user of users || []) {
        try {
          // Check user's notification preferences
          const settings = await userSettingsService.getNotificationSettings()
          
          if (settings.quiz_reminders) {
            // Check if user has taken a quiz today
            const hasQuizToday = await this.hasUserTakenQuizToday(user.user_id)
            
            if (!hasQuizToday) {
              await notificationGenerators.createReminderNotification(
                user.user_id,
                'daily_quiz',
                '📝 Daily Quiz Reminder',
                "Don't forget to take your daily quiz! Consistent practice leads to better retention and improved performance."
              )
            }
          }
        } catch (error) {
          // Continue with other users
        }
      }

    } catch (error) {
    }
  }

  // Weekly review reminder job
  async processWeeklyReviews(): Promise<void> {
    try {

      const { data: users, error } = await this.supabase
        .from('user_profiles')
        .select('user_id')
        .eq('status', 'active')

      if (error) {
        return
      }

      for (const user of users || []) {
        try {
          const settings = await userSettingsService.getNotificationSettings()
          
          if (settings.progress_updates) {
            await notificationGenerators.createReminderNotification(
              user.user_id,
              'weekly_review',
              '📊 Weekly Review Time',
              "It's time for your weekly review! Check your progress and identify areas that need more attention."
            )
          }
        } catch (error) {
        }
      }

    } catch (error) {
    }
  }

  // Milestone detection job - analyze user progress and create milestone notifications
  async processMilestoneDetection(): Promise<void> {
    try {

      const { data: users, error } = await this.supabase
        .from('user_profiles')
        .select('user_id')
        .eq('status', 'active')

      if (error) {
        return
      }

      for (const user of users || []) {
        try {
          await this.checkUserMilestones(user.user_id)
        } catch (error) {
        }
      }

    } catch (error) {
    }
  }

  // Check individual user milestones
  private async checkUserMilestones(userId: string): Promise<void> {
    try {
      // Get user's quiz statistics
      const stats = await this.getUserQuizStats(userId)
      
      if (stats) {
        // Check various milestone types
        await notificationGenerators.checkQuestionsAnsweredMilestone(userId, stats.totalAnswered)
        await notificationGenerators.checkQuizStreakMilestone(userId, stats.currentStreak)
        await notificationGenerators.checkStudyTimeMilestone(userId, stats.totalStudyHours)
        await notificationGenerators.checkLoginStreakMilestone(userId, stats.loginStreak)

        // Check category mastery
        for (const category of stats.categoryStats) {
          if (category.accuracy >= 90) {
            await notificationGenerators.checkCategoryMasteryMilestone(
              userId,
              category.name,
              category.accuracy
            )
          }
        }
      }
    } catch (error) {
    }
  }

  // Goal completion detection - deprecated (Goals feature removed)
  async processGoalCompletions(): Promise<void> {
    // Goals feature has been removed
    return
  }

  // Helper methods
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

  private async getUserQuizStats(userId: string): Promise<{
    totalAnswered: number
    currentStreak: number
    totalStudyHours: number
    loginStreak: number
    categoryStats: Array<{ name: string; accuracy: number }>
  } | null> {
    try {
      // This would integrate with actual quiz statistics
      // For now, return mock data structure
      const { data: attempts, error } = await this.supabase
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', userId)

      if (error) {
        return null
      }

      // Calculate basic stats (simplified implementation)
      const totalAnswered = attempts?.reduce((sum, attempt) => sum + (attempt.questions_answered || 0), 0) || 0
      
      return {
        totalAnswered,
        currentStreak: 0, // Would calculate from actual data
        totalStudyHours: 0, // Would calculate from actual data
        loginStreak: 0, // Would calculate from actual data
        categoryStats: [] // Would calculate from actual data
      }
    } catch (error) {
      return null
    }
  }

  private async checkGoalCompletion(goal: any): Promise<boolean> {
    // Placeholder implementation
    // Would check actual goal criteria against user progress
    return false
  }

  // Cleanup old notifications
  async cleanupOldNotifications(): Promise<void> {
    try {

      // Delete read notifications older than 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const { error } = await this.supabase
        .from('notification_states')
        .delete()
        .eq('read', true)
        .lt('created_at', thirtyDaysAgo)

      if (error) {
        return
      }

    } catch (error) {
    }
  }
}

export const notificationJobs = new NotificationJobs()
