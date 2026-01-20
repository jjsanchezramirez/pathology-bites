/**
 * Cache Migration and Cleanup Utility
 *
 * This utility helps clean up old cache formats and migrate data to the unified cache system.
 * Run this on app initialization to ensure localStorage is clean.
 */

import { unifiedCache } from "@/shared/services/unified-cache";

/**
 * List of old cache keys that should be removed
 * These are from previous cache implementations before unified-cache.ts
 */
const OLD_CACHE_KEYS = [
  "pathology-bites-swr-cache", // Old SWR cache format (before unified-cache migration)
  "pathology-bites-ai-model-preference", // Removed - now uses default model
  "nlm-journal-abbreviations", // Migrated to unified cache (citations namespace)
  "user-stats-cache", // Migrated to unified cache (stats namespace)
];

/**
 * Patterns to match old cache formats that should be cleaned up
 */
const OLD_CACHE_PATTERNS = [
  /^pathology-bites-lottie:v\d+:/, // Old lottie format with colons (e.g., pathology-bites-lottie:v1:access_denied)
  /pathology-bites-swer-/, // Typo: "swer" instead of "swr"
  /pathology-bites-swr-\/api\/iser\//, // Typo: "iser" instead of "user"
];

/**
 * Clean up old and corrupted cache entries from localStorage
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
 * Migrate old cache entries to unified cache system
 * This should be called once during app initialization
 */
export function migrateLegacyCaches(): void {
  if (typeof window === "undefined") return;

  try {
    // Currently no legacy caches need migration
    // This function is kept for future migrations
    console.log("[Cache Migration] No legacy caches to migrate");
  } catch (error) {
    console.warn("[Cache Migration] Failed to migrate legacy caches:", error);
  }
}

/**
 * Run full cache cleanup and migration
 * Call this on app initialization
 */
export function initializeCacheSystem(): void {
  if (typeof window === "undefined") return;

  console.log("[Cache System] 🚀 Initializing cache system...");

  // Step 1: Clean up old/corrupted caches
  cleanupOldCaches();

  // Step 2: Migrate legacy caches
  migrateLegacyCaches();

  // Step 3: Run unified cache cleanup
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
