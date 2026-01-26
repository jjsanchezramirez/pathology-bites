// src/lib/dashboard/service.ts

export interface DashboardStats {
  totalQuestions: number;
  totalUsers: number;
  totalImages: number;
  totalInquiries: number;
  pendingQuestions: number;
  rejectedQuestions: number; // Add rejected questions for creators/admins
  activeUsers: number;
  recentQuestions: number;
  unreadInquiries: number;
  questionReports: number;
  pendingReports: number;
  draftQuestions: number; // Add draft questions
  flaggedQuestions: number; // Add flagged questions
}

export interface RecentActivity {
  id: string;
  type:
    | "question"
    | "user"
    | "inquiry"
    | "image"
    | "quiz_completed"
    | "quiz_started"
    | "study_streak"
    | "performance_milestone"
    | "achievement_unlocked";
  title: string;
  description: string;
  timestamp: string;
  user?: string;
  // Enhanced properties for the new system
  timeGroup?: string;
  score?: number;
  navigationUrl?: string;
  priority?: "low" | "medium" | "high";
  metadata?: Record<string, unknown>;
}

export interface QuickAction {
  title: string;
  description: string;
  count?: number;
  href: string;
  urgent?: boolean;
  permission?: string;
  adminOnly?: boolean;
}

export interface QuickAction {
  title: string;
  description: string;
  count?: number;
  href: string;
  urgent?: boolean;
  permission?: string;
  adminOnly?: boolean;
}
