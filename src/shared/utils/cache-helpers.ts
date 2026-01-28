// Cache invalidation and management helpers
// Centralized utilities for cache management across the app using unified cache

import { mutate } from "swr";
import { clearSWRCache } from "@/shared/providers/swr-cache-provider";
import { unifiedCache, CACHE_NAMESPACES } from "@/shared/services/unified-cache";

/**
 * Invalidate unified data cache
 * Call this after quiz completion, achievement unlocks, etc.
 *
 * @param revalidate - Whether to immediately fetch fresh data (default: true)
 */
export async function invalidateUnifiedData(revalidate = true) {
  console.log("[Cache] 🔄 Invalidating unified data cache");

  if (revalidate) {
    // Invalidate and immediately refetch
    await mutate("data");
  } else {
    // Invalidate only (next access will fetch fresh data)
    await mutate("data", undefined, { revalidate: false });
  }
}

/**
 * Invalidate user settings cache
 * Call this after updating settings
 *
 * @param revalidate - Whether to immediately fetch fresh data (default: true)
 */
export async function invalidateUserSettings(revalidate = true) {
  console.log("[Cache] 🔄 Invalidating user settings cache");

  if (revalidate) {
    await mutate("settings");
  } else {
    await mutate("settings", undefined, { revalidate: false });
  }
}

/**
 * Invalidate all SWR caches
 * Useful for logout, critical errors, etc.
 */
export async function invalidateAllCaches() {
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
export async function refreshAllCaches() {
  console.log("[Cache] 🔄 Refreshing all caches");

  // Refresh unified data
  await invalidateUnifiedData(true);

  // Refresh settings
  await invalidateUserSettings(true);
}

/**
 * Helper for quiz completion
 * Invalidates unified data to reflect new quiz results, achievements, etc.
 */
export async function onQuizComplete() {
  console.log("[Cache] 🎯 Quiz completed, invalidating caches");

  // Invalidate unified data (will fetch fresh data with new quiz results)
  await invalidateUnifiedData(true);

  // Settings don't change on quiz completion, so no need to invalidate
}

/**
 * Helper for settings update
 * Invalidates settings cache to reflect changes
 */
export async function onSettingsUpdate() {
  console.log("[Cache] ⚙️ Settings updated, invalidating cache");

  // Invalidate settings cache
  await invalidateUserSettings(true);

  // Unified data doesn't include settings, so no need to invalidate
}

/**
 * Helper for logout
 * Clears all caches to prevent data leakage
 */
export async function onLogout() {
  console.log("[Cache] 👋 Logging out, clearing all caches");

  // Clear all caches
  await invalidateAllCaches();
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
  invalidateUnifiedData,
  invalidateUserSettings,
  invalidateAllCaches,
  refreshAllCaches,
  onQuizComplete,
  onSettingsUpdate,
  onLogout,
  prefetchUnifiedData,
  isCacheStale,
  clearNamespaceCache,
  clearUnifiedCache,
  getCacheStats,
  cleanupExpiredCache,
};

export default cacheHelpers;
