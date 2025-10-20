/**
 * WSI History Tracker
 * Tracks recently shown WSI slides to prevent repetition
 * Uses localStorage for persistence across sessions
 */

const HISTORY_KEY = 'wsi-question-history'
const MAX_HISTORY_SIZE = 100 // Track last 100 WSI IDs

export interface WSIHistoryEntry {
  id: string
  category: string
  timestamp: number
}

export class WSIHistoryTracker {
  private history: WSIHistoryEntry[] = []

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadHistory()
    }
  }

  /**
   * Load history from localStorage
   */
  private loadHistory(): void {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(HISTORY_KEY)
      if (stored) {
        this.history = JSON.parse(stored)
        console.log(`[WSI History] Loaded ${this.history.length} entries from storage`)
      }
    } catch (error) {
      console.error('[WSI History] Failed to load history:', error)
      this.history = []
    }
  }

  /**
   * Save history to localStorage
   */
  private saveHistory(): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history))
    } catch (error) {
      console.error('[WSI History] Failed to save history:', error)
    }
  }

  /**
   * Add a WSI ID to history
   */
  addToHistory(wsiId: string, category: string = 'all'): void {
    const entry: WSIHistoryEntry = {
      id: wsiId,
      category,
      timestamp: Date.now()
    }

    // Remove existing entry if present (prevents duplicates)
    this.history = this.history.filter(e => e.id !== wsiId)

    // Add to front
    this.history.unshift(entry)

    // Trim to max size
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history = this.history.slice(0, MAX_HISTORY_SIZE)
    }

    this.saveHistory()
    console.log(`[WSI History] Added ${wsiId} (${category}). Total: ${this.history.length}`)
  }

  /**
   * Get recently shown WSI IDs for a specific category
   * If category is 'all', returns recent IDs from all categories
   */
  getRecentIds(category: string = 'all'): string[] {
    if (category === 'all') {
      // Return all recent IDs regardless of category
      return this.history.map(e => e.id)
    }

    // Return IDs from this specific category
    return this.history
      .filter(e => e.category === category)
      .map(e => e.id)
  }

  /**
   * Clear history for a specific category
   */
  clearCategory(category: string): void {
    if (category === 'all') {
      this.history = []
    } else {
      this.history = this.history.filter(e => e.category !== category)
    }
    this.saveHistory()
    console.log(`[WSI History] Cleared history for category: ${category}`)
  }

  /**
   * Clear all history
   */
  clearAll(): void {
    this.history = []
    this.saveHistory()
    console.log('[WSI History] Cleared all history')
  }

  /**
   * Get current history size
   */
  getHistorySize(category?: string): number {
    if (!category || category === 'all') {
      return this.history.length
    }
    return this.history.filter(e => e.category === category).length
  }

  /**
   * Get history statistics
   */
  getStats(): { total: number; byCategory: Record<string, number> } {
    const byCategory: Record<string, number> = {}

    this.history.forEach(entry => {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1
    })

    return {
      total: this.history.length,
      byCategory
    }
  }
}

// Singleton instance
let trackerInstance: WSIHistoryTracker | null = null

export function getWSIHistoryTracker(): WSIHistoryTracker {
  if (!trackerInstance) {
    trackerInstance = new WSIHistoryTracker()
  }
  return trackerInstance
}
