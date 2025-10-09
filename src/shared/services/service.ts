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
  private getSupabase() {
    return createClient()
  }

  async getNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedNotifications> {
    try {

      // Calculate offset
      const offset = (page - 1) * limit

      // Get total count first
      const { count: totalCount, error: countError } = await this.getSupabase()
        .from('notification_states')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (countError) {
        throw countError
      }

      // Build the query for notification_states with pagination
      const { data: notificationStates, error } = await this.getSupabase()
        .from('notification_states')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)


      if (error) {
        throw error
      }

      if (!notificationStates || notificationStates.length === 0) {
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


      // Fetch source data for existing tables only
      const [inquiries, reports] = await Promise.all([
        sourceIdsByType.inquiry?.length > 0 ? this.getInquiries(sourceIdsByType.inquiry) : [],
        sourceIdsByType.report?.length > 0 ? this.getReports(sourceIdsByType.report) : []
      ])

      // Create lookup maps for existing source types
      const inquiryMap = new Map(inquiries.map(i => [i.id, i] as const))
      const reportMap = new Map(reports.map(r => [r.id, r] as const))

      // Combine notification states with source data
      const notifications: NotificationWithSource[] = notificationStates
        .map(state => {
          if (state.source_type === 'inquiry') {
            const inquiry = inquiryMap.get(state.source_id)
            if (!inquiry) return null

            return {
              ...state,
              title: `${inquiry.request_type === 'general' ? 'General' : 'Technical'} Inquiry`,
              description: `${inquiry.first_name} ${inquiry.last_name} submitted an inquiry`,
              status: 'pending',
              metadata: {
                email: inquiry.email,
                organization: inquiry.organization,
                request_type: inquiry.request_type,
                inquiry_text: inquiry.inquiry
              }
            }
          }

          else if (state.source_type === 'report') {
            const report = reportMap.get(state.source_id)
            if (!report) return null

            return {
              ...state,
              title: 'Question Report',
              description: `Question reported for ${report.report_type}`,
              status: report.status,
              metadata: {
                question_id: report.question_id,
                report_type: report.report_type,
                description: report.description,
                reported_by: report.reported_by
              }
            }
          }

          // Handle direct notification types (no separate source table needed)
          else if (state.source_type === 'admin_alert') {
            return {
              ...state,
              title: 'Admin Alert',
              description: 'New admin activity requires attention',
              status: 'pending',
              metadata: {}
            }
          }

          else if (state.source_type === 'question_review') {
            return {
              ...state,
              title: 'Question Review Required',
              description: 'A question needs your review',
              status: 'pending',
              metadata: {}
            }
          }

          else if (state.source_type === 'question_status') {
            return {
              ...state,
              title: 'Question Status Update',
              description: 'Your question status has changed',
              status: 'updated',
              metadata: {}
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
      throw error
    }
  }

  private async getInquiries(ids: string[]): Promise<Inquiry[]> {
    if (ids.length === 0) return []

    const { data, error } = await this.getSupabase()
      .from('inquiries')
      .select('*')
      .in('id', ids)

    if (error) {
      throw error
    }

    return data || []
  }

  private async getReports(ids: string[]): Promise<QuestionReport[]> {
    if (ids.length === 0) return []

    const { data, error } = await this.getSupabase()
      .from('question_reports')
      .select('*')
      .in('id', ids)

    if (error) {
      throw error
    }

    return data || []
  }

  // Simple notification creation for admin dashboard events
  async createAdminNotification(
    userId: string,
    sourceType: 'admin_alert' | 'question_review' | 'question_status',
    sourceId: string
  ): Promise<void> {
    const { error } = await this.getSupabase()
      .from('notification_states')
      .insert({
        user_id: userId,
        source_type: sourceType,
        source_id: sourceId,
        read: false
      })

    if (error) {
      throw error
    }
  }

  // Create notifications for role-appropriate events
  async createRoleBasedNotifications(
    userRole: string,
    eventType: 'question_submitted' | 'question_approved' | 'question_rejected' | 'new_user_registered',
    sourceId: string,
    targetUserId?: string
  ): Promise<void> {
    try {
      // Get users based on role who should receive this notification
      let targetUsers: string[] = []

      if (targetUserId) {
        targetUsers = [targetUserId]
      } else {
        // Get users by role
        const { data: users } = await this.getSupabase()
          .from('user_profiles')
          .select('user_id')
          .eq('role', userRole)
          .eq('status', 'active')

        targetUsers = users?.map(u => u.user_id) || []
      }

      // Create notifications for each target user
      const notifications = targetUsers.map(userId => ({
        user_id: userId,
        source_type: eventType === 'question_submitted' ? 'question_review' :
                    eventType === 'new_user_registered' ? 'admin_alert' : 'question_status',
        source_id: sourceId,
        read: false
      }))

      if (notifications.length > 0) {
        const { error } = await this.getSupabase()
          .from('notification_states')
          .insert(notifications)

        if (error) {
          throw error
        }
      }
    } catch (error) {
      console.error('Error creating role-based notifications:', error)
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await this.getSupabase()
      .from('notification_states')
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq('id', notificationId)

    if (error) {
      throw error
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await this.getSupabase()
      .from('notification_states')
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('read', false)

    if (error) {
      throw error
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await this.getSupabase()
      .from('notification_states')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)

    if (error) {
      throw error
    }

    return count || 0
  }

  // Test method to create sample notifications for different roles
  async createTestNotifications(): Promise<void> {
    try {
      // Get admin users
      const { data: adminUsers } = await this.getSupabase()
        .from('user_profiles')
        .select('user_id')
        .eq('role', 'admin')
        .limit(5)

      // Get creator users
      const { data: creatorUsers } = await this.getSupabase()
        .from('user_profiles')
        .select('user_id')
        .eq('role', 'creator')
        .limit(5)

      // Get reviewer users
      const { data: reviewerUsers } = await this.getSupabase()
        .from('user_profiles')
        .select('user_id')
        .eq('role', 'reviewer')
        .limit(5)

      const notifications = []

      // Create admin notifications
      if (adminUsers?.length) {
        for (const user of adminUsers) {
          notifications.push({
            user_id: user.user_id,
            source_type: 'admin_alert',
            source_id: `admin_${Date.now()}_${Math.random()}`,
            read: false
          })
        }
      }

      // Create creator notifications
      if (creatorUsers?.length) {
        for (const user of creatorUsers) {
          notifications.push({
            user_id: user.user_id,
            source_type: 'question_status',
            source_id: `creator_${Date.now()}_${Math.random()}`,
            read: false
          })
        }
      }

      // Create reviewer notifications
      if (reviewerUsers?.length) {
        for (const user of reviewerUsers) {
          notifications.push({
            user_id: user.user_id,
            source_type: 'question_review',
            source_id: `reviewer_${Date.now()}_${Math.random()}`,
            read: false
          })
        }
      }

      if (notifications.length > 0) {
        const { error } = await this.getSupabase()
          .from('notification_states')
          .insert(notifications)

        if (error) {
          throw error
        }
      }
    } catch (error) {
      console.error('Error creating test notifications:', error)
    }
  }
}

export const notificationsService = new NotificationsService()
