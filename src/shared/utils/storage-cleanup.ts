// localStorage cleanup utilities
// Manages localStorage size and cleans up old data

/**
 * Storage cleanup utilities for managing localStorage size
 * and removing stale data
 */

const QUIZ_SESSION_PREFIX = "quiz-sessions-";
const QUIZ_STATE_PREFIX = "quiz-state-";
const QUIZ_RESULTS_PREFIX = "pathology-bites-quiz:quiz-results-";
const LEGACY_QUIZ_PREFIX = "quiz_";
const LEGACY_UI_SETTINGS_KEY = "pathology-bites-ui-settings"; // Deprecated - now in SWR cache
const LEGACY_PUBLIC_STATS_KEY = "pathology-bites-public-stats"; // Deprecated - stats now hardcoded

// Keep quiz sessions for 7 days
const QUIZ_SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// Keep quiz results for 30 days
const QUIZ_RESULTS_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

interface StorageStats {
  totalSize: number;
  totalItems: number;
  items: Array<{
    key: string;
    size: number;
    age?: number;
  }>;
}

interface QuizSessionData {
  timestamp?: number | string;
  created_at?: number | string;
  [key: string]: unknown;
}

/**
 * Get localStorage usage statistics
 */
export function getStorageStats(): StorageStats {
  if (typeof window === "undefined") {
    return { totalSize: 0, totalItems: 0, items: [] };
  }

  let totalSize = 0;
  const items: Array<{ key: string; size: number; age?: number }> = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    const value = localStorage.getItem(key) || "";
    const size = new Blob([value]).size;

    totalSize += size;

    // Try to get age from stored data
    let age: number | undefined;
    try {
      const parsed = JSON.parse(value);
      if (parsed.timestamp) {
        age = Date.now() - parsed.timestamp;
      } else if (parsed.created_at) {
        age = Date.now() - new Date(parsed.created_at).getTime();
      }
    } catch {
      // Not JSON or no timestamp
    }

    items.push({ key, size, age });
  }

  return {
    totalSize,
    totalItems: items.length,
    items: items.sort((a, b) => b.size - a.size), // Sort by size descending
  };
}

/**
 * Clean up old quiz sessions
 * Removes quiz sessions older than maxAge
 */
export function cleanupOldQuizSessions(maxAge = QUIZ_SESSION_MAX_AGE): number {
  if (typeof window === "undefined") return 0;

  let cleanedCount = 0;
  const keysToRemove: string[] = [];
  const now = Date.now();

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    // Check if it's a quiz session or quiz state
    if (
      key.startsWith(QUIZ_SESSION_PREFIX) ||
      key.startsWith(QUIZ_STATE_PREFIX) ||
      key.startsWith(LEGACY_QUIZ_PREFIX)
    ) {
      try {
        const value = localStorage.getItem(key);
        if (!value) continue;

        const data = JSON.parse(value) as QuizSessionData;

        // Check age
        const timestamp = data.timestamp || data.created_at;
        if (timestamp) {
          const age =
            now - (typeof timestamp === "number" ? timestamp : new Date(timestamp).getTime());

          if (age > maxAge) {
            keysToRemove.push(key);
          }
        } else {
          // No timestamp, consider it old
          keysToRemove.push(key);
        }
      } catch {
        // Invalid JSON, remove it
        keysToRemove.push(key);
      }
    }
  }

  // Remove old keys
  keysToRemove.forEach((key) => {
    localStorage.removeItem(key);
    cleanedCount++;
  });

  if (cleanedCount > 0) {
    console.log(`[Storage Cleanup] 🗑️ Removed ${cleanedCount} old quiz sessions`);
  }

  return cleanedCount;
}

/**
 * Clean up old quiz results
 * Removes quiz results older than maxAge
 */
export function cleanupOldQuizResults(maxAge = QUIZ_RESULTS_MAX_AGE): number {
  if (typeof window === "undefined") return 0;

  let cleanedCount = 0;
  const keysToRemove: string[] = [];
  const now = Date.now();

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    if (key.startsWith(QUIZ_RESULTS_PREFIX)) {
      try {
        const value = localStorage.getItem(key);
        if (!value) continue;

        const data = JSON.parse(value) as { timestamp?: number };
        const timestamp = data.timestamp;

        if (timestamp && now - timestamp > maxAge) {
          keysToRemove.push(key);
        }
      } catch {
        // Invalid JSON, remove it
        keysToRemove.push(key);
      }
    }
  }

  keysToRemove.forEach((key) => {
    localStorage.removeItem(key);
    cleanedCount++;
  });

  if (cleanedCount > 0) {
    console.log(`[Storage Cleanup] 🗑️ Removed ${cleanedCount} old quiz results`);
  }

  return cleanedCount;
}

/**
 * Remove legacy storage keys
 * Identifies and removes old/unused storage including:
 * - Legacy quiz_ keys
 * - Deprecated pathology-bites-ui-settings (now in SWR cache)
 */
export function cleanupLegacyQuizData(): number {
  if (typeof window === "undefined") return 0;

  let cleanedCount = 0;
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    // Remove legacy quiz_ keys (if they exist and are not needed)
    if (key.startsWith(LEGACY_QUIZ_PREFIX)) {
      keysToRemove.push(key);
    }

    // Remove deprecated ui-settings key (now in SWR cache)
    if (key === LEGACY_UI_SETTINGS_KEY) {
      keysToRemove.push(key);
    }

    // Remove deprecated public-stats key (stats now hardcoded)
    if (key === LEGACY_PUBLIC_STATS_KEY) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => {
    localStorage.removeItem(key);
    cleanedCount++;
  });

  if (cleanedCount > 0) {
    console.log(`[Storage Cleanup] 🗑️ Removed ${cleanedCount} legacy keys`);
  }

  return cleanedCount;
}

/**
 * Consolidate quiz storage
 * Merges quiz-sessions-[id] and quiz-state-[id] into single key
 *
 * This is a migration utility to clean up the storage structure
 */
export function consolidateQuizStorage(): number {
  if (typeof window === "undefined") return 0;

  let consolidatedCount = 0;
  const sessionMap = new Map<string, QuizSessionData>();
  const stateMap = new Map<string, QuizSessionData>();

  // Collect all quiz sessions and states
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    try {
      const value = localStorage.getItem(key);
      if (!value) continue;

      if (key.startsWith(QUIZ_SESSION_PREFIX)) {
        const id = key.replace(QUIZ_SESSION_PREFIX, "");
        sessionMap.set(id, JSON.parse(value) as QuizSessionData);
      } else if (key.startsWith(QUIZ_STATE_PREFIX)) {
        const id = key.replace(QUIZ_STATE_PREFIX, "");
        stateMap.set(id, JSON.parse(value) as QuizSessionData);
      }
    } catch (error) {
      console.error(`[Storage Cleanup] ❌ Failed to parse ${key}:`, error);
    }
  }

  // Merge session and state data
  sessionMap.forEach((session, id) => {
    const state = stateMap.get(id);

    if (state) {
      // Merge into single key
      const consolidated = {
        ...session,
        state,
        consolidated: true,
        timestamp: Date.now(),
      };

      // Save consolidated data
      localStorage.setItem(`quiz-active-${id}`, JSON.stringify(consolidated));

      // Remove old keys
      localStorage.removeItem(QUIZ_SESSION_PREFIX + id);
      localStorage.removeItem(QUIZ_STATE_PREFIX + id);

      consolidatedCount++;
    }
  });

  if (consolidatedCount > 0) {
    console.log(`[Storage Cleanup] 🔧 Consolidated ${consolidatedCount} quiz storages`);
  }

  return consolidatedCount;
}

/**
 * Perform full storage cleanup
 * Runs all cleanup functions
 */
export function performFullCleanup(): {
  oldSessions: number;
  oldResults: number;
  legacy: number;
  totalCleaned: number;
  stats: StorageStats;
} {
  console.log("[Storage Cleanup] 🧹 Starting full cleanup...");

  const oldSessions = cleanupOldQuizSessions();
  const oldResults = cleanupOldQuizResults();
  const legacy = cleanupLegacyQuizData();

  const stats = getStorageStats();

  const result = {
    oldSessions,
    oldResults,
    legacy,
    totalCleaned: oldSessions + oldResults + legacy,
    stats,
  };

  console.log("[Storage Cleanup] ✅ Cleanup complete:", result);

  return result;
}

/**
 * Check if storage is near quota
 * Returns true if localStorage usage is > 80% of estimated quota
 */
export function isStorageNearQuota(): boolean {
  if (typeof window === "undefined") return false;

  const stats = getStorageStats();

  // Estimated localStorage quota: 5-10MB (varies by browser)
  // We'll use 5MB as conservative estimate
  const estimatedQuota = 5 * 1024 * 1024; // 5MB in bytes
  const threshold = estimatedQuota * 0.8; // 80%

  return stats.totalSize > threshold;
}

/**
 * Auto-cleanup on app initialization
 * Call this on app mount to clean up old data
 */
export function autoCleanup() {
  if (typeof window === "undefined") return;

  console.log("[Storage Cleanup] 🚀 Running auto-cleanup on app init");

  // Clean up old data
  cleanupOldQuizSessions();
  cleanupOldQuizResults();
  cleanupLegacyQuizData();

  // Check if near quota
  if (isStorageNearQuota()) {
    console.warn(
      "[Storage Cleanup] ⚠️ localStorage is near quota, consider more aggressive cleanup"
    );
  }

  // Log final stats
  const stats = getStorageStats();
  console.log("[Storage Cleanup] 📊 Storage stats:", {
    totalSize: `${(stats.totalSize / 1024).toFixed(2)} KB`,
    totalItems: stats.totalItems,
    largestItems: stats.items.slice(0, 5).map((item) => ({
      key: item.key,
      size: `${(item.size / 1024).toFixed(2)} KB`,
    })),
  });
}

const storageCleanup = {
  getStorageStats,
  cleanupOldQuizSessions,
  cleanupOldQuizResults,
  cleanupLegacyQuizData,
  consolidateQuizStorage,
  performFullCleanup,
  isStorageNearQuota,
  autoCleanup,
};

export default storageCleanup;
