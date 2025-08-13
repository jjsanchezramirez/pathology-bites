// src/lib/notifications/service.ts
import { createClient } from '@/shared/services/client'
import { Database } from '@/shared/types/supabase'
import {
  NotificationWithSource,
  PaginatedNotifications,
  NotificationSourceType,
  SystemUpdatePayload,
  MilestonePayload,
  ReminderPayload
} from '@/shared/types/notifications'

type NotificationState = Database['public']['Tables']['notification_states']['Row']
type Inquiry = Database['public']['Tables']['inquiries']['Row']
type QuestionReport = Database['public']['Tables']['question_reports']['Row']

// Extended types for new notification sources
interface SystemUpdate {
  id: string
  title: string
  message: string
  update_type: string
  severity: string
  target_audience: string
  published_at: string
  expires_at?: string
  metadata: Record<string, any>
}

interface UserMilestone {
  id: string
  user_id: string
  milestone_type: string
  title: string
  description: string
  milestone_data: Record<string, any>
  achieved_at: string
}

interface UserReminder {
  id: string
  user_id: string
  reminder_type: string
  title: string
  message: string
  frequency: string
  metadata: Record<string, any>
}

export class NotificationsService {
  private supabase = createClient()

  async getNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedNotifications> {
    try {
      console.log('🔔 NotificationsService.getNotifications called with:', { userId, page, limit })

      // Calculate offset
      const offset = (page - 1) * limit

      // Get total count first
      const { count: totalCount, error: countError } = await this.supabase
        .from('notification_states')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (countError) {
        console.error('Error fetching notification count:', countError)
        throw countError
      }

      // Build the query for notification_states with pagination
      const { data: notificationStates, error } = await this.supabase
        .from('notification_states')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      console.log('🔔 Notification states query result:', {
        notificationStates,
        error,
        count: notificationStates?.length,
        totalCount,
        page,
        limit,
        userId
      })

      if (error) {
        console.error('Error fetching notification states:', error)
        throw error
      }

      if (!notificationStates || notificationStates.length === 0) {
        console.log('🔔 No notification states found for user:', userId)
        return {
          notifications: [],
          total: totalCount || 0,
          page,
          limit,
          hasMore: false
        }
      }

      // Group source IDs by type for efficient fetching
      const sourceIdsByType = notificationStates.reduce((acc, state) => {
        if (!acc[state.source_type]) {
          acc[state.source_type] = []
        }
        acc[state.source_type].push(state.source_id)
        return acc
      }, {} as Record<string, string[]>)

      console.log('🔔 Source IDs by type:', sourceIdsByType)

      // Fetch source data for all types in parallel
      const [inquiries, reports, systemUpdates, milestones, reminders] = await Promise.all([
        sourceIdsByType.inquiry?.length > 0 ? this.getInquiries(sourceIdsByType.inquiry) : [],
        sourceIdsByType.report?.length > 0 ? this.getReports(sourceIdsByType.report) : [],
        sourceIdsByType.system_update?.length > 0 ? this.getSystemUpdates(sourceIdsByType.system_update) : [],
        sourceIdsByType.milestone?.length > 0 ? this.getMilestones(sourceIdsByType.milestone) : [],
        sourceIdsByType.reminder?.length > 0 ? this.getReminders(sourceIdsByType.reminder) : []
      ])

      // Create lookup maps for all source types
      const inquiryMap = new Map(inquiries.map(i => [i.id, i] as const))
      const reportMap = new Map(reports.map(r => [r.id, r] as const))
      const systemUpdateMap = new Map(systemUpdates.map(u => [u.id, u] as const))
      const milestoneMap = new Map(milestones.map(m => [m.id, m] as const))
      const reminderMap = new Map(reminders.map(r => [r.id, r] as const))

      // Combine notification states with source data
      const notifications: NotificationWithSource[] = notificationStates
        .map(state => {
          // Handle legacy admin notifications
          if (state.source_type === 'inquiry') {
            const inquiry = inquiryMap.get(state.source_id)
            if (!inquiry) return null

            return {
              ...state,
              title: state.title || `${inquiry.request_type === 'general' ? 'General' : 'Technical'} Inquiry`,
              description: state.message || `${inquiry.first_name} ${inquiry.last_name} submitted an inquiry`,
              status: 'pending',
              metadata: {
                ...state.metadata,
                email: inquiry.email,
                organization: inquiry.organization,
                request_type: inquiry.request_type,
                inquiry_text: inquiry.inquiry
              }
            }
          } else if (state.source_type === 'report') {
            const report = reportMap.get(state.source_id)
            if (!report) return null

            return {
              ...state,
              title: state.title || 'Question Report',
              description: state.message || `Question reported for ${report.report_type}`,
              status: report.status,
              metadata: {
                ...state.metadata,
                question_id: report.question_id,
                report_type: report.report_type,
                description: report.description,
                reported_by: report.reported_by
              }
            }
          }

          // Handle new user notification types
          else if (state.source_type === 'system_update') {
            const update = systemUpdateMap.get(state.source_id)
            if (!update) return null

            return {
              ...state,
              title: state.title || update.title,
              description: state.message || update.message,
              status: 'published',
              metadata: {
                ...state.metadata,
                update_type: update.update_type,
                severity: update.severity,
                target_audience: update.target_audience
              }
            }
          } else if (state.source_type === 'milestone') {
            const milestone = milestoneMap.get(state.source_id)
            if (!milestone) return null

            return {
              ...state,
              title: state.title || milestone.title,
              description: state.message || milestone.description,
              status: 'achieved',
              metadata: {
                ...state.metadata,
                milestone_type: milestone.milestone_type,
                milestone_data: milestone.milestone_data,
                achieved_at: milestone.achieved_at
              }
            }
          } else if (state.source_type === 'reminder') {
            const reminder = reminderMap.get(state.source_id)
            if (!reminder) return null

            return {
              ...state,
              title: state.title || reminder.title,
              description: state.message || reminder.message,
              status: 'active',
              metadata: {
                ...state.metadata,
                reminder_type: reminder.reminder_type,
                frequency: reminder.frequency
              }
            }
          }

          return null
        })
        .filter((n): n is NotificationWithSource => n !== null)

      const hasMore = (totalCount || 0) > page * limit

      return {
        notifications,
        total: totalCount || 0,
        page,
        limit,
        hasMore
      }
    } catch (error) {
      console.error('Error in getNotifications:', error)
      throw error
    }
  }

  private async getInquiries(ids: string[]): Promise<Inquiry[]> {
    if (ids.length === 0) return []

    const { data, error } = await this.supabase
      .from('inquiries')
      .select('*')
      .in('id', ids)

    if (error) {
      console.error('Error fetching inquiries:', error)
      throw error
    }

    return data || []
  }

  private async getReports(ids: string[]): Promise<QuestionReport[]> {
    if (ids.length === 0) return []

    const { data, error } = await this.supabase
      .from('question_reports')
      .select('*')
      .in('id', ids)

    if (error) {
      console.error('Error fetching reports:', error)
      throw error
    }

    return data || []
  }

  private async getSystemUpdates(ids: string[]): Promise<SystemUpdate[]> {
    if (ids.length === 0) return []

    const { data, error } = await this.supabase
      .from('system_updates')
      .select('*')
      .in('id', ids)

    if (error) {
      console.error('Error fetching system updates:', error)
      throw error
    }

    return data || []
  }

  private async getMilestones(ids: string[]): Promise<UserMilestone[]> {
    if (ids.length === 0) return []

    const { data, error } = await this.supabase
      .from('user_milestones')
      .select('*')
      .in('id', ids)

    if (error) {
      console.error('Error fetching milestones:', error)
      throw error
    }

    return data || []
  }

  private async getReminders(ids: string[]): Promise<UserReminder[]> {
    if (ids.length === 0) return []

    const { data, error } = await this.supabase
      .from('user_reminders')
      .select('*')
      .in('id', ids)

    if (error) {
      console.error('Error fetching reminders:', error)
      throw error
    }

    return data || []
  }

  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('notification_states')
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq('id', notificationId)

    if (error) {
      console.error('Error marking notification as read:', error)
      throw error
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('notification_states')
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('read', false)

    if (error) {
      console.error('Error marking all notifications as read:', error)
      throw error
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('notification_states')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)

    if (error) {
      console.error('Error getting unread count:', error)
      throw error
    }

    return count || 0
  }

  // Notification creation methods
  async createSystemUpdateNotification(
    systemUpdateId: string,
    targetUserIds: string[]
  ): Promise<void> {
    const notifications = targetUserIds.map(userId => ({
      user_id: userId,
      source_type: 'system_update',
      source_id: systemUpdateId,
      read: false
    }))

    const { error } = await this.supabase
      .from('notification_states')
      .insert(notifications)

    if (error) {
      console.error('Error creating system update notifications:', error)
      throw error
    }
  }

  async createMilestoneNotification(
    userId: string,
    milestoneId: string,
    title?: string,
    message?: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('notification_states')
      .insert({
        user_id: userId,
        source_type: 'milestone',
        source_id: milestoneId,
        title,
        message,
        read: false
      })

    if (error) {
      console.error('Error creating milestone notification:', error)
      throw error
    }
  }

  async createReminderNotification(
    userId: string,
    reminderId: string,
    title?: string,
    message?: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('notification_states')
      .insert({
        user_id: userId,
        source_type: 'reminder',
        source_id: reminderId,
        title,
        message,
        read: false
      })

    if (error) {
      console.error('Error creating reminder notification:', error)
      throw error
    }
  }

  async createAchievementNotification(
    userId: string,
    achievementData: {
      title: string
      message: string
      metadata?: Record<string, any>
    }
  ): Promise<void> {
    // For achievements, we create a direct notification without a separate source table
    const { error } = await this.supabase
      .from('notification_states')
      .insert({
        user_id: userId,
        source_type: 'achievement',
        source_id: `achievement_${Date.now()}`, // Generate unique ID
        title: achievementData.title,
        message: achievementData.message,
        metadata: achievementData.metadata || {},
        read: false
      })

    if (error) {
      console.error('Error creating achievement notification:', error)
      throw error
    }
  }
}

export const notificationsService = new NotificationsService()
