// src/features/quiz/services/auto-save-manager.ts

import {
  AUTO_SAVE_CONFIG,
  AutoSaveTrigger,
  AutoSaveResult,
  SyncStatus,
  debugLog,
} from "../config/auto-save-config";
import { OfflineQueueManager } from "./offline-queue-manager";
import { DatabaseSyncManager } from "../hybrid/core/database-sync-manager";
import type { QuizState } from "../types/quiz-question";

/**
 * Manages all auto-save operations for quiz sessions
 * Handles navigation, periodic saves, offline queue, and conflict resolution
 */
export class AutoSaveManager {
  private offlineQueue: OfflineQueueManager;
  private syncManager: DatabaseSyncManager;
  private lastSaveTime: number = 0;
  private lastAnswerCount: number = 0;
  private saveInProgress: boolean = false;
  private syncStatusCallback?: (status: SyncStatus) => void;

  constructor(syncManager: DatabaseSyncManager, onSyncStatusChange?: (status: SyncStatus) => void) {
    this.syncManager = syncManager;
    this.offlineQueue = new OfflineQueueManager();
    this.syncStatusCallback = onSyncStatusChange;

    // Start processing offline queue
    this.startQueueProcessor();
  }

  /**
   * Auto-save with conflict resolution
   * Database is source of truth if exists, otherwise local is source of truth
   */
  async autoSave(
    sessionId: string,
    quizState: QuizState,
    trigger: AutoSaveTrigger,
    timeRemaining?: number | null
  ): Promise<AutoSaveResult> {
    // Prevent concurrent saves
    if (this.saveInProgress) {
      debugLog("Save already in progress, skipping", trigger);
      return {
        success: false,
        trigger,
        timestamp: Date.now(),
        error: "Save already in progress",
      };
    }

    // If the browser thinks we're offline, skip the network attempt entirely
    // and queue directly. `navigator.onLine === false` is best-effort but
    // reliable for the common case (Wi-Fi disconnected). The queue processor
    // retries every 10 s, so anything queued here will be replayed once we're
    // back.
    if (
      typeof navigator !== "undefined" &&
      !navigator.onLine &&
      AUTO_SAVE_CONFIG.enableOfflineQueue
    ) {
      this.offlineQueue.addToQueue(sessionId, quizState, trigger);
      this.updateSyncStatus({ state: "offline", message: "Offline - will sync when online" });
      debugLog("Auto-save queued (offline)", { trigger });
      return {
        success: false,
        trigger,
        timestamp: Date.now(),
        error: "Offline",
        queued: true,
      };
    }

    this.saveInProgress = true;
    this.updateSyncStatus({ state: "syncing", message: "Syncing..." });

    try {
      // Step 1: Fetch current database state for conflict resolution
      const dbState = await this.fetchDatabaseState(sessionId);

      // Step 2: Resolve conflicts
      const resolvedState = this.resolveConflicts(quizState, dbState);

      // Step 3: Attempt to sync
      // Use saveProgress for non-completion triggers, syncQuizData for completion
      const isCompletion = trigger === "completion";
      const result = isCompletion
        ? await this.syncManager.syncQuizData(resolvedState)
        : await this.syncManager.saveProgress(resolvedState, timeRemaining);

      if (result.success) {
        this.lastSaveTime = Date.now();
        this.lastAnswerCount = quizState.answers.size;

        if (trigger === "manual") {
          this.updateSyncStatus({ state: "saved", message: "Quiz saved" });
        } else {
          this.updateSyncStatus({ state: "synced", message: "All changes synced" });
        }

        debugLog("Auto-save successful", { trigger, timestamp: result.timestamp });

        return {
          success: true,
          trigger,
          timestamp: result.timestamp,
        };
      } else {
        // Sync failed - add to offline queue
        if (AUTO_SAVE_CONFIG.enableOfflineQueue) {
          this.offlineQueue.addToQueue(sessionId, resolvedState, trigger);
          this.updateSyncStatus({
            state: "queued",
            message: "Changes queued for sync",
          });

          debugLog("Auto-save queued", { trigger, error: result.error });

          return {
            success: false,
            trigger,
            timestamp: Date.now(),
            error: result.error,
            queued: true,
          };
        } else {
          this.updateSyncStatus({
            state: "error",
            message: "Sync failed - retrying...",
          });

          return {
            success: false,
            trigger,
            timestamp: Date.now(),
            error: result.error,
          };
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Add to offline queue on error
      if (AUTO_SAVE_CONFIG.enableOfflineQueue) {
        this.offlineQueue.addToQueue(sessionId, quizState, trigger);
        this.updateSyncStatus({
          state: "queued",
          message: "Changes queued for sync",
        });
      } else {
        this.updateSyncStatus({
          state: "error",
          message: "Sync failed - retrying...",
        });
      }

      debugLog("Auto-save error", { trigger, error: errorMessage });

      return {
        success: false,
        trigger,
        timestamp: Date.now(),
        error: errorMessage,
        queued: AUTO_SAVE_CONFIG.enableOfflineQueue,
      };
    } finally {
      this.saveInProgress = false;
    }
  }

  /**
   * Wait for any in-flight save to settle. Used before quiz completion so the /complete
   * POST doesn't race a still-in-flight autosave for the most recent answer. Resolves
   * immediately if no save is in progress. Bounded by `timeoutMs` so a hung request
   * can't block completion forever.
   */
  async waitForIdle(timeoutMs: number = 1500): Promise<void> {
    if (!this.saveInProgress) return;
    const start = Date.now();
    return new Promise((resolve) => {
      const tick = () => {
        if (!this.saveInProgress) return resolve();
        if (Date.now() - start >= timeoutMs) return resolve();
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  /**
   * Check if periodic save should trigger
   */
  shouldPeriodicSave(currentAnswerCount: number): boolean {
    if (!AUTO_SAVE_CONFIG.enablePeriodicAutoSave) {
      return false;
    }

    const answersSinceLastSave = currentAnswerCount - this.lastAnswerCount;
    return answersSinceLastSave >= AUTO_SAVE_CONFIG.periodicSaveInterval;
  }

  /**
   * Fetch current database state
   */
  private async fetchDatabaseState(sessionId: string): Promise<QuizState | null> {
    try {
      const response = await fetch(`/api/user/quiz/sessions/${sessionId}`);
      if (!response.ok) return null;

      const data = await response.json();
      return data.state || null;
    } catch (error) {
      debugLog("Failed to fetch database state", error);
      return null;
    }
  }

  /**
   * Resolve conflicts between local and database state
   * Rule: Database is source of truth if exists, otherwise local is source of truth
   */
  private resolveConflicts(localState: QuizState, dbState: QuizState | null): QuizState {
    if (!dbState) {
      // No database state - use local
      debugLog("No database state, using local");
      return localState;
    }

    // Database exists - merge with database as source of truth
    debugLog("Resolving conflicts - database is source of truth");

    return {
      ...localState,
      // Use database values for these fields if they exist
      currentQuestionIndex: dbState.currentQuestionIndex ?? localState.currentQuestionIndex,
      status: dbState.status ?? localState.status,
      // Merge answers - database wins on conflicts
      answers: new Map([...localState.answers, ...dbState.answers]),
      // Keep local progress if more advanced (based on number of answered questions)
      progress:
        (localState.progress?.answered || 0) >= (dbState.progress?.answered || 0)
          ? localState.progress
          : dbState.progress || { answered: 0, correct: 0, incorrect: 0, percentage: 0 },
      // Sum time spent
      totalTimeSpent: (localState.totalTimeSpent || 0) + (dbState.totalTimeSpent || 0),
    };
  }

  /**
   * Update sync status
   */
  private updateSyncStatus(status: SyncStatus): void {
    if (AUTO_SAVE_CONFIG.showSyncStatus && this.syncStatusCallback) {
      this.syncStatusCallback(status);
    }
  }

  /**
   * Start offline queue processor
   */
  private startQueueProcessor(): void {
    if (!AUTO_SAVE_CONFIG.enableOfflineQueue) return;

    // Process queue every 10 seconds
    setInterval(async () => {
      // Skip the network round-trip when the browser knows we're offline. The
      // queue items will stay in localStorage; the next online-tick (or the
      // browser's `online` event handler elsewhere) will drain them.
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      const status = this.offlineQueue.getQueueStatus();

      if (status.ready > 0) {
        debugLog("Processing offline queue", status);

        await this.offlineQueue.processQueue(async (_sessionId, data, trigger) => {
          try {
            // Respect the queued item's original trigger. Replaying a periodic /
            // manual / pause save as a completion call (`/complete` POST) is what
            // used to cause a tight loop on reconnect: every queued progress save
            // fired the completion endpoint, the server returned `success: true`,
            // each response triggered a re-render, and the cycle repeated for the
            // entire queue. Now only items that were originally completion calls
            // hit the completion endpoint.
            const state = data as QuizState;
            const result =
              trigger === "completion"
                ? await this.syncManager.syncQuizData(state)
                : await this.syncManager.saveProgress(state);
            return result.success;
          } catch {
            return false;
          }
        });
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return this.offlineQueue.getQueueStatus();
  }

  /**
   * Get last save time
   */
  getLastSaveTime(): number {
    return this.lastSaveTime;
  }
}
