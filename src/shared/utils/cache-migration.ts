/**
 * Cache Migration and Cleanup Utility
 *
 * This utility helps clean up old cache formats and migrate data to the unified cache system.
 * Run this on app initialization to ensure localStorage is clean.
 *
 * After first run, old keys won't exist anymore so subsequent runs are no-ops.
 */

import { unifiedCache } from "@/shared/services/unified-cache";

/**
 * List of old cache keys that should be removed
 * These are from previous cache implementations or now rely on HTTP browser cache
 */
const OLD_CACHE_KEYS = [
  "pathology-bites-swr-cache", // Old SWR cache format
  "pathology-bites-ai-model-preference", // Removed - now uses default model
  "nlm-journal-abbreviations", // Now uses HTTP browser cache
  "user-stats-cache", // Migrated to unified cache (stats namespace)
  "pathology-bites-demo-questions", // Now uses HTTP browser cache (API has cache headers)
  "pathology-bites-virtual-slides-virtual-slides-dataset", // Old redundant key name
  "pathology-bites-virtual-slides-dataset", // Now uses HTTP browser cache
  "pathology-bites-swr-settings", // Renamed to pathology-bites-swr-user-settings
  "pathology-bites-swr-data", // Renamed to pathology-bites-swr-user-data
  "pathology-bites-swr-/api/user/settings/", // Old duplicate SWR key (with trailing slash)
  "pathology-bites-swr-/api/user/settings", // Old duplicate SWR key (without trailing slash)
  "quiz_offline_queue", // Old quiz offline queue (missing pathology-bites- prefix)
];

/**
 * Patterns to match old cache formats that should be cleaned up
 */
const OLD_CACHE_PATTERNS = [
  // Old lottie formats (now uses HTTP cache + memory)
  /^pathology-bites-lottie/,

  // Old virtual slides (now uses HTTP cache + memory)
  /^pathology-bites-virtual-slides/,

  // Old demo questions (now uses HTTP cache + memory)
  /^pathology-bites-demo-questions/,

  // Old citations (now uses HTTP cache + memory)
  /^pathology-bites-citations/,

  // Removed namespaces
  /^pathology-bites-images/,
  /^pathology-bites-questions(?!\/)/,  // Not SWR cache keys with /api/questions/
  /^pathology-bites-dashboard/,
  /^pathology-bites-settings/,

  // Old quiz keys with incorrect prefixes
  /^pathology-bites-quiz:quiz-results-/, // Old format with colon
  /^quiz-session-/, // Old format without pathology-bites- prefix
  /^quiz-state-/, // Old format without pathology-bites- prefix
  /^quiz_/, // Old format with underscore instead of dash

  // Typos and old API-based keys
  /pathology-bites-swer-/,
  /pathology-bites-swr-\/api\/iser\//,
  /pathology-bites-swr-\/api\/user\/settings/,  // Match with or without trailing slash
];

/**
 * Clean up old and corrupted cache entries from localStorage
 * After first run, old keys won't exist so this becomes a fast no-op.
 */
export function cleanupOldCaches(): void {
  if (typeof window === "undefined") return;

  let cleanedCount = 0;

  try {
    // Remove known old cache keys
    OLD_CACHE_KEYS.forEach((key) => {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        cleanedCount++;
        console.log(`[Cache Cleanup] Removed old cache key: ${key}`);
      }
    });

    // Find and remove corrupted keys
    const allKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) allKeys.push(key);
    }

    allKeys.forEach((key) => {
      // Check if key matches any old cache pattern
      const isOldFormat = OLD_CACHE_PATTERNS.some((pattern) => pattern.test(key));
      if (isOldFormat) {
        localStorage.removeItem(key);
        cleanedCount++;
        console.log(`[Cache Cleanup] Removed old format key: ${key}`);
      }
    });

    if (cleanedCount > 0) {
      console.log(`[Cache Cleanup] ✅ Cleaned up ${cleanedCount} old/corrupted cache entries`);
    }
  } catch (error) {
    console.warn("[Cache Cleanup] Failed to clean up old caches:", error);
  }
}

/**
 * Run full cache cleanup
 * Call this on app initialization
 */
export function initializeCacheSystem(): void {
  if (typeof window === "undefined") return;

  console.log("[Cache System] 🚀 Initializing cache system...");

  // Step 1: Clean up old/corrupted caches
  cleanupOldCaches();

  // Step 2: Run unified cache cleanup
  unifiedCache.cleanup();

  console.log("[Cache System] ✅ Cache system initialized");
}

/**
 * Get cache statistics for debugging
 */
export function getCacheDebugInfo(): {
  totalKeys: number;
  unifiedCacheKeys: number;
  otherKeys: string[];
  totalSize: number;
} {
  if (typeof window === "undefined") {
    return {
      totalKeys: 0,
      unifiedCacheKeys: 0,
      otherKeys: [],
      totalSize: 0,
    };
  }

  let totalSize = 0;
  let unifiedCacheKeys = 0;
  const otherKeys: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    const value = localStorage.getItem(key);
    if (value) {
      totalSize += new Blob([value]).size;
    }

    if (key.startsWith("pathology-bites-")) {
      // Check if it's a unified cache key (format: pathology-bites-{namespace}-{key})
      const parts = key.split("-");
      if (parts.length >= 3) {
        unifiedCacheKeys++;
      } else {
        otherKeys.push(key);
      }
    } else {
      otherKeys.push(key);
    }
  }

  return {
    totalKeys: localStorage.length,
    unifiedCacheKeys,
    otherKeys,
    totalSize,
  };
}
