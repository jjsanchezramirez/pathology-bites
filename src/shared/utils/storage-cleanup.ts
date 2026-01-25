// localStorage cleanup utilities
// Manages localStorage size and cleans up old data

/**
 * Storage cleanup utilities for managing localStorage size
 * and removing stale data
 */

const QUIZ_SESSION_PREFIX = "pathology-bites-quiz-session-"; // Correct prefix
const QUIZ_STATE_PREFIX = "pathology-bites-quiz-state-"; // Correct prefix
const QUIZ_RESULTS_PREFIX = "pathology-bites-quiz-results-"; // Correct prefix

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
    if (key.startsWith(QUIZ_SESSION_PREFIX) || key.startsWith(QUIZ_STATE_PREFIX)) {
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
 * Perform full storage cleanup
 * Runs all cleanup functions
 */
export function performFullCleanup(): {
  oldSessions: number;
  oldResults: number;
  totalCleaned: number;
  stats: StorageStats;
} {
  console.log("[Storage Cleanup] 🧹 Starting full cleanup...");

  const oldSessions = cleanupOldQuizSessions();
  const oldResults = cleanupOldQuizResults();

  const stats = getStorageStats();

  const result = {
    oldSessions,
    oldResults,
    totalCleaned: oldSessions + oldResults,
    stats,
  };

  console.log("[Storage Cleanup] ✅ Cleanup complete:", result);

  return result;
}

/**
 * Check if storage is near quota
 * Returns true if localStorage usage is > 80% of 5MB limit
 */
export function isStorageNearQuota(): boolean {
  if (typeof window === "undefined") return false;

  const stats = getStorageStats();
  const QUOTA_LIMIT = 5 * 1024 * 1024; // 5MB hard limit
  const threshold = QUOTA_LIMIT * 0.8; // 80% = 4MB

  return stats.totalSize > threshold;
}

/**
 * Enforce storage quota by removing oldest quiz sessions
 * Keeps storage under 4MB by removing oldest sessions first
 */
export function enforceStorageQuota(): number {
  if (typeof window === "undefined") return 0;

  const stats = getStorageStats();
  const QUOTA_LIMIT = 5 * 1024 * 1024; // 5MB
  const TARGET_SIZE = 4 * 1024 * 1024; // 4MB (leave 1MB headroom)

  // If under quota, do nothing
  if (stats.totalSize < QUOTA_LIMIT * 0.8) {
    return 0;
  }

  console.warn(
    `[Storage Cleanup] ⚠️ localStorage at ${(stats.totalSize / 1024 / 1024).toFixed(2)}MB, cleaning up...`
  );

  let removedCount = 0;
  let currentSize = stats.totalSize;

  // Get all quiz sessions with timestamps
  const quizSessions: Array<{ key: string; timestamp: number; size: number }> = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    // Only target quiz sessions and state (not SWR cache or settings!)
    if (
      key.startsWith(QUIZ_SESSION_PREFIX) ||
      key.startsWith(QUIZ_STATE_PREFIX) ||
      key.startsWith(QUIZ_RESULTS_PREFIX)
    ) {
      try {
        const value = localStorage.getItem(key);
        if (!value) continue;

        const size = new Blob([value]).size;
        const data = JSON.parse(value) as QuizSessionData;
        const timestamp = data.timestamp || data.created_at;

        if (timestamp) {
          quizSessions.push({
            key,
            timestamp: typeof timestamp === "number" ? timestamp : new Date(timestamp).getTime(),
            size,
          });
        }
      } catch {
        // Invalid entry, skip
      }
    }
  }

  // Sort by oldest first
  quizSessions.sort((a, b) => a.timestamp - b.timestamp);

  // Remove oldest until we're under target size
  for (const session of quizSessions) {
    if (currentSize < TARGET_SIZE) break;

    localStorage.removeItem(session.key);
    currentSize -= session.size;
    removedCount++;
    console.log(`[Storage Cleanup] Removed old quiz session: ${session.key}`);
  }

  if (removedCount > 0) {
    console.log(
      `[Storage Cleanup] ✅ Removed ${removedCount} old quiz sessions. Storage: ${(currentSize / 1024 / 1024).toFixed(2)}MB`
    );
  }

  return removedCount;
}

/**
 * Auto-cleanup on app initialization
 * If storage > 5MB, remove oldest quiz sessions until < 4MB
 */
export function autoCleanup() {
  if (typeof window === "undefined") return;

  console.log("[Storage Cleanup] 🚀 Running auto-cleanup on app init");

  // Enforce 5MB quota by removing oldest quiz sessions
  enforceStorageQuota();

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
  performFullCleanup,
  isStorageNearQuota,
  enforceStorageQuota,
  autoCleanup,
};

export default storageCleanup;
