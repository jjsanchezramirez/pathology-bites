// src/shared/services/notification-generators.ts
// Service for generating user notifications based on events and milestones

import { createClient } from '@/shared/services/client'
import { notificationsService } from './service'

export class NotificationGenerators {
  private supabase = createClient()

  // System Update Notifications
  async broadcastSystemUpdate(
    title: string,
    message: string,
    updateType: 'maintenance' | 'feature' | 'announcement' | 'security',
    severity: 'info' | 'warning' | 'critical' = 'info',
    targetAudience: 'all' | 'admin' | 'user' | 'creator' | 'reviewer' = 'all'
  ): Promise<void> {
    try {
      // Create system update record
      const { data: systemUpdate, error: updateError } = await this.supabase
        .from('system_updates')
        .insert({
          title,
          message,
          update_type: updateType,
          severity,
          target_audience: targetAudience,
          published_at: new Date().toISOString()
        })
        .select()
        .single()

      if (updateError) {
        console.error('Error creating system update:', updateError)
        throw updateError
      }

      // Get target users based on audience
      const targetUserIds = await this.getTargetUsers(targetAudience)

      // Create notifications for all target users
      await notificationsService.createSystemUpdateNotification(
        systemUpdate.id,
        targetUserIds
      )

      console.log(`📢 System update broadcasted to ${targetUserIds.length} users`)
    } catch (error) {
      console.error('Error broadcasting system update:', error)
      throw error
    }
  }

  // Milestone Notifications
  async createMilestoneNotification(
    userId: string,
    milestoneType: string,
    title: string,
    description: string,
    milestoneData: Record<string, any> = {}
  ): Promise<void> {
    try {
      // Create milestone record
      const { data: milestone, error: milestoneError } = await this.supabase
        .from('user_milestones')
        .insert({
          user_id: userId,
          milestone_type: milestoneType,
          title,
          description,
          milestone_data: milestoneData
        })
        .select()
        .single()

      if (milestoneError) {
        console.error('Error creating milestone:', milestoneError)
        throw milestoneError
      }

      // Create notification
      await notificationsService.createMilestoneNotification(
        userId,
        milestone.id,
        title,
        description
      )

      console.log(`🎯 Milestone notification created for user ${userId}: ${title}`)
    } catch (error) {
      console.error('Error creating milestone notification:', error)
      throw error
    }
  }

  // Quiz Streak Milestones
  async checkQuizStreakMilestone(userId: string, currentStreak: number): Promise<void> {
    const milestoneThresholds = [3, 7, 14, 30, 60, 100]
    
    if (milestoneThresholds.includes(currentStreak)) {
      const title = `🔥 ${currentStreak} Day Quiz Streak!`
      const description = `Congratulations! You've maintained a ${currentStreak} day quiz streak. Keep up the excellent work!`
      
      await this.createMilestoneNotification(
        userId,
        'quiz_streak',
        title,
        description,
        { streak_count: currentStreak }
      )
    }
  }

  // Questions Answered Milestones
  async checkQuestionsAnsweredMilestone(userId: string, totalAnswered: number): Promise<void> {
    const milestoneThresholds = [10, 50, 100, 250, 500, 1000, 2500, 5000]
    
    if (milestoneThresholds.includes(totalAnswered)) {
      const title = `📚 ${totalAnswered} Questions Answered!`
      const description = `Amazing progress! You've successfully answered ${totalAnswered} questions. Your dedication is paying off!`
      
      await this.createMilestoneNotification(
        userId,
        'questions_answered',
        title,
        description,
        { question_count: totalAnswered }
      )
    }
  }

  // Category Mastery Milestones
  async checkCategoryMasteryMilestone(
    userId: string, 
    categoryName: string, 
    accuracy: number
  ): Promise<void> {
    if (accuracy >= 90) {
      const title = `🎯 ${categoryName} Mastery!`
      const description = `Excellent! You've achieved mastery in ${categoryName} with ${accuracy}% accuracy. Time to tackle new challenges!`
      
      await this.createMilestoneNotification(
        userId,
        'category_mastery',
        title,
        description,
        { category_name: categoryName, accuracy }
      )
    }
  }

  // Perfect Score Achievement
  async createPerfectScoreNotification(
    userId: string,
    quizType: string,
    questionCount: number
  ): Promise<void> {
    const title = '⭐ Perfect Score Achievement!'
    const description = `Outstanding! You scored 100% on your ${quizType} quiz with ${questionCount} questions. Perfection achieved!`
    
    await this.createMilestoneNotification(
      userId,
      'perfect_score',
      title,
      description,
      { quiz_type: quizType, question_count: questionCount }
    )
  }

  // Study Time Milestones
  async checkStudyTimeMilestone(userId: string, totalHours: number): Promise<void> {
    const milestoneThresholds = [1, 5, 10, 25, 50, 100, 200]
    
    if (milestoneThresholds.includes(totalHours)) {
      const title = `⏰ ${totalHours} Hours of Study Time!`
      const description = `Impressive dedication! You've accumulated ${totalHours} hours of study time. Your commitment to learning shows!`
      
      await this.createMilestoneNotification(
        userId,
        'study_time',
        title,
        description,
        { hours: totalHours }
      )
    }
  }

  // Login Streak Milestones
  async checkLoginStreakMilestone(userId: string, loginStreak: number): Promise<void> {
    const milestoneThresholds = [7, 14, 30, 60, 100]
    
    if (milestoneThresholds.includes(loginStreak)) {
      const title = `📅 ${loginStreak} Day Login Streak!`
      const description = `Consistency is key! You've logged in for ${loginStreak} consecutive days. Your regular practice is building strong habits!`
      
      await this.createMilestoneNotification(
        userId,
        'login_streak',
        title,
        description,
        { days: loginStreak }
      )
    }
  }

  // Achievement Notifications (for goals, badges, etc.)
  async createAchievementNotification(
    userId: string,
    achievementType: string,
    title: string,
    description: string,
    achievementData: Record<string, any> = {}
  ): Promise<void> {
    await notificationsService.createAchievementNotification(userId, {
      title,
      message: description,
      metadata: {
        achievement_type: achievementType,
        achievement_data: achievementData
      }
    })

    console.log(`🏆 Achievement notification created for user ${userId}: ${title}`)
  }

  // Reminder Notifications
  async createReminderNotification(
    userId: string,
    reminderType: 'daily_quiz' | 'weekly_review' | 'goal_check' | 'study_break',
    title: string,
    message: string
  ): Promise<void> {
    try {
      // Create reminder record
      const { data: reminder, error: reminderError } = await this.supabase
        .from('user_reminders')
        .insert({
          user_id: userId,
          reminder_type: reminderType,
          title,
          message,
          frequency: reminderType === 'daily_quiz' ? 'daily' : 'weekly',
          next_reminder_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Next day
        })
        .select()
        .single()

      if (reminderError) {
        console.error('Error creating reminder:', reminderError)
        throw reminderError
      }

      // Create notification
      await notificationsService.createReminderNotification(
        userId,
        reminder.id,
        title,
        message
      )

      console.log(`⏰ Reminder notification created for user ${userId}: ${title}`)
    } catch (error) {
      console.error('Error creating reminder notification:', error)
      throw error
    }
  }

  // Helper method to get target users based on audience
  private async getTargetUsers(targetAudience: string): Promise<string[]> {
    let query = this.supabase.from('user_profiles').select('user_id')

    if (targetAudience !== 'all') {
      query = query.eq('role', targetAudience)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching target users:', error)
      throw error
    }

    return data?.map(user => user.user_id) || []
  }
}

export const notificationGenerators = new NotificationGenerators()
