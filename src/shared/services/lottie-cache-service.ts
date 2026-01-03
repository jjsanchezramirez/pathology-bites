// src/shared/services/lottie-cache-service.ts
// Service for caching Lottie animation JSON data in localStorage

const CACHE_PREFIX = 'pathology-bites-lottie'
const CACHE_VERSION = 'v1'
// Cache Lottie animations for 30 days (they rarely change)
const DEFAULT_TTL = 30 * 24 * 60 * 60 * 1000

interface LottieCacheEntry {
  data: unknown // Lottie animation JSON
  timestamp: number
  version: string
}

/**
 * Lottie Animation Cache Service
 * Caches Lottie JSON animations in localStorage to avoid repeated network requests
 */
class LottieCacheService {
  private memoryCache: Map<string, unknown> = new Map()

  /**
   * Get the full cache key for a Lottie animation
   */
  private getCacheKey(animationType: string): string {
    return `${CACHE_PREFIX}:${CACHE_VERSION}:${animationType}`
  }

  /**
   * Get Lottie animation from cache
   * Returns null if not found or expired
   */
  public get(animationType: string): unknown | null {
    // Try memory cache first (fastest)
    if (this.memoryCache.has(animationType)) {
      return this.memoryCache.get(animationType)
    }

    // Try localStorage
    if (typeof window === 'undefined') {
      return null
    }

    try {
      const cacheKey = this.getCacheKey(animationType)
      const cached = localStorage.getItem(cacheKey)
      
      if (!cached) {
        return null
      }

      const entry: LottieCacheEntry = JSON.parse(cached)

      // Check version
      if (entry.version !== CACHE_VERSION) {
        this.delete(animationType)
        return null
      }

      // Check if expired
      const now = Date.now()
      if (now - entry.timestamp > DEFAULT_TTL) {
        this.delete(animationType)
        return null
      }

      // Store in memory cache for faster subsequent access
      this.memoryCache.set(animationType, entry.data)

      return entry.data
    } catch (error) {
      console.warn(`[LottieCache] Failed to get ${animationType} from cache:`, error)
      return null
    }
  }

  /**
   * Store Lottie animation in cache
   */
  public set(animationType: string, data: unknown): void {
    // Store in memory cache
    this.memoryCache.set(animationType, data)

    // Store in localStorage
    if (typeof window === 'undefined') {
      return
    }

    try {
      const cacheKey = this.getCacheKey(animationType)
      const entry: LottieCacheEntry = {
        data,
        timestamp: Date.now(),
        version: CACHE_VERSION
      }

      localStorage.setItem(cacheKey, JSON.stringify(entry))
    } catch (error) {
      console.warn(`[LottieCache] Failed to cache ${animationType}:`, error)
      // If localStorage is full, try to clean up old entries
      this.cleanup()
    }
  }

  /**
   * Delete a specific animation from cache
   */
  public delete(animationType: string): void {
    this.memoryCache.delete(animationType)

    if (typeof window === 'undefined') {
      return
    }

    try {
      const cacheKey = this.getCacheKey(animationType)
      localStorage.removeItem(cacheKey)
    } catch (error) {
      console.warn(`[LottieCache] Failed to delete ${animationType}:`, error)
    }
  }

  /**
   * Clean up expired or old version cache entries
   */
  public cleanup(): void {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const keysToRemove: string[] = []
      const now = Date.now()

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key || !key.startsWith(CACHE_PREFIX)) {
          continue
        }

        try {
          const cached = localStorage.getItem(key)
          if (!cached) continue

          const entry: LottieCacheEntry = JSON.parse(cached)

          // Remove if wrong version or expired
          if (entry.version !== CACHE_VERSION || now - entry.timestamp > DEFAULT_TTL) {
            keysToRemove.push(key)
          }
        } catch {
          // Invalid entry, remove it
          keysToRemove.push(key)
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key))

      if (keysToRemove.length > 0) {
        console.log(`[LottieCache] Cleaned up ${keysToRemove.length} expired entries`)
      }
    } catch (error) {
      console.warn('[LottieCache] Cleanup failed:', error)
    }
  }

  /**
   * Clear all Lottie cache entries
   */
  public clearAll(): void {
    this.memoryCache.clear()

    if (typeof window === 'undefined') {
      return
    }

    try {
      const keysToRemove: string[] = []

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(key)
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key))
      console.log(`[LottieCache] Cleared ${keysToRemove.length} cache entries`)
    } catch (error) {
      console.warn('[LottieCache] Failed to clear cache:', error)
    }
  }
}

// Export singleton instance
export const lottieCacheService = new LottieCacheService()

