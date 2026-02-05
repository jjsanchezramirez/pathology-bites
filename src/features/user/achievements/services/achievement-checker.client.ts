// src/features/achievements/services/achievement-checker.client.ts
// CLIENT-SIDE achievement checking logic

import type { QuizResult } from "@/features/user/quiz/types/quiz";
import type { UserStats } from "./achievement-checker";
import {
  ACHIEVEMENT_DEFINITIONS,
  checkAchievements,
  checkSequentialAchievements,
  checkSpeedAchievements,
} from "./achievement-checker";

/**
 * Calculate which achievements should be unlocked after completing a quiz
 * This runs CLIENT-SIDE before calling the /complete endpoint
 *
 * @param quizResult - The completed quiz result (or minimal quiz data)
 * @param currentStats - Current user stats from cache
 * @param unlockedAchievementIds - Array of already unlocked achievement IDs
 * @returns Array of achievement IDs to unlock
 */
export function calculateAchievementsToUnlock(
  quizResult: Pick<QuizResult, "totalQuestions" | "totalTimeSpent" | "score">,
  currentStats: UserStats,
  unlockedAchievementIds: string[]
): string[] {
  const unlockedSet = new Set(unlockedAchievementIds);
  const achievementsToUnlock: string[] = [];

  // 1. Check speed achievements (non-sequential, per-quiz based)
  const speedAchievements = checkSpeedAchievements(
    quizResult.totalQuestions,
    quizResult.totalTimeSpent,
    quizResult.score,
    unlockedSet
  );
  achievementsToUnlock.push(...speedAchievements);

  // 2. Update stats with new quiz data
  const updatedStats: UserStats = {
    ...currentStats,
    totalQuizzes: currentStats.totalQuizzes + 1,
    perfectScores: currentStats.perfectScores + (quizResult.score === 100 ? 1 : 0),
    // Note: currentStreak, longestStreak, accuracy, and differential stats
    // are complex to calculate client-side, so we rely on server validation
    // The server will re-check all achievements anyway
  };

  // 3. Check stat-based achievements (quiz, perfect, streak, accuracy, differential)
  const qualified = checkAchievements(updatedStats);

  // 4. Filter to sequential achievements (only next one per category)
  const sequential = checkSequentialAchievements(qualified, unlockedSet);

  // 5. Add stat-based achievements to unlock list
  achievementsToUnlock.push(...sequential.map((a) => a.id));

  // Remove duplicates and filter out already unlocked
  const uniqueAchievements = [...new Set(achievementsToUnlock)].filter(
    (id) => !unlockedSet.has(id)
  );

  console.log("[Client Achievement Check] Calculated achievements to unlock:", uniqueAchievements);
  console.log("[Client Achievement Check] Speed achievements:", speedAchievements);
  console.log(
    "[Client Achievement Check] Sequential achievements:",
    sequential.map((a) => a.id)
  );

  return uniqueAchievements;
}

/**
 * Calculate achievement progress for display
 * This is used for caching achievement progress on the client
 * Returns optimized structure without redundant fields (title, description, category, animationType)
 */
export function calculateAchievementProgress(
  stats: UserStats,
  unlockedAchievementIds: string[]
): Array<{
  id: string;
  requirement: number;
  isUnlocked: boolean;
  progress: number;
  unlockedDate?: string;
}> {
  const unlockedSet = new Set(unlockedAchievementIds);

  return ACHIEVEMENT_DEFINITIONS.map((def) => {
    const isUnlocked = unlockedSet.has(def.id);
    let progress = 0;
    let requirement = def.requirement;

    // Calculate progress based on achievement category
    switch (def.category) {
      case "quiz":
        progress = Math.min(stats.totalQuizzes, def.requirement);
        break;
      case "perfect":
        progress = Math.min(stats.perfectScores, def.requirement);
        break;
      case "streak":
        progress = Math.min(stats.longestStreak, def.requirement);
        break;
      case "speed":
        // Speed achievements are binary: unlocked or not
        // Progress is 1 if unlocked, 0 otherwise
        progress = isUnlocked ? 1 : 0;
        break;
      case "accuracy":
        // Map accuracy achievements to their respective stats
        if (def.id === "accuracy-50-3")
          progress = Math.min(stats.accuracyOver3 || 0, def.requirement);
        else if (def.id === "accuracy-60-5")
          progress = Math.min(stats.accuracyOver5 || 0, def.requirement);
        else if (def.id === "accuracy-70-8")
          progress = Math.min(stats.accuracyOver8 || 0, def.requirement);
        else if (def.id === "accuracy-80-10")
          progress = Math.min(stats.accuracyOver10 || 0, def.requirement);
        else if (def.id === "accuracy-90-12")
          progress = Math.min(stats.accuracyOver12 || 0, def.requirement);
        else if (def.id === "accuracy-100-15")
          progress = Math.min(stats.accuracyOver15 || 0, def.requirement);
        break;
      case "differential":
        if (def.id === "differential-10-3")
          progress = Math.min(stats.subjectsWith10Questions || 0, def.requirement);
        else if (def.id === "differential-25-10")
          progress = Math.min(stats.subjectsWith25Questions || 0, def.requirement);
        else if (def.id === "differential-50-20")
          progress = Math.min(stats.subjectsWith50Questions || 0, def.requirement);
        else if (def.id === "differential-100-all") {
          // Dynamic requirement based on total categories
          requirement = stats.totalCategories || def.requirement;
          progress = Math.min(stats.subjectsWith100Questions || 0, requirement);
        }
        break;
    }

    return {
      id: def.id,
      requirement,
      isUnlocked,
      progress,
      // Don't set unlockedDate client-side - this comes from server
    };
  });
}
