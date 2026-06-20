/**
 * Cache Migration and Cleanup Utility
 *
 * This utility helps clean up old cache formats and migrate data to the unified cache system.
 * Run this on app initialization to ensure localStorage is clean.
 *
 * After first run, old keys won't exist anymore so subsequent runs are no-ops.
 *
 * TODO: Remove this file and CacheInitializer component after July 2026
 * (6 months after unified cache deployment - all users will have migrated by then)
 */

import type { ScopedMutator } from "swr";
import { unifiedCache, CACHE_NAMESPACES } from "@/shared/services/unified-cache";
import { log } from "@/shared/utils/logging";

/**
 * List of old cache keys that should be removed
 * These are from previous cache implementations or now rely on HTTP browser cache
 */
const OLD_CACHE_KEYS = [
  "pathology-bites-swr-cache", // Old SWR cache format
  "pathology-bites-ai-model-preference", // Removed - now uses default model
  "nlm-journal-abbreviations", // Now uses HTTP browser cache
  "user-stats-cache", // Migrated to unified cache (swr namespace)
  "pathology-bites-demo-questions", // Now uses HTTP browser cache (API has cache headers)
  "pathology-bites-virtual-slides-virtual-slides-dataset", // Old redundant key name
  "pathology-bites-virtual-slides-dataset", // Now uses HTTP browser cache
  "pathology-bites-swr-settings", // Renamed to pathology-bites-swr-user-settings
  "pathology-bites-swr-data", // Renamed to pathology-bites-swr-user-data
  "pathology-bites-swr-/api/user/settings/", // Old duplicate SWR key (with trailing slash)
  "pathology-bites-swr-/api/user/settings", // Old duplicate SWR key (without trailing slash)
  "pathology-bites-swr-/api/user/favorites", // Renamed to pathology-bites-swr-user-favorites
  "wsi-question-history", // Renamed to pathology-bites-wsi-question-history
  "pathology-bites-swr-wsi-question-history", // Intermediate rename; corrected to pathology-bites-wsi-question-history
  "quiz_offline_queue", // Old quiz offline queue (missing pathology-bites- prefix)
  "pathology-bites-citations-cache", // Migrated to unified cache (public-tools namespace)
  "pathology-bites-gene-cache", // Migrated to unified cache (public-tools namespace)
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

  // Old public-tools namespace keys (now using single nested key)
  /^pathology-bites-public-tools-/, // Old format with separate keys per item

  // Removed namespaces
  /^pathology-bites-images/,
  /^pathology-bites-questions(?!\/)/, // Not SWR cache keys with /api/questions/
  /^pathology-bites-dashboard/,
  /^pathology-bites-settings/,

  // Old quiz keys with incorrect prefixes
  /^pathology-bites-quiz:quiz-results-/, // Old format with colon
  /^pathology-bites-quiz-results-/, // Deprecated - results now stored in session cache
  /^quiz-session-/, // Old format without pathology-bites- prefix
  /^quiz-state-/, // Old format without pathology-bites- prefix
  /^quiz_/, // Old format with underscore instead of dash
  /^pathology-bites-swr-quiz-session-/, // Results page no longer caches separately; reads quiz-result-{id} directly

  // Typos and old API-based keys
  /pathology-bites-swer-/,
  /pathology-bites-swr-\/api\/iser\//,
  /pathology-bites-swr-\/api\/user\/settings/, // Match with or without trailing slash
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
        log.debug(`[Cache Cleanup] Removed old cache key: ${key}`);
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
        log.debug(`[Cache Cleanup] Removed old format key: ${key}`);
      }
    });

    if (cleanedCount > 0) {
      log.debug(`[Cache Cleanup] ✅ Cleaned up ${cleanedCount} old/corrupted cache entries`);
    }
  } catch (error) {
    log.warn("[Cache Cleanup] Failed to clean up old caches:", error);
  }
}

/**
 * One-shot cache invalidations keyed by a version number.
 *
 * Unlike OLD_CACHE_KEYS (which is run every boot, for keys that should never exist
 * again), this is for "blow away this cache exactly once after this deploy" cases
 * — typically when a server-side change (DB function, API logic) makes the cached
 * response shape or values no longer valid, but the SWR cache won't naturally
 * revalidate within its deduping window.
 *
 * Bump CACHE_MIGRATION_VERSION when you add a new migration step below. Each user
 * runs migrations once; subsequent boots short-circuit on the flag.
 */
const CACHE_MIGRATION_VERSION = "v3";
const CACHE_MIGRATION_FLAG_KEY = "pathology-bites-cache-migrations-version";

function runOneShotMigrations(mutate?: ScopedMutator): void {
  if (typeof window === "undefined") return;
  try {
    const completed = localStorage.getItem(CACHE_MIGRATION_FLAG_KEY);
    if (completed === CACHE_MIGRATION_VERSION) return;

    // v2/v3: invalidate user-data so existing users pick up correct percentile/peerRank
    // values. v2 was the threshold + pool semantics rewrite of get_user_percentile.
    // v3 follows the GRANT EXECUTE fix on get_user_percentile to authenticated — without
    // that grant the RPC silently returned nothing and the API baked the {50, 50, 100}
    // fallback values into the cache for every user.
    //
    // Three layers need to be cleared because the app uses a custom SWR cache provider:
    //   1. localStorage (persistence)
    //   2. unifiedCache memory (mirror layer SWR hydrates from on init)
    //   3. The provider-scoped SWR runtime Map (via the `mutate` passed in from
    //      useSWRConfig()). The GLOBAL `mutate` imported from "swr" targets SWR's
    //      default cache, not the provider-scoped instance — calling it here is a
    //      silent no-op against the cache `useUnifiedData` actually reads from.
    localStorage.removeItem("pathology-bites-swr-user-data");
    unifiedCache.delete(CACHE_NAMESPACES.SWR.name, "user-data");
    if (mutate) {
      mutate("user-data", undefined, { revalidate: true });
    }
    log.debug(
      `[Cache Migration] ${CACHE_MIGRATION_VERSION}: cleared stale pathology-bites-swr-user-data (localStorage, unifiedCache, SWR runtime)`
    );

    localStorage.setItem(CACHE_MIGRATION_FLAG_KEY, CACHE_MIGRATION_VERSION);
  } catch (err) {
    log.warn("[Cache Migration] One-shot migrations failed:", err);
  }
}

/**
 * Run full cache cleanup
 * Call this on app initialization
 */
export function initializeCacheSystem(mutate?: ScopedMutator): void {
  if (typeof window === "undefined") return;

  log.debug("[Cache System] 🚀 Initializing cache system...");

  // Step 1: Clean up old/corrupted caches
  cleanupOldCaches();

  // Step 2: Run version-gated one-shot invalidations (uses provider-scoped mutate
  // so SWR's runtime cache gets cleared too — not just the persistence layers).
  runOneShotMigrations(mutate);

  // Step 3: Run unified cache cleanup
  unifiedCache.cleanup();

  log.debug("[Cache System] ✅ Cache system initialized");
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
