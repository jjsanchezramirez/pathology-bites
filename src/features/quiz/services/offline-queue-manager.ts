// src/features/quiz/services/offline-queue-manager.ts

import { 
  AUTO_SAVE_CONFIG, 
  OfflineQueueItem, 
  AutoSaveTrigger,
  calculateRetryDelay,
  shouldRetry,
  debugLog
} from '../config/auto-save-config';

/**
 * Manages offline queue for failed sync operations
 * Stores failed syncs in localStorage and retries with exponential backoff
 */
export class OfflineQueueManager {
  private static readonly QUEUE_KEY = 'quiz_offline_queue';
  private retryTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Start retry loop if queue has items
    this.startRetryLoop();
  }

  /**
   * Add item to offline queue
   */
  addToQueue(
    sessionId: string,
    data: any,
    trigger: AutoSaveTrigger
  ): OfflineQueueItem {
    const queue = this.getQueue();
    
    // Check queue size limit
    if (queue.length >= AUTO_SAVE_CONFIG.maxQueueSize) {
      debugLog('Queue full, removing oldest item');
      queue.shift(); // Remove oldest
    }

    const item: OfflineQueueItem = {
      id: `${sessionId}_${Date.now()}`,
      sessionId,
      data,
      trigger,
      timestamp: Date.now(),
      retryCount: 0,
      nextRetryAt: Date.now() + AUTO_SAVE_CONFIG.initialRetryDelay
    };

    queue.push(item);
    this.saveQueue(queue);
    
    debugLog('Added to queue', item);
    
    // Start retry loop if not already running
    this.startRetryLoop();
    
    return item;
  }

  /**
   * Get all queued items
   */
  getQueue(): OfflineQueueItem[] {
    try {
      const stored = localStorage.getItem(OfflineQueueManager.QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to read offline queue:', error);
      return [];
    }
  }

  /**
   * Save queue to localStorage
   */
  private saveQueue(queue: OfflineQueueItem[]): void {
    try {
      localStorage.setItem(OfflineQueueManager.QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  /**
   * Remove item from queue
   */
  removeFromQueue(itemId: string): void {
    const queue = this.getQueue().filter(item => item.id !== itemId);
    this.saveQueue(queue);
    debugLog('Removed from queue', itemId);
  }

  /**
   * Update retry count for item
   */
  private updateRetryCount(itemId: string): void {
    const queue = this.getQueue();
    const item = queue.find(i => i.id === itemId);
    
    if (item) {
      item.retryCount++;
      item.nextRetryAt = Date.now() + calculateRetryDelay(item.retryCount);
      this.saveQueue(queue);
      debugLog('Updated retry count', item);
    }
  }

  /**
   * Get items ready for retry
   */
  getItemsReadyForRetry(): OfflineQueueItem[] {
    return this.getQueue().filter(shouldRetry);
  }

  /**
   * Process queue - attempt to sync all ready items
   */
  async processQueue(
    syncFunction: (sessionId: string, data: any) => Promise<boolean>
  ): Promise<{ succeeded: number; failed: number; queued: number }> {
    const items = this.getItemsReadyForRetry();
    let succeeded = 0;
    let failed = 0;

    debugLog('Processing queue', { itemCount: items.length });

    for (const item of items) {
      try {
        const success = await syncFunction(item.sessionId, item.data);
        
        if (success) {
          this.removeFromQueue(item.id);
          succeeded++;
          debugLog('Queue item synced successfully', item.id);
        } else {
          // Check if max retries reached
          if (item.retryCount >= AUTO_SAVE_CONFIG.maxRetries - 1) {
            this.removeFromQueue(item.id);
            failed++;
            debugLog('Queue item failed - max retries reached', item.id);
          } else {
            this.updateRetryCount(item.id);
            failed++;
            debugLog('Queue item failed - will retry', item.id);
          }
        }
      } catch (error) {
        debugLog('Queue item error', item.id, error);
        
        if (item.retryCount >= AUTO_SAVE_CONFIG.maxRetries - 1) {
          this.removeFromQueue(item.id);
          failed++;
        } else {
          this.updateRetryCount(item.id);
          failed++;
        }
      }
    }

    const queued = this.getQueue().length;
    debugLog('Queue processing complete', { succeeded, failed, queued });

    return { succeeded, failed, queued };
  }

  /**
   * Start retry loop
   */
  private startRetryLoop(): void {
    if (this.retryTimer) return; // Already running

    this.retryTimer = setInterval(() => {
      const queue = this.getQueue();
      
      if (queue.length === 0) {
        this.stopRetryLoop();
        return;
      }

      // Check if any items are ready for retry
      const readyItems = this.getItemsReadyForRetry();
      if (readyItems.length > 0) {
        debugLog('Retry loop found items ready', readyItems.length);
        // Trigger will be handled by external processor
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop retry loop
   */
  private stopRetryLoop(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
      debugLog('Retry loop stopped');
    }
  }

  /**
   * Clear entire queue
   */
  clearQueue(): void {
    this.saveQueue([]);
    debugLog('Queue cleared');
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    total: number;
    ready: number;
    waiting: number;
  } {
    const queue = this.getQueue();
    const ready = this.getItemsReadyForRetry();
    
    return {
      total: queue.length,
      ready: ready.length,
      waiting: queue.length - ready.length
    };
  }
}

