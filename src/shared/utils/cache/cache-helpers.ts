// Cache invalidation and management helpers
// Centralized utilities for cache management across the app using unified cache
//
// IMPORTANT: every helper takes `mutate` as its first arg. Pass the
// provider-scoped `mutate` from `useSWRConfig()` (or use the `useCacheHelpers()`
// hook which binds it for you). The global `mutate` imported from "swr"
// targets SWR's default cache, NOT the custom provider cache that
// `swr-cache-provider.tsx` installs — calls against it are silent no-ops
// against the cache `useSWR` hooks read from.

import type { ScopedMutator } from "swr";
import { clearSWRCache } from "@/shared/contexts/swr-cache-provider";
import { unifiedCache, CACHE_NAMESPACES } from "@/shared/services/unified-cache";
import type { UserStats } from "@/features/user/achievements/services/achievement-checker";
import { calculateAchievementProgress } from "@/features/user/achievements/services/achievement-checker.client";
import type { QuizResult } from "@/features/user/quiz/types/quiz";

// Loose shape used to read the cached user-data payload without dragging the full
// UnifiedData type from use-unified-data.ts (where it isn't exported). All fields are
// optional because we always optional-chain through them.
type UnifiedDataShape = {
  summary?: {
    completedQuizzes?: number;
    totalAttempts?: number;
    correctAttempts?: number;
    overallScore?: number;
  };
  achievements?: {
    stats?: Partial<UserStats>;
    progress?: Array<{ id: string; isUnlocked: boolean }>;
  };
  dashboard?: {
    recentQuizzes?: number;
    studyStreak?: number;
    recentActivity?: Array<Record<string, unknown>>;
  };
  heatmap?: {
    data?: Array<{ date: string; quizzes: number; questions: number }>;
    stats?: {
      currentStreak?: number;
      longestStreak?: number;
      totalQuizzes?: number;
      totalQuestions?: number;
    };
  };
};

/**
 * Invalidate unified data cache (FALLBACK ONLY)
 * Use updateCacheAfterQuiz() instead for quiz completions
 *
 * @param revalidate - Whether to immediately fetch fresh data (default: true)
 */
export async function invalidateUnifiedData(mutate: ScopedMutator, revalidate = true) {
  console.log("[Cache] 🔄 Invalidating unified data cache");

  if (revalidate) {
    // Invalidate and immediately refetch
    await mutate("user-data");
  } else {
    // Invalidate only (next access will fetch fresh data)
    await mutate("user-data", undefined, { revalidate: false });
  }
}

/**
 * Invalidate user settings cache
 * Call this after updating settings
 *
 * @param revalidate - Whether to immediately fetch fresh data (default: true)
 */
export async function invalidateUserSettings(mutate: ScopedMutator, revalidate = true) {
  console.log("[Cache] 🔄 Invalidating user settings cache");

  if (revalidate) {
    await mutate("settings");
  } else {
    await mutate("settings", undefined, { revalidate: false });
  }
}

/**
 * Invalidate quiz sessions list cache
 * Call this after creating, updating, or completing a quiz
 *
 * @param revalidate - Whether to immediately fetch fresh data (default: true)
 */
export async function invalidateQuizSessions(mutate: ScopedMutator, revalidate = true) {
  console.log("[Cache] 🔄 Invalidating quiz sessions cache");

  if (revalidate) {
    await mutate("quiz-sessions-all");
  } else {
    await mutate("quiz-sessions-all", undefined, { revalidate: false });
  }
}

/**
 * Invalidate all SWR caches
 * Useful for logout, critical errors, etc.
 */
export async function invalidateAllCaches(mutate: ScopedMutator) {
  console.log("[Cache] 🗑️ Invalidating all caches");

  // Invalidate all SWR keys
  await mutate(
    () => true, // Match all keys
    undefined,
    { revalidate: false }
  );

  // Also clear localStorage cache
  clearSWRCache();
}

/**
 * Refresh all caches (invalidate + refetch)
 * Useful when you want to ensure fresh data everywhere
 */
export async function refreshAllCaches(mutate: ScopedMutator) {
  console.log("[Cache] 🔄 Refreshing all caches");

  // Refresh unified data
  await invalidateUnifiedData(mutate, true);

  // Refresh settings
  await invalidateUserSettings(mutate, true);
}

/**
 * Incrementally update cache after quiz completion
 * This is MUCH more efficient than invalidating and refetching everything
 *
 * Performance Impact:
 * - Before: 2 API calls, ~10 DB queries, ~50KB transfer, ~500-1000ms wait
 * - After: 1 API call, ~4 DB queries, ~5KB transfer, 0ms wait (instant from cache)
 *
 * Multi-Session Safety:
 * - Timestamp guard: detects when another session completed a quiz between our
 *   last cache load and now (their lastQuizTimestamp on the server beats ours).
 * - Falls back to full refetch if staleness detected.
 *
 * @param quizResult - The quiz result from /complete endpoint
 * @param newAchievements - New achievements unlocked (from /complete response)
 * @param serverMetadata - Server-side stats for validation (optional but recommended)
 */
export async function updateCacheAfterQuiz(
  mutate: ScopedMutator,
  quizResult: QuizResult,
  newAchievements: QuizResult["newAchievements"] = [],
  serverMetadata?: {
    totalQuizzes: number;
    lastQuizTimestamp: string;
  }
) {
  console.log("[Cache] 🎯 Quiz completed, updating cache incrementally");
  console.log("[Cache] Quiz result:", {
    score: quizResult.score,
    totalQuestions: quizResult.totalQuestions,
    newAchievements: newAchievements?.length || 0,
    metadata: serverMetadata,
  });

  try {
    // Read the cached user-data WITHOUT touching SWR at all. Two earlier attempts had
    // semantic gotchas:
    //   - `await mutate("user-data")` triggers a revalidation; the awaited value is
    //     the in-flight post-fetch result, which is undefined until the fetch settles.
    //   - `mutate("user-data", undefined, { revalidate: false })` actually WRITES
    //     undefined to the cache (the second positional arg is the new value).
    // We mirror every SWR write into `unifiedCache` under the SWR namespace (see
    // swr-cache-provider.tsx), so reading from there is a pure side-effect-free lookup.
    const currentCache = unifiedCache.get<UnifiedDataShape>(CACHE_NAMESPACES.SWR.name, "user-data");

    if (!currentCache) {
      console.log("[Cache] ⚠️ No cache found, falling back to full refetch");
      await invalidateUnifiedData(mutate, true);
      return;
    }

    console.log("[Cache] 📦 Current cache found, performing validation");

    // GUARD #1 was removed: it compared `currentCache.summary.completedQuizzes` against
    // `serverMetadata.totalQuizzes`, but these are semantically different counts.
    // `summary.completedQuizzes` is built by /api/user/performance-data, which caps at
    // .limit(100) and uses an INNER JOIN on quiz_attempts — so it's windowed and excludes
    // sessions with zero attempts (e.g. our abandoned ones). `serverMetadata.totalQuizzes`
    // is a full unfiltered lifetime count from getUserStats(). For any user with >100
    // quizzes (or any abandoned sessions), the values diverge permanently and Guard #1
    // fires every completion, defeating the purpose of incremental caching.
    // The remaining timestamp Guard is the meaningful multi-session check anyway: if
    // another session beat us to the server, the last-quiz timestamp diverges.

    // GUARD: Timestamp validation (detects concurrent quiz completions)
    if (serverMetadata?.lastQuizTimestamp) {
      const expectedTime = new Date(quizResult.completedAt).getTime();
      const serverTime = new Date(serverMetadata.lastQuizTimestamp).getTime();
      const timeDiff = serverTime - expectedTime;

      // Allow 5-second tolerance for clock skew and processing time
      if (timeDiff > 5000) {
        console.warn("[Cache] ⚠️ Timestamp mismatch detected!", {
          expectedTime: new Date(expectedTime).toISOString(),
          serverTime: new Date(serverTime).toISOString(),
          differenceMs: timeDiff,
        });
        console.warn("[Cache] 🔄 Quiz completed elsewhere. Syncing from server...");

        // Show user-friendly notification
        if (typeof window !== "undefined") {
          const toastModule = await import("@/shared/utils/ui/toast");
          toastModule.toast.warning("Activity detected from another session. Syncing...", {
            duration: 3000,
          });
        }

        // Force fresh fetch from server
        await invalidateUnifiedData(mutate, true);
        return;
      }

      console.log("[Cache] ✅ Timestamp guard passed", {
        difference: `${timeDiff}ms`,
      });
    }

    console.log("[Cache] 🛡️ Safe to update cache locally");

    // Calculate updated stats
    const isPerfectScore = quizResult.score === 100;
    const today = new Date().toISOString().split("T")[0];

    // Update streak (check if quiz was today or yesterday)
    const lastActivityDate =
      currentCache.heatmap?.data?.[currentCache.heatmap.data.length - 1]?.date;
    const isConsecutiveDay = lastActivityDate === today || isYesterday(lastActivityDate || "");
    const newCurrentStreak = isConsecutiveDay
      ? (currentCache.heatmap?.stats?.currentStreak || 0) + 1
      : 1;
    const newLongestStreak = Math.max(
      currentCache.heatmap?.stats?.longestStreak || 0,
      newCurrentStreak
    );

    // Note: Speed achievements are now handled by client-side achievement checking
    // No need to track speed records as stats anymore

    // Create updated data structure
    const updatedData = {
      ...currentCache,

      // Update summary stats
      summary: {
        ...currentCache.summary,
        completedQuizzes: (currentCache.summary?.completedQuizzes || 0) + 1,
        totalAttempts: (currentCache.summary?.totalAttempts || 0) + quizResult.totalQuestions,
        correctAttempts: (currentCache.summary?.correctAttempts || 0) + quizResult.correctAnswers,
        overallScore: Math.round(
          (((currentCache.summary?.correctAttempts || 0) + quizResult.correctAnswers) /
            ((currentCache.summary?.totalAttempts || 0) + quizResult.totalQuestions)) *
            100
        ),
      },

      // Update achievements
      achievements: {
        ...currentCache.achievements,
        stats: {
          ...currentCache.achievements?.stats,
          totalQuizzes: (currentCache.achievements?.stats?.totalQuizzes || 0) + 1,
          perfectScores:
            (currentCache.achievements?.stats?.perfectScores || 0) + (isPerfectScore ? 1 : 0),
          currentStreak: newCurrentStreak,
          longestStreak: newLongestStreak,
          // Note: Other stats (accuracy, differential) are complex to calculate client-side
          // Server will recalculate these and client can refetch if needed
        } as UserStats,
        // Use client-side achievement progress calculator
        progress: calculateAchievementProgress(
          {
            ...currentCache.achievements?.stats,
            totalQuizzes: (currentCache.achievements?.stats?.totalQuizzes || 0) + 1,
            perfectScores:
              (currentCache.achievements?.stats?.perfectScores || 0) + (isPerfectScore ? 1 : 0),
            currentStreak: newCurrentStreak,
            longestStreak: newLongestStreak,
          } as UserStats,
          [
            ...(newAchievements || []).map((a) => a.id),
            ...(currentCache.achievements?.progress || [])
              .filter((a) => a.isUnlocked)
              .map((a) => a.id),
          ]
        ),
      },

      // Update dashboard recent activity
      dashboard: {
        ...currentCache.dashboard,
        recentQuizzes: (currentCache.dashboard?.recentQuizzes || 0) + 1,
        studyStreak: newCurrentStreak,
        recentActivity: [
          {
            id: `session-${quizResult.sessionId}`,
            type: "quiz_completed",
            title: "Completed Quiz",
            description: "View detailed results",
            timestamp: quizResult.completedAt,
            score: quizResult.score,
            navigationUrl: `/dashboard/quiz/${quizResult.sessionId}/results`,
          },
          ...(currentCache.dashboard?.recentActivity || []).slice(0, 9), // Keep last 9
        ],
      },

      // Update heatmap with today's data
      heatmap: {
        ...currentCache.heatmap,
        data: updateHeatmapData(currentCache.heatmap?.data || [], today, quizResult.totalQuestions),
        stats: {
          ...currentCache.heatmap?.stats,
          currentStreak: newCurrentStreak,
          longestStreak: newLongestStreak,
          totalQuizzes: (currentCache.heatmap?.stats?.totalQuizzes || 0) + 1,
          totalQuestions:
            (currentCache.heatmap?.stats?.totalQuestions || 0) + quizResult.totalQuestions,
        },
      },
    };

    // Update SWR cache immediately (instant UI update, no loading spinner!)
    await mutate("user-data", updatedData, { revalidate: false });

    console.log("[Cache] ✅ Cache updated incrementally - instant UI update!");
    console.log("[Cache] 💾 Saved API call: Would have refetched ~50KB, updated ~5KB instead");

    // Background revalidation: the incremental patch above can't recompute fields that
    // depend on the rest of the user pool (percentile, peerRank, totalUsers) because we
    // don't have other users' scores locally. Fire a fire-and-forget refetch so those
    // fields catch up shortly after the instant UI update lands. Failures are non-fatal
    // — the user already sees the updated cache; the refetch is only for fields we
    // can't compute client-side.
    void mutate("user-data").catch((err) =>
      console.warn("[Cache] Background revalidation failed (non-fatal):", err)
    );
    console.log("[Cache] 🔄 Background revalidation scheduled for percentile/rank fields");
  } catch (error) {
    console.error("[Cache] ❌ Error updating cache incrementally:", error);
    console.log("[Cache] ⚠️ Falling back to full refetch");
    await invalidateUnifiedData(mutate, true);
  }
}

/**
 * Helper for quiz completion (DEPRECATED - use updateCacheAfterQuiz)
 * @deprecated Use updateCacheAfterQuiz() instead for better performance
 */
export async function onQuizComplete(mutate: ScopedMutator) {
  console.warn("[Cache] ⚠️ onQuizComplete() is deprecated. Use updateCacheAfterQuiz() instead");
  await invalidateUnifiedData(mutate, true);
}

/**
 * Helper for settings update
 * Invalidates settings cache to reflect changes
 */
export async function onSettingsUpdate(mutate: ScopedMutator) {
  console.log("[Cache] ⚙️ Settings updated, invalidating cache");

  // Invalidate settings cache
  await invalidateUserSettings(mutate, true);

  // Unified data doesn't include settings, so no need to invalidate
}

/**
 * Helper for logout
 * Clears all caches to prevent data leakage
 */
export async function onLogout(mutate: ScopedMutator) {
  console.log("[Cache] 👋 Logging out, clearing all caches");

  // Clear all caches
  await invalidateAllCaches(mutate);
}

/**
 * Pre-fetch unified data in background
 * Useful for warming up cache before navigation
 */
export async function prefetchUnifiedData() {
  console.log("[Cache] 🔮 Pre-fetching unified data");

  try {
    const res = await fetch("/api/user/performance-data");
    if (res.ok) {
      const data = await res.json();
      // Cache will be populated automatically by SWR
      console.log("[Cache] ✅ Pre-fetch successful");
      return data;
    }
  } catch (error) {
    console.error("[Cache] ❌ Pre-fetch failed:", error);
  }
}

/**
 * Check if cache is stale
 * Returns true if cache was last updated more than maxAge milliseconds ago
 */
export function isCacheStale(_cacheKey: string, _maxAge: number): boolean {
  // This is a simplified implementation
  // In a real scenario, you'd need to access the SWR cache metadata
  // For now, we rely on SWR's built-in staleness checking
  return false;
}

/**
 * Clear specific namespace from unified cache
 */
export function clearNamespaceCache(
  namespace: (typeof CACHE_NAMESPACES)[keyof typeof CACHE_NAMESPACES]["name"]
): void {
  console.log(`[Cache] 🗑️ Clearing ${namespace} namespace`);
  unifiedCache.clearNamespace(namespace);
}

/**
 * Clear all unified cache (both SWR and direct cache)
 */
export function clearUnifiedCache(): void {
  console.log("[Cache] 🗑️ Clearing all unified cache");
  unifiedCache.clearAll();
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(
  namespace?: (typeof CACHE_NAMESPACES)[keyof typeof CACHE_NAMESPACES]["name"]
) {
  return unifiedCache.getStats(namespace);
}

// ============================================================================
// Helper Functions for updateCacheAfterQuiz
// ============================================================================

/**
 * Check if a date string is yesterday
 */
function isYesterday(dateString: string): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  return dateString === yesterdayStr;
}

// Note: Speed record tracking and achievement progress calculation
// have been moved to achievement-checker.client.ts for better organization

/**
 * Update heatmap data with today's quiz activity
 */
function updateHeatmapData(
  existingData: Array<{ date: string; quizzes: number; questions: number }>,
  today: string,
  questionsCompleted: number
): Array<{ date: string; quizzes: number; questions: number }> {
  // Find today's entry
  const todayIndex = existingData.findIndex((d) => d.date === today);

  if (todayIndex >= 0) {
    // Update existing entry
    const updated = [...existingData];
    updated[todayIndex] = {
      date: today,
      quizzes: updated[todayIndex].quizzes + 1,
      questions: updated[todayIndex].questions + questionsCompleted,
    };
    return updated;
  } else {
    // Add new entry for today
    return [
      ...existingData,
      {
        date: today,
        quizzes: 1,
        questions: questionsCompleted,
      },
    ];
  }
}

/**
 * Manual cleanup of expired cache entries
 */
export function cleanupExpiredCache(
  namespace?: (typeof CACHE_NAMESPACES)[keyof typeof CACHE_NAMESPACES]["name"]
): void {
  console.log(`[Cache] 🧹 Cleaning up expired entries${namespace ? ` in ${namespace}` : ""}`);
  unifiedCache.cleanup(namespace);
}

const cacheHelpers = {
  // Recommended functions
  updateCacheAfterQuiz,
  invalidateUnifiedData,
  invalidateUserSettings,
  invalidateQuizSessions,
  invalidateAllCaches,
  refreshAllCaches,
  onSettingsUpdate,
  onLogout,
  prefetchUnifiedData,
  clearNamespaceCache,
  clearUnifiedCache,
  getCacheStats,
  cleanupExpiredCache,
  // Deprecated functions
  onQuizComplete, // DEPRECATED: Use updateCacheAfterQuiz instead
  isCacheStale, // DEPRECATED: Not implemented
};

export default cacheHelpers;
