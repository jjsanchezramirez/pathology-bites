// src/features/quiz/config/auto-save-config.ts

/**
 * Auto-save configuration for quiz sessions
 * 
 * Feature flags to control auto-save behavior:
 * - Auto-save on navigation away from quiz
 * - Periodic auto-save every N answers
 * - Offline queue with retry logic
 * - Sync status indicators
 */

export const AUTO_SAVE_CONFIG = {
  /**
   * Auto-save when user navigates away from quiz page
   * Sets status to 'paused' and syncs to database
   */
  enableAutoSaveOnNavigation: true,
  
  /**
   * Periodic auto-save every N answers
   * Keeps status as 'in_progress' and syncs silently
   */
  enablePeriodicAutoSave: true,
  periodicSaveInterval: 5, // Save every 5 answers
  
  /**
   * Offline queue for failed syncs
   * Retries with exponential backoff when connection available
   */
  enableOfflineQueue: true,
  maxQueueSize: 10,
  maxRetries: 5,
  initialRetryDelay: 1000, // 1 second
  maxRetryDelay: 30000, // 30 seconds
  
  /**
   * Show sync status indicator in quiz UI
   * Displays: Saved, Syncing, Offline, Error states
   */
  showSyncStatus: true,
  
  /**
   * Auto-save timeout (ms)
   * Maximum time to wait for auto-save before showing error
   */
  autoSaveTimeout: 10000, // 10 seconds
  
  /**
   * Debounce delay for auto-save (ms)
   * Prevents too many rapid saves
   */
  autoSaveDebounce: 500, // 500ms
  
  /**
   * Enable debug logging for auto-save operations
   */
  enableDebugLogging: false,
} as const;

/**
 * Sync status types
 */
export type SyncStatus = 
  | { state: 'idle', message: '' }
  | { state: 'saved', message: 'Quiz saved' }
  | { state: 'synced', message: 'All changes synced' }
  | { state: 'syncing', message: 'Syncing...' }
  | { state: 'offline', message: 'Offline - will sync when online' }
  | { state: 'error', message: 'Sync failed - retrying...' }
  | { state: 'queued', message: 'Changes queued for sync' };

/**
 * Auto-save trigger types
 */
export type AutoSaveTrigger = 
  | 'navigation' // User navigated away
  | 'periodic' // Periodic interval reached
  | 'manual' // User clicked Save & Exit
  | 'completion' // Quiz completed
  | 'pause' // User paused quiz
  | 'retry'; // Retry from offline queue

/**
 * Auto-save result
 */
export interface AutoSaveResult {
  success: boolean;
  trigger: AutoSaveTrigger;
  timestamp: number;
  error?: string;
  queued?: boolean;
}

/**
 * Offline queue item
 */
export interface OfflineQueueItem {
  id: string;
  sessionId: string;
  data: any;
  trigger: AutoSaveTrigger;
  timestamp: number;
  retryCount: number;
  nextRetryAt: number;
}

/**
 * Helper to calculate exponential backoff delay
 */
export function calculateRetryDelay(retryCount: number): number {
  const delay = AUTO_SAVE_CONFIG.initialRetryDelay * Math.pow(2, retryCount);
  return Math.min(delay, AUTO_SAVE_CONFIG.maxRetryDelay);
}

/**
 * Helper to check if retry should be attempted
 */
export function shouldRetry(item: OfflineQueueItem): boolean {
  return (
    item.retryCount < AUTO_SAVE_CONFIG.maxRetries &&
    Date.now() >= item.nextRetryAt
  );
}

/**
 * Debug logger
 */
export function debugLog(message: string, ...args: any[]): void {
  if (AUTO_SAVE_CONFIG.enableDebugLogging) {
    console.log(`[AutoSave] ${message}`, ...args);
  }
}

