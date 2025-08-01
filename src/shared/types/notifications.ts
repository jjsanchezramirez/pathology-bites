// src/types/notifications.ts
export interface BaseNotification {
  id: string
  user_id: string
  source_type: NotificationSourceType
  source_id: string
  read: boolean
  created_at: string
  updated_at: string
  title?: string
  message?: string
  metadata: Record<string, any>
}

export type NotificationSourceType =
  | 'inquiry'
  | 'report'
  | 'system_update'
  | 'milestone'
  | 'reminder'
  | 'page_update'
  | 'achievement'
  | 'goal_completion'
  | 'streak_milestone'
  | 'learning_path_update'

export interface NotificationWithSource extends BaseNotification {
  // Computed fields from source data
  title: string
  description: string
  status?: string
}

export interface PaginatedNotifications {
  notifications: NotificationWithSource[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// Legacy interfaces for backward compatibility
export interface InquiryNotification extends BaseNotification {
  source_type: 'inquiry'
  metadata: {
    inquiryId: string
    requestType: string
    email: string
    status: string
  }
}

export interface ReportNotification extends BaseNotification {
  source_type: 'report'
  metadata: {
    reportId: string
    questionId: string
    reportType: string
    reportedBy: string
    status: string
  }
}

// User-specific notification types
export interface SystemUpdateNotification extends BaseNotification {
  source_type: 'system_update'
  metadata: {
    updateType: 'maintenance' | 'feature' | 'announcement' | 'security'
    severity: 'info' | 'warning' | 'critical'
    targetAudience: string
  }
}

export interface MilestoneNotification extends BaseNotification {
  source_type: 'milestone'
  metadata: {
    milestoneType: string
    milestoneData: Record<string, any>
    achievedAt: string
  }
}

export interface ReminderNotification extends BaseNotification {
  source_type: 'reminder'
  metadata: {
    reminderType: 'daily_quiz' | 'weekly_review' | 'goal_check' | 'study_break'
    frequency: 'daily' | 'weekly' | 'monthly' | 'once'
  }
}

export interface AchievementNotification extends BaseNotification {
  source_type: 'achievement'
  metadata: {
    achievementType: string
    achievementData: Record<string, any>
  }
}

export type Notification =
  | InquiryNotification
  | ReportNotification
  | SystemUpdateNotification
  | MilestoneNotification
  | ReminderNotification
  | AchievementNotification

// Define types for the source data payloads
export interface InquiryPayload {
  id: string
  first_name: string
  last_name: string
  organization?: string
  request_type: string
  email: string
  status: string
  created_at: string
}

export interface ReportPayload {
  id: string
  question_id: string
  report_type: string
  reported_by: string
  status: string
  created_at: string
}

export interface SystemUpdatePayload {
  id: string
  title: string
  message: string
  update_type: string
  severity: string
  target_audience: string
  published_at: string
  expires_at?: string
}

export interface MilestonePayload {
  id: string
  user_id: string
  milestone_type: string
  title: string
  description: string
  milestone_data: Record<string, any>
  achieved_at: string
}

export interface ReminderPayload {
  id: string
  user_id: string
  reminder_type: string
  title: string
  message: string
  frequency: string
}