// src/shared/services/cache-service.ts
// Intelligent caching service with TTL and invalidation strategies

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  key: string
}

interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  storage?: 'memory' | 'localStorage' | 'sessionStorage'
  prefix?: string
}

class CacheService {
  private static instance: CacheService
  private memoryCache: Map<string, CacheEntry<any>> = new Map()
  private defaultTTL = 5 * 60 * 1000 // 5 minutes
  private defaultPrefix = 'pathology-bites-cache'

  private constructor() {
    // Clean up expired entries every minute
    setInterval(() => {
      this.cleanupExpiredEntries()
    }, 60 * 1000)
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService()
    }
    return CacheService.instance
  }

  // Set cache entry
  public set<T>(
    key: string,
    data: T,
    options: CacheOptions = {}
  ): void {
    const {
      ttl = this.defaultTTL,
      storage = 'memory',
      prefix = this.defaultPrefix
    } = options

    const fullKey = `${prefix}:${key}`
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      key: fullKey
    }

    switch (storage) {
      case 'memory':
        this.memoryCache.set(fullKey, entry)
        break
      case 'localStorage':
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(fullKey, JSON.stringify(entry))
          } catch (error) {
            // Fallback to memory cache
            this.memoryCache.set(fullKey, entry)
          }
        }
        break
      case 'sessionStorage':
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(fullKey, JSON.stringify(entry))
          } catch (error) {
            // Fallback to memory cache
            this.memoryCache.set(fullKey, entry)
          }
        }
        break
    }

  }

  // Get cache entry
  public get<T>(
    key: string,
    options: CacheOptions = {}
  ): T | null {
    const {
      storage = 'memory',
      prefix = this.defaultPrefix
    } = options

    const fullKey = `${prefix}:${key}`
    let entry: CacheEntry<T> | null = null

    switch (storage) {
      case 'memory':
        entry = this.memoryCache.get(fullKey) || null
        break
      case 'localStorage':
        if (typeof window !== 'undefined') {
          try {
            const stored = localStorage.getItem(fullKey)
            entry = stored ? JSON.parse(stored) : null
          } catch (error) {
            return null
          }
        }
        break
      case 'sessionStorage':
        if (typeof window !== 'undefined') {
          try {
            const stored = sessionStorage.getItem(fullKey)
            entry = stored ? JSON.parse(stored) : null
          } catch (error) {
            return null
          }
        }
        break
    }

    if (!entry) {
      return null
    }

    // Check if entry has expired
    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.delete(key, options)
      return null
    }

    return entry.data
  }

  // Delete cache entry
  public delete(key: string, options: CacheOptions = {}): void {
    const {
      storage = 'memory',
      prefix = this.defaultPrefix
    } = options

    const fullKey = `${prefix}:${key}`

    switch (storage) {
      case 'memory':
        this.memoryCache.delete(fullKey)
        break
      case 'localStorage':
        if (typeof window !== 'undefined') {
          localStorage.removeItem(fullKey)
        }
        break
      case 'sessionStorage':
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(fullKey)
        }
        break
    }

  }

  // Clear all cache entries with optional prefix filter
  public clear(prefix?: string): void {
    const targetPrefix = prefix || this.defaultPrefix

    // Clear memory cache
    for (const [key] of this.memoryCache) {
      if (key.startsWith(targetPrefix)) {
        this.memoryCache.delete(key)
      }
    }

    // Clear localStorage
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(targetPrefix)) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))

      // Clear sessionStorage
      const sessionKeysToRemove: string[] = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && key.startsWith(targetPrefix)) {
          sessionKeysToRemove.push(key)
        }
      }
      sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key))
    }

  }

  // Clean up expired entries from memory cache
  private cleanupExpiredEntries(): void {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, entry] of this.memoryCache) {
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key)
        cleanedCount++
      }
    }

  }

  // Get cache statistics
  public getStats(): {
    memoryEntries: number
    totalSize: number
  } {
    return {
      memoryEntries: this.memoryCache.size,
      totalSize: JSON.stringify(Array.from(this.memoryCache.entries())).length
    }
  }
}

// Export singleton instance
export const cacheService = CacheService.getInstance()

// Export types
export type { CacheOptions }