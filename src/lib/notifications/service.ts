// src/lib/notifications/service.ts
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/supabase'

type NotificationState = Database['public']['Tables']['notification_states']['Row']
type Inquiry = Database['public']['Tables']['inquiries']['Row']
type QuestionReport = Database['public']['Tables']['question_reports']['Row']

export interface NotificationWithSource {
  id: string
  user_id: string
  source_type: 'inquiry' | 'report'
  source_id: string
  read: boolean
  created_at: string
  updated_at: string
  // Source data
  title: string
  description: string
  status: string
  metadata: Record<string, any>
}

export class NotificationsService {
  private supabase = createClient()

  async getNotifications(userId: string, filter: 'all' | 'inquiry' | 'report' = 'all'): Promise<NotificationWithSource[]> {
    try {
      console.log('🔔 NotificationsService.getNotifications called with:', { userId, filter })

      // Build the query for notification_states
      let query = this.supabase
        .from('notification_states')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      // Apply filter
      if (filter !== 'all') {
        query = query.eq('source_type', filter)
      }

      const { data: notificationStates, error } = await query

      console.log('🔔 Notification states query result:', {
        notificationStates,
        error,
        count: notificationStates?.length,
        userId
      })

      if (error) {
        console.error('Error fetching notification states:', error)
        throw error
      }

      if (!notificationStates || notificationStates.length === 0) {
        console.log('🔔 No notification states found for user:', userId)
        return []
      }

      // Group by source type for efficient fetching
      const inquiryIds = notificationStates
        .filter(n => n.source_type === 'inquiry')
        .map(n => n.source_id)

      const reportIds = notificationStates
        .filter(n => n.source_type === 'report')
        .map(n => n.source_id)

      // Fetch source data
      const [inquiries, reports] = await Promise.all([
        inquiryIds.length > 0 ? this.getInquiries(inquiryIds) : [],
        reportIds.length > 0 ? this.getReports(reportIds) : []
      ])

      // Create lookup maps
      const inquiryMap = new Map(inquiries.map(i => [i.id, i]))
      const reportMap = new Map(reports.map(r => [r.id, r]))

      // Combine notification states with source data
      const notifications: NotificationWithSource[] = notificationStates
        .map(state => {
          if (state.source_type === 'inquiry') {
            const inquiry = inquiryMap.get(state.source_id)
            if (!inquiry) return null

            return {
              ...state,
              source_type: 'inquiry' as const,
              title: `${inquiry.request_type === 'general' ? 'General' : 'Technical'} Inquiry`,
              description: `${inquiry.first_name} ${inquiry.last_name} submitted an inquiry`,
              status: 'pending', // Inquiries don't have status field, default to pending
              metadata: {
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
              source_type: 'report' as const,
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
          return null
        })
        .filter((n): n is NotificationWithSource => n !== null)

      return notifications
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
}

export const notificationsService = new NotificationsService()
