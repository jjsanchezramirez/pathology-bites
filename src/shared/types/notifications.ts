// src/types/notifications.ts
export interface BaseNotification {
  id: string;
  user_id: string;
  source_type: NotificationSourceType;
  source_id: string;
  read: boolean;
  created_at: string;
  updated_at: string;
  title?: string;
  message?: string;
  metadata: Record<string, unknown>;
}

export type NotificationSourceType =
  | "inquiry"
  | "report"
  | "admin_alert"
  | "question_review"
  | "question_status"
  | "system_update"
  | "milestone"
  | "reminder"
  | "page_update"
  | "achievement"
  | "goal_completion"
  | "streak_milestone"
  | "learning_path_update";

export interface NotificationWithSource extends BaseNotification {
  // Computed fields from source data
  title: string;
  description: string;
  status?: string;
}

export interface PaginatedNotifications {
  notifications: NotificationWithSource[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Define types for the source data payloads
export interface InquiryPayload {
  id: string;
  first_name: string;
  last_name: string;
  organization?: string;
  request_type: string;
  email: string;
  status: string;
  created_at: string;
}

export interface ReportPayload {
  id: string;
  question_id: string;
  report_type: string;
  reported_by: string;
  status: string;
  created_at: string;
}

export interface SystemUpdatePayload {
  id: string;
  title: string;
  message: string;
  update_type: string;
  severity: string;
  target_audience: string;
  published_at: string;
  expires_at?: string;
}

export interface MilestonePayload {
  id: string;
  user_id: string;
  milestone_type: string;
  title: string;
  description: string;
  milestone_data: Record<string, unknown>;
  achieved_at: string;
}

export interface ReminderPayload {
  id: string;
  user_id: string;
  reminder_type: string;
  title: string;
  message: string;
  frequency: string;
}
