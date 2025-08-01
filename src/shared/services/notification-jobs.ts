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
      console.log('🔄 Processing daily reminders...')

      // Get all active users who have quiz reminders enabled
      const { data: users, error } = await this.supabase
        .from('user_profiles')
        .select('user_id, created_at')
        .eq('status', 'active')

      if (error) {
        console.error('Error fetching users for reminders:', error)
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
          console.error(`Error processing reminder for user ${user.user_id}:`, error)
          // Continue with other users
        }
      }

      console.log(`✅ Processed daily reminders for ${users?.length || 0} users`)
    } catch (error) {
      console.error('Error in processDailyReminders:', error)
    }
  }

  // Weekly review reminder job
  async processWeeklyReviews(): Promise<void> {
    try {
      console.log('🔄 Processing weekly review reminders...')

      const { data: users, error } = await this.supabase
        .from('user_profiles')
        .select('user_id')
        .eq('status', 'active')

      if (error) {
        console.error('Error fetching users for weekly reviews:', error)
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
          console.error(`Error processing weekly review for user ${user.user_id}:`, error)
        }
      }

      console.log(`✅ Processed weekly reviews for ${users?.length || 0} users`)
    } catch (error) {
      console.error('Error in processWeeklyReviews:', error)
    }
  }

  // Milestone detection job - analyze user progress and create milestone notifications
  async processMilestoneDetection(): Promise<void> {
    try {
      console.log('🔄 Processing milestone detection...')

      const { data: users, error } = await this.supabase
        .from('user_profiles')
        .select('user_id')
        .eq('status', 'active')

      if (error) {
        console.error('Error fetching users for milestone detection:', error)
        return
      }

      for (const user of users || []) {
        try {
          await this.checkUserMilestones(user.user_id)
        } catch (error) {
          console.error(`Error checking milestones for user ${user.user_id}:`, error)
        }
      }

      console.log(`✅ Processed milestone detection for ${users?.length || 0} users`)
    } catch (error) {
      console.error('Error in processMilestoneDetection:', error)
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
      console.error(`Error checking milestones for user ${userId}:`, error)
    }
  }

  // Goal completion detection
  async processGoalCompletions(): Promise<void> {
    try {
      console.log('🔄 Processing goal completions...')

      // This would integrate with a goals system
      // For now, we'll create a placeholder implementation
      
      const { data: goals, error } = await this.supabase
        .from('user_goals')
        .select('*')
        .eq('status', 'active')

      if (error) {
        console.error('Error fetching goals:', error)
        return
      }

      for (const goal of goals || []) {
        try {
          const isCompleted = await this.checkGoalCompletion(goal)
          
          if (isCompleted) {
            await notificationGenerators.createAchievementNotification(
              goal.user_id,
              'goal_completion',
              `🏆 Goal Completed: ${goal.title}`,
              `Congratulations! You've successfully completed your goal: ${goal.title}. Time to set new challenges!`,
              { goal_id: goal.id, goal_title: goal.title }
            )

            // Update goal status
            await this.supabase
              .from('user_goals')
              .update({ status: 'completed', completed_at: new Date().toISOString() })
              .eq('id', goal.id)
          }
        } catch (error) {
          console.error(`Error processing goal ${goal.id}:`, error)
        }
      }

      console.log(`✅ Processed goal completions for ${goals?.length || 0} goals`)
    } catch (error) {
      console.error('Error in processGoalCompletions:', error)
    }
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
      console.error('Error checking daily quiz:', error)
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
        console.error('Error fetching quiz stats:', error)
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
      console.error('Error getting user quiz stats:', error)
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
      console.log('🔄 Cleaning up old notifications...')

      // Delete read notifications older than 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const { error } = await this.supabase
        .from('notification_states')
        .delete()
        .eq('read', true)
        .lt('created_at', thirtyDaysAgo)

      if (error) {
        console.error('Error cleaning up notifications:', error)
        return
      }

      console.log('✅ Cleaned up old notifications')
    } catch (error) {
      console.error('Error in cleanupOldNotifications:', error)
    }
  }
}

export const notificationJobs = new NotificationJobs()
