// src/features/quiz/services/auto-save-manager.ts

import { 
  AUTO_SAVE_CONFIG, 
  AutoSaveTrigger, 
  AutoSaveResult,
  SyncStatus,
  debugLog
} from '../config/auto-save-config';
import { OfflineQueueManager } from './offline-queue-manager';
import { DatabaseSyncManager } from '../hybrid/core/database-sync-manager';
import type { QuizState } from '../hybrid/core/quiz-state-machine';

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

  constructor(
    syncManager: DatabaseSyncManager,
    onSyncStatusChange?: (status: SyncStatus) => void
  ) {
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
      debugLog('Save already in progress, skipping', trigger);
      return {
        success: false,
        trigger,
        timestamp: Date.now(),
        error: 'Save already in progress'
      };
    }

    this.saveInProgress = true;
    this.updateSyncStatus({ state: 'syncing', message: 'Syncing...' });

    try {
      // Step 1: Fetch current database state for conflict resolution
      const dbState = await this.fetchDatabaseState(sessionId);

      // Step 2: Resolve conflicts
      const resolvedState = this.resolveConflicts(quizState, dbState);

      // Step 3: Attempt to sync
      // Use saveProgress for non-completion triggers, syncQuizData for completion
      const isCompletion = trigger === 'completion';
      const result = isCompletion
        ? await this.syncManager.syncQuizData(resolvedState)
        : await this.syncManager.saveProgress(resolvedState, timeRemaining);

      if (result.success) {
        this.lastSaveTime = Date.now();
        this.lastAnswerCount = quizState.answers.size;
        
        const message = trigger === 'manual' ? 'Quiz saved' : 'All changes synced';
        this.updateSyncStatus({ state: 'synced', message });
        
        debugLog('Auto-save successful', { trigger, timestamp: result.timestamp });
        
        return {
          success: true,
          trigger,
          timestamp: result.timestamp
        };
      } else {
        // Sync failed - add to offline queue
        if (AUTO_SAVE_CONFIG.enableOfflineQueue) {
          this.offlineQueue.addToQueue(sessionId, resolvedState, trigger);
          this.updateSyncStatus({ 
            state: 'queued', 
            message: 'Changes queued for sync' 
          });
          
          debugLog('Auto-save queued', { trigger, error: result.error });
          
          return {
            success: false,
            trigger,
            timestamp: Date.now(),
            error: result.error,
            queued: true
          };
        } else {
          this.updateSyncStatus({ 
            state: 'error', 
            message: 'Sync failed - retrying...' 
          });
          
          return {
            success: false,
            trigger,
            timestamp: Date.now(),
            error: result.error
          };
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Add to offline queue on error
      if (AUTO_SAVE_CONFIG.enableOfflineQueue) {
        this.offlineQueue.addToQueue(sessionId, quizState, trigger);
        this.updateSyncStatus({ 
          state: 'queued', 
          message: 'Changes queued for sync' 
        });
      } else {
        this.updateSyncStatus({ 
          state: 'error', 
          message: 'Sync failed - retrying...' 
        });
      }
      
      debugLog('Auto-save error', { trigger, error: errorMessage });
      
      return {
        success: false,
        trigger,
        timestamp: Date.now(),
        error: errorMessage,
        queued: AUTO_SAVE_CONFIG.enableOfflineQueue
      };
    } finally {
      this.saveInProgress = false;
    }
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
      const response = await fetch(`/api/quiz/sessions/${sessionId}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.state || null;
    } catch (error) {
      debugLog('Failed to fetch database state', error);
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
      debugLog('No database state, using local');
      return localState;
    }

    // Database exists - merge with database as source of truth
    debugLog('Resolving conflicts - database is source of truth');
    
    return {
      ...localState,
      // Use database values for these fields if they exist
      currentQuestionIndex: dbState.currentQuestionIndex ?? localState.currentQuestionIndex,
      status: dbState.status ?? localState.status,
      // Merge answers - database wins on conflicts
      answers: new Map([...localState.answers, ...dbState.answers]),
      // Keep local progress if more advanced
      progress: Math.max(localState.progress, dbState.progress || 0),
      // Sum time spent
      totalTimeSpent: (localState.totalTimeSpent || 0) + (dbState.totalTimeSpent || 0)
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
      const status = this.offlineQueue.getQueueStatus();
      
      if (status.ready > 0) {
        debugLog('Processing offline queue', status);
        
        await this.offlineQueue.processQueue(async (sessionId, data) => {
          try {
            const result = await this.syncManager.syncQuizData(data);
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

