// Achievement stat aggregation and per-achievement progress calculation,
// reusing data already fetched/computed by the performance endpoint.

import type { UserStats } from "@/features/user/achievements/services/achievement-checker";
import type { AchievementProgress } from "@/features/user/achievements/types/achievement";
import type {
  AchievementDefinitionLike,
  CategoryDetail,
  SessionWithAttempts,
  UnlockedAchievementRow,
} from "./types";

export interface AchievementStatsInput {
  /** Completed sessions from the 100-row window. */
  completedSessions: SessionWithAttempts[];
  categoryDetails: CategoryDetail[];
  /** Lifetime COUNT of completed quizzes — NOT the windowed sessions length. */
  lifetimeCompletedQuizzes: number;
  currentStreak: number;
  longestStreak: number;
}

/** Average score over the N most recent completed sessions (0 when fewer than N exist). */
function accuracyOverLast(sortedCompletedSessions: SessionWithAttempts[], n: number): number {
  return sortedCompletedSessions.length >= n
    ? Math.round(
        sortedCompletedSessions.slice(0, n).reduce((sum, s) => sum + (s.score || 0), 0) / n
      )
    : 0;
}

export function calculateAchievementStats({
  completedSessions,
  categoryDetails,
  lifetimeCompletedQuizzes,
  currentStreak,
  longestStreak,
}: AchievementStatsInput): UserStats {
  // Perfect scores (from the windowed completed sessions)
  const perfectScores = completedSessions.filter((s) => s.score === 100).length;

  // Accuracy over different quiz counts (most recent first)
  const sortedCompletedSessions = [...completedSessions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return {
    totalQuizzes: lifetimeCompletedQuizzes,
    perfectScores,
    currentStreak,
    longestStreak,
    accuracyOver3: accuracyOverLast(sortedCompletedSessions, 3),
    accuracyOver5: accuracyOverLast(sortedCompletedSessions, 5),
    accuracyOver8: accuracyOverLast(sortedCompletedSessions, 8),
    accuracyOver10: accuracyOverLast(sortedCompletedSessions, 10),
    accuracyOver12: accuracyOverLast(sortedCompletedSessions, 12),
    accuracyOver15: accuracyOverLast(sortedCompletedSessions, 15),
    subjectsWith10Questions: categoryDetails.filter((cat) => cat.correct_attempts >= 10).length,
    subjectsWith25Questions: categoryDetails.filter((cat) => cat.correct_attempts >= 25).length,
    subjectsWith50Questions: categoryDetails.filter((cat) => cat.correct_attempts >= 50).length,
    subjectsWith100Questions: categoryDetails.filter((cat) => cat.correct_attempts >= 100).length,
    totalCategories: categoryDetails.length,
  };
}

/** Calculate progress for all achievements against the user's current stats. */
export function calculateAchievementProgress(
  definitions: AchievementDefinitionLike[],
  unlockedAchievements: UnlockedAchievementRow[] | null,
  achievementStats: UserStats
): AchievementProgress[] {
  const unlockedIds = new Set((unlockedAchievements || []).map((a) => a.achievement_id));

  return definitions.map((def) => {
    const isUnlocked = unlockedIds.has(def.id);
    const userAchievement = unlockedAchievements?.find((a) => a.achievement_id === def.id);

    let progress = 0;
    let requirement = def.requirement;

    switch (def.category) {
      case "quiz":
        progress = Math.min(achievementStats.totalQuizzes, def.requirement);
        break;
      case "perfect":
        progress = Math.min(achievementStats.perfectScores, def.requirement);
        break;
      case "streak":
        progress = Math.min(achievementStats.longestStreak, def.requirement);
        break;
      case "speed":
        // Speed achievements are binary: unlocked or not
        // Progress is 1 if unlocked, 0 otherwise
        progress = isUnlocked ? 1 : 0;
        break;
      case "accuracy":
        // Show current accuracy as progress
        if (def.id === "accuracy-50-3") {
          progress = Math.min(achievementStats.accuracyOver3, def.requirement);
        } else if (def.id === "accuracy-60-5") {
          progress = Math.min(achievementStats.accuracyOver5, def.requirement);
        } else if (def.id === "accuracy-70-8") {
          progress = Math.min(achievementStats.accuracyOver8, def.requirement);
        } else if (def.id === "accuracy-80-10") {
          progress = Math.min(achievementStats.accuracyOver10, def.requirement);
        } else if (def.id === "accuracy-90-12") {
          progress = Math.min(achievementStats.accuracyOver12, def.requirement);
        } else if (def.id === "accuracy-100-15") {
          progress = Math.min(achievementStats.accuracyOver15, def.requirement);
        }
        break;
      case "differential":
        if (def.id === "differential-10-3") {
          progress = Math.min(achievementStats.subjectsWith10Questions, def.requirement);
        } else if (def.id === "differential-25-10") {
          progress = Math.min(achievementStats.subjectsWith25Questions, def.requirement);
        } else if (def.id === "differential-50-20") {
          progress = Math.min(achievementStats.subjectsWith50Questions, def.requirement);
        } else if (def.id === "differential-100-all") {
          if (achievementStats.totalCategories) {
            requirement = achievementStats.totalCategories;
            progress = achievementStats.subjectsWith100Questions;
          } else {
            progress = 0;
          }
        } else {
          progress = Math.min(achievementStats.subjectsWith100Questions, def.requirement);
        }
        break;
    }

    return {
      id: def.id,
      requirement,
      isUnlocked,
      progress,
      unlockedDate: userAchievement?.created_at,
    };
  });
}

/** Map definitions to the response shape, tolerating snake_case and camelCase sources. */
export function mapAchievementDefinitions(definitions: AchievementDefinitionLike[]) {
  return definitions.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    category: d.category,
    requirement: d.requirement,
    animation_type: d.animation_type || d.animationType, // Handle both snake_case and camelCase
  }));
}
