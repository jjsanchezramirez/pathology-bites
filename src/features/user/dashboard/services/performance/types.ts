// Shared types for the unified /api/user/performance-data endpoint and its
// pure calculators. Hoisted out of the route handler; shapes are unchanged.

import type { UserStats } from "@/features/user/achievements/services/achievement-checker";

/** Attempt fields selected by the sessions query's `quiz_attempts!inner(...)` join. */
export interface QuizAttemptItem {
  question_id: string;
  is_correct: boolean | null;
  time_spent: number | null;
  attempted_at: string;
}

/** Windowed sessions row (100 most recent, inner-joined attempts). */
export interface SessionWithAttempts {
  id: string;
  title: string | null;
  created_at: string;
  completed_at: string | null;
  score: number | null;
  status: string;
  total_questions: number;
  total_time_spent: number | null;
  quiz_attempts: QuizAttemptItem[];
}

/** Attempt flattened together with its parent-session context. */
export interface FlattenedAttempt extends QuizAttemptItem {
  session_id: string;
  session_created_at: string;
  session_completed_at: string | null;
  session_score: number | null;
  session_status: string;
}

export interface QuestionBasic {
  id: string;
  category_id: string | null;
}

export interface CategoryBasic {
  id: string;
  name: string;
}

/** Full categories row as selected for quiz-init processing. */
export interface CategoryItem {
  id: string;
  name: string;
  short_form: string | null;
  parent_id: string | null;
  level: number;
}

export interface CompletedSessionTimelineRow {
  completed_at: string | null;
  score: number | null;
}

export interface TimelinePoint {
  date: string;
  accuracy: number;
  quizzes: number;
}

export interface HeatmapDay {
  date: string;
  quizzes: number;
  questions: number;
}

export interface HeatmapStats {
  avgQuestionsPerDay: number;
  avgQuizzesPerDay: string;
  longestStreak: number;
  currentStreak: number;
  totalQuestions: number;
  totalQuizzes: number;
  daysWithActivity: number;
}

export interface SubjectSummary {
  name: string;
  score: number;
  attempts: number;
}

export interface RecentPerformancePoint {
  date: string;
  accuracy: number;
  questions_answered: number;
}

export interface CategoryDetail {
  category_id: string;
  category_name: string;
  total_attempts: number;
  correct_attempts: number;
  accuracy: number;
  average_time: number;
  last_attempt_at: string;
  recent_performance: RecentPerformancePoint[];
  trend?: "up" | "down" | "stable";
}

export interface RecentActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  timeGroup?: string;
  score?: number;
  navigationUrl?: string;
}

/** Session fields consumed by the recent-activity builder (completed sessions). */
export interface CompletedSessionItem {
  id: string;
  status: string;
  completed_at: string | null;
  created_at: string;
  title: string | null;
  score: number | null;
}

/** Session fields consumed by the recent-activity builder (in-progress sessions). */
export interface PendingSessionItem {
  id: string;
  status: string;
  created_at: string;
  title: string | null;
}

/** Row from the user_achievements table. */
export interface UnlockedAchievementRow {
  id: string;
  achievement_id: string;
  created_at: string;
}

/**
 * Achievement definition as consumed by the progress calculator — either a DB
 * row from the `achievements` table (snake_case `animation_type`) or a
 * hardcoded fallback from ACHIEVEMENT_DEFINITIONS (camelCase `animationType`).
 */
export interface AchievementDefinitionLike {
  id: string;
  title: string;
  description: string;
  category: string;
  requirement: number;
  animation_type?: string;
  animationType?: string;
}

export interface SessionTitleItem {
  title: string | null;
}

export interface QuizQuestionStats {
  all: number;
  unused: number;
  needsReview: number;
  marked: number;
  mastered: number;
}

/** Row returned by the get_user_category_stats RPC. */
export interface UserStatItem {
  category_id: string;
  all_count: number;
  unused_count: number;
  incorrect_count: number;
  marked_count: number;
  correct_count: number;
}

export interface QuizInitCategory {
  id: string;
  name: string;
  shortName: string;
  parent: "AP" | "CP";
  questionStats: QuizQuestionStats;
}

export interface UnifiedPerformanceResponse {
  success: boolean;
  data: {
    // Summary statistics
    summary: {
      overallScore: number;
      completedQuizzes: number;
      totalAttempts: number;
      correctAttempts: number;
      userPercentile: number;
      peerRank: number;
      totalUsers: number;
    };

    // Subjects for improvement and mastered
    subjects: {
      needsImprovement: SubjectSummary[];
      mastered: SubjectSummary[];
    };

    // Timeline data (all-time, daily granularity)
    timeline: TimelinePoint[];

    // Category details (for radar chart and category breakdown)
    categories: CategoryDetail[];

    // Activity heatmap (last 365 days)
    heatmap: {
      data: HeatmapDay[];
      stats: HeatmapStats;
    };

    // Achievements data
    achievements: {
      stats: UserStats;
      definitions: Array<{
        id: string;
        title: string;
        description: string;
        category: string;
        requirement: number;
        animation_type: string;
      }>;
      progress: Array<{
        id: string;
        requirement: number;
        isUnlocked: boolean;
        progress: number;
        unlockedDate?: string;
      }>;
    };

    // Dashboard-specific data
    dashboard: {
      allQuestions: number;
      needsReview: number;
      mastered: number;
      unused: number;
      totalQuestions: number;
      completedQuestions: number;
      averageScore: number;
      studyStreak: number;
      recentQuizzes: number;
      weeklyGoal: number;
      currentWeekProgress: number;
      recentActivity: RecentActivityItem[];
    };

    // Quiz initialization data (for /dashboard/quiz/new page)
    quizInit: {
      sessionTitles: string[];
      categories: QuizInitCategory[];
      questionTypeStats: {
        all: QuizQuestionStats;
        ap_only: QuizQuestionStats;
        cp_only: QuizQuestionStats;
      };
    };
  };
}
