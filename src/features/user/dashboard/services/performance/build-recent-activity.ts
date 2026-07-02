// Recent-activity feed for the dashboard: completed quizzes, in-progress
// quizzes, and freshly unlocked achievements, merged and capped at 10 items
// (with a welcome item when the user has no activity at all).

import { ACHIEVEMENT_DEFINITIONS } from "@/features/user/achievements/services/achievement-checker";
import type {
  CompletedSessionItem,
  PendingSessionItem,
  RecentActivityItem,
  UnlockedAchievementRow,
} from "./types";

export interface RecentActivityInput {
  completedSessions: CompletedSessionItem[];
  pendingSessions: PendingSessionItem[];
  unlockedAchievements: UnlockedAchievementRow[] | null;
}

export function buildRecentActivity({
  completedSessions,
  pendingSessions,
  unlockedAchievements,
}: RecentActivityInput): RecentActivityItem[] {
  const recentActivity: RecentActivityItem[] = [];

  // Add completed quiz sessions
  completedSessions.forEach((session) => {
    const isCompleted = session.status === "completed";
    recentActivity.push({
      id: `session-${session.id}`,
      type: isCompleted ? "quiz_completed" : "quiz_started",
      title: isCompleted ? "Completed Quiz" : "Started Quiz",
      description: isCompleted ? "View detailed results" : "Continue where you left off",
      timestamp: session.completed_at || session.created_at,
      score: session.score,
      navigationUrl: isCompleted
        ? `/dashboard/quiz/${session.id}/results`
        : `/dashboard/quiz/${session.id}`,
    });
  });

  // Add pending quizzes (in-progress sessions)
  pendingSessions.forEach((session) => {
    recentActivity.push({
      id: `pending-${session.id}`,
      type: "quiz_started",
      title: "Quiz In Progress",
      description: session.title || "Continue where you left off",
      timestamp: session.created_at,
      navigationUrl: `/dashboard/quiz/${session.id}`,
    });
  });

  // Add recently unlocked achievements
  const recentAchievements = (unlockedAchievements || []).slice(0, 10);
  recentAchievements.forEach((achievement) => {
    const achievementDef = ACHIEVEMENT_DEFINITIONS.find(
      (def) => def.id === achievement.achievement_id
    );
    if (achievementDef) {
      recentActivity.push({
        id: `achievement-${achievement.id}`,
        type: "achievement_unlocked",
        title: `Achievement Unlocked: ${achievementDef.title}`,
        description: achievementDef.description,
        timestamp: achievement.created_at,
        navigationUrl: "/dashboard/progress#achievements",
      });
    }
  });

  // Sort all activities by timestamp (most recent first) and limit to 10
  recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const limitedActivity = recentActivity.slice(0, 10);

  // If no activity, add welcome message
  if (limitedActivity.length === 0) {
    limitedActivity.push({
      id: "welcome-1",
      type: "welcome",
      title: "Start Your First Quiz",
      description: "Take a quick starter quiz to see how we track your progress.",
      timestamp: new Date().toISOString(),
    });
  }

  return limitedActivity;
}
