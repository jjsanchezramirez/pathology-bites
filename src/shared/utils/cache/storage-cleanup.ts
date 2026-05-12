// localStorage cleanup utilities
// Manages localStorage size and cleans up old data

/**
 * Storage cleanup utilities for managing localStorage size
 * and removing stale data
 */

const QUIZ_RESULT_PREFIX = "pathology-bites-quiz-result-"; // denormalized cache (post-completion + during quiz)
const QUIZ_DRAFT_PREFIX = "pathology-bites-quiz-draft-"; // in-flight reducer state
const QUIZ_STRIKES_PREFIX = "pathology-bites-quiz-strikes-"; // per-question strike-outs
const LEGACY_STRIKES_PREFIX = "quiz-strikes-"; // Pre-namespacing; remove on sight
const LEGACY_SESSION_PREFIX = "pathology-bites-quiz-session-"; // Renamed to -result-
const LEGACY_STATE_PREFIX = "pathology-bites-quiz-state-"; // Renamed to -draft-

// Empty-suffix orphan keys created when sessionId was empty. Always remove on cleanup.
const ORPHAN_KEYS = [
  "pathology-bites-quiz-result-",
  "pathology-bites-quiz-draft-",
  "pathology-bites-quiz-strikes-",
  "pathology-bites-quiz-session-",
  "pathology-bites-quiz-state-",
];

// Keep quiz sessions for 30 days (includes results)
const QUIZ_SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

interface QuizSessionData {
  timestamp?: number | string;
  created_at?: number | string;
  lastSaved?: number;
  [key: string]: unknown;
}

interface StorageStats {
  totalSize: number;
  totalItems: number;
  items: Array<{
    key: string;
    size: number;
    age?: number;
  }>;
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
      } else if (parsed.lastSaved) {
        age = Date.now() - parsed.lastSaved;
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

    // Check if it's a quiz result/cache, draft, or strikes set (all TTL-eligible)
    if (
      key.startsWith(QUIZ_RESULT_PREFIX) ||
      key.startsWith(QUIZ_DRAFT_PREFIX) ||
      key.startsWith(QUIZ_STRIKES_PREFIX)
    ) {
      try {
        const value = localStorage.getItem(key);
        if (!value) continue;

        const data = JSON.parse(value) as QuizSessionData;

        // Check age
        const timestamp = data.timestamp || data.created_at || data.lastSaved;
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
 * Perform full storage cleanup
 * Runs all cleanup functions
 */
export function performFullCleanup(): {
  oldSessions: number;
  totalCleaned: number;
  stats: StorageStats;
} {
  console.log("[Storage Cleanup] 🧹 Starting full cleanup...");

  const oldSessions = cleanupOldQuizSessions();

  const stats = getStorageStats();

  const result = {
    oldSessions,
    totalCleaned: oldSessions,
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

    // Only target quiz result/cache, draft, and strikes (not SWR cache or settings!)
    if (
      key.startsWith(QUIZ_RESULT_PREFIX) ||
      key.startsWith(QUIZ_DRAFT_PREFIX) ||
      key.startsWith(QUIZ_STRIKES_PREFIX)
    ) {
      try {
        const value = localStorage.getItem(key);
        if (!value) continue;

        const size = new Blob([value]).size;
        const data = JSON.parse(value) as QuizSessionData;
        const timestamp = data.timestamp || data.created_at || data.lastSaved;

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
 * Migrate localStorage keys from the old `quiz-session-*` / `quiz-state-*` naming to the
 * new `quiz-result-*` / `quiz-draft-*` naming. Idempotent: skips when the new key already
 * exists. Runs on every boot until all users have rolled over (it becomes a no-op).
 */
export function migrateLegacyQuizKeys(): number {
  if (typeof window === "undefined") return 0;

  let migrated = 0;
  const renames: Array<[string, string]> = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    let newKey: string | null = null;
    if (key.startsWith(LEGACY_SESSION_PREFIX) && key.length > LEGACY_SESSION_PREFIX.length) {
      newKey = QUIZ_RESULT_PREFIX + key.slice(LEGACY_SESSION_PREFIX.length);
    } else if (key.startsWith(LEGACY_STATE_PREFIX) && key.length > LEGACY_STATE_PREFIX.length) {
      newKey = QUIZ_DRAFT_PREFIX + key.slice(LEGACY_STATE_PREFIX.length);
    }
    if (newKey) renames.push([key, newKey]);
  }

  for (const [oldKey, newKey] of renames) {
    try {
      const value = localStorage.getItem(oldKey);
      if (value === null) continue;
      // Don't clobber a newer write to the new key
      if (localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, value);
      }
      localStorage.removeItem(oldKey);
      migrated++;
    } catch {
      // Quota or parse issue; leave the legacy key, cleanup will catch it later
    }
  }

  if (migrated > 0) {
    console.log(`[Storage Cleanup] ♻️ Migrated ${migrated} legacy quiz keys to new naming`);
  }
  return migrated;
}

/**
 * Sweep one-off cruft on app load: orphan empty-suffix keys, legacy non-namespaced
 * strike keys, and empty strike payloads. Cheap to run every boot.
 */
export function cleanupOrphans(): number {
  if (typeof window === "undefined") return 0;

  let removed = 0;
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    // Exact-match orphans (empty-suffix keys from missing sessionId)
    if (ORPHAN_KEYS.includes(key)) {
      keysToRemove.push(key);
      continue;
    }

    // Legacy non-namespaced strike keys from before the rename
    if (key.startsWith(LEGACY_STRIKES_PREFIX)) {
      keysToRemove.push(key);
      continue;
    }

    // Properly-namespaced strike keys that contain no actual strikes get cleaned up.
    // Two payload shapes are possible:
    //   - Legacy: Record<questionId, string[]> (no timestamp)
    //   - Current: { strikes: Record<questionId, string[]>, lastSaved: number }
    if (key.startsWith(QUIZ_STRIKES_PREFIX)) {
      try {
        const value = localStorage.getItem(key);
        if (!value || value === "{}") {
          keysToRemove.push(key);
          continue;
        }
        const parsed = JSON.parse(value);
        const strikesMap =
          parsed && typeof parsed === "object" && parsed.strikes && !Array.isArray(parsed)
            ? (parsed.strikes as Record<string, unknown>)
            : (parsed as Record<string, unknown>);
        const hasContent = Object.values(strikesMap || {}).some(
          (arr) => Array.isArray(arr) && arr.length > 0
        );
        if (!hasContent) keysToRemove.push(key);
      } catch {
        keysToRemove.push(key);
      }
    }
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key);
    removed++;
  }

  if (removed > 0) {
    console.log(`[Storage Cleanup] 🧹 Removed ${removed} orphan/legacy/empty keys`);
  }
  return removed;
}

/**
 * Auto-cleanup on app initialization
 * If storage > 5MB, remove oldest quiz sessions until < 4MB
 */
export function autoCleanup() {
  if (typeof window === "undefined") return;

  console.log("[Storage Cleanup] 🚀 Running auto-cleanup on app init");

  // Rename legacy quiz-session/quiz-state keys to the new quiz-result/quiz-draft naming
  // before any other cleanup runs (so subsequent steps see the canonical key names).
  migrateLegacyQuizKeys();

  // Clear orphan/legacy/empty cruft (always cheap, runs every boot)
  cleanupOrphans();

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
  cleanupOrphans,
  migrateLegacyQuizKeys,
  performFullCleanup,
  isStorageNearQuota,
  enforceStorageQuota,
  autoCleanup,
};

export default storageCleanup;
