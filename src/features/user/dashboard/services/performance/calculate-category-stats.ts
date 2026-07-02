// Per-category performance: grouping attempts by category, accuracy/avg-time,
// 30-day recent performance with trend, and the needs-improvement / mastered
// subject buckets.

import type { CategoryDetail, FlattenedAttempt, SubjectSummary } from "./types";

export interface CategoryPerformance {
  /** Sorted by last attempt, most recent first. */
  categoryDetails: CategoryDetail[];
  /** Sorted by score ascending; only categories with >= 10 attempts and < 70% accuracy. */
  needsImprovement: SubjectSummary[];
  /** Sorted by score descending; only categories with >= 10 attempts and >= 85% accuracy. */
  mastered: SubjectSummary[];
}

interface CategoryAccumulator {
  total_attempts: number;
  correct_attempts: number;
  total_time: number;
  last_attempt_at: string;
  attempts: Array<{ is_correct: boolean; attempted_at: string; time_spent: number | null }>;
}

export function calculateCategoryPerformance(
  allAttempts: FlattenedAttempt[],
  questionCategoryMap: Map<string, string | null>,
  categoryMap: Map<string, string>
): CategoryPerformance {
  // Group attempts by category
  const categoryStatsMap = new Map<string, CategoryAccumulator>();

  allAttempts.forEach((attempt) => {
    const categoryId = questionCategoryMap.get(attempt.question_id);
    if (!categoryId) return;

    const stats = categoryStatsMap.get(categoryId) || {
      total_attempts: 0,
      correct_attempts: 0,
      total_time: 0,
      last_attempt_at: attempt.attempted_at,
      attempts: [],
    };

    stats.total_attempts++;
    if (attempt.is_correct) stats.correct_attempts++;
    stats.total_time += attempt.time_spent || 0;

    if (new Date(attempt.attempted_at) > new Date(stats.last_attempt_at)) {
      stats.last_attempt_at = attempt.attempted_at;
    }

    stats.attempts.push({
      is_correct: attempt.is_correct,
      attempted_at: attempt.attempted_at,
      time_spent: attempt.time_spent,
    });

    categoryStatsMap.set(categoryId, stats);
  });

  const needsImprovement: SubjectSummary[] = [];
  const mastered: SubjectSummary[] = [];

  // Calculate category details with recent performance
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const categoryDetails = Array.from(categoryStatsMap.entries()).map(([categoryId, stats]) => {
    const accuracy =
      stats.total_attempts > 0
        ? Math.round((stats.correct_attempts / stats.total_attempts) * 100)
        : 0;

    const avgTime =
      stats.total_attempts > 0 ? Math.round(stats.total_time / stats.total_attempts) : 0;

    // Add to needs improvement or mastered.
    // Minimum 10 attempts in either bucket — fewer attempts produce noisy accuracy
    // numbers (variance dominates signal) and surface subjects the user has barely
    // engaged with.
    if (accuracy < 70 && stats.total_attempts >= 10) {
      needsImprovement.push({
        name: categoryMap.get(categoryId) || "Unknown",
        score: accuracy,
        attempts: stats.total_attempts,
      });
    }

    if (accuracy >= 85 && stats.total_attempts >= 10) {
      mastered.push({
        name: categoryMap.get(categoryId) || "Unknown",
        score: accuracy,
        attempts: stats.total_attempts,
      });
    }

    // Calculate recent performance
    const recentAttempts = stats.attempts.filter((a) => new Date(a.attempted_at) >= thirtyDaysAgo);

    const dailyStats = new Map<string, { correct: number; total: number }>();
    recentAttempts.forEach((attempt) => {
      const date = new Date(attempt.attempted_at).toISOString().split("T")[0];
      const dayStats = dailyStats.get(date) || { correct: 0, total: 0 };
      dayStats.total++;
      if (attempt.is_correct) dayStats.correct++;
      dailyStats.set(date, dayStats);
    });

    const recentPerformance = Array.from(dailyStats.entries())
      .map(([date, dayStats]) => ({
        date,
        accuracy: Math.round((dayStats.correct / dayStats.total) * 100),
        questions_answered: dayStats.total,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7);

    // Calculate trend
    let trend: "up" | "down" | "stable" = "stable";
    if (recentPerformance.length >= 2) {
      const recentAccuracies = recentPerformance.slice(0, 3).map((p) => p.accuracy);
      const avgRecent =
        recentAccuracies.reduce((sum, acc) => sum + acc, 0) / recentAccuracies.length;

      if (avgRecent > accuracy + 5) {
        trend = "up";
      } else if (avgRecent < accuracy - 5) {
        trend = "down";
      }
    }

    return {
      category_id: categoryId,
      category_name: categoryMap.get(categoryId) || "Unknown Category",
      total_attempts: stats.total_attempts,
      correct_attempts: stats.correct_attempts,
      accuracy,
      average_time: avgTime,
      last_attempt_at: stats.last_attempt_at,
      recent_performance: recentPerformance,
      trend,
    };
  });

  // Sort categories by last attempt (most recent first)
  categoryDetails.sort(
    (a, b) => new Date(b.last_attempt_at).getTime() - new Date(a.last_attempt_at).getTime()
  );

  // Sort needs improvement and mastered
  needsImprovement.sort((a, b) => a.score - b.score);
  mastered.sort((a, b) => b.score - a.score);

  return { categoryDetails, needsImprovement, mastered };
}
