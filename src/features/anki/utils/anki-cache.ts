// src/features/anki/utils/anki-cache.ts
/**
 * Aggressive caching utility for Anki data to minimize API requests
 * Uses localStorage for persistent caching across sessions
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

interface CacheConfig {
  ttl: number // Time to live in milliseconds
  maxSize?: number // Maximum number of entries
}

class AnkiCache {
  private static instance: AnkiCache
  private readonly prefix = 'anki_cache_'
  
  // Cache configurations for different data types
  private readonly configs = {
    json: { ttl: 24 * 60 * 60 * 1000, maxSize: 10 }, // 24 hours for JSON files
    image: { ttl: 30 * 24 * 60 * 60 * 1000, maxSize: 100 }, // 30 days for images
    metadata: { ttl: 7 * 24 * 60 * 60 * 1000, maxSize: 50 } // 7 days for metadata
  }

  static getInstance(): AnkiCache {
    if (!AnkiCache.instance) {
      AnkiCache.instance = new AnkiCache()
    }
    return AnkiCache.instance
  }

  private constructor() {
    // Clean up expired entries on initialization
    this.cleanup()
  }

  /**
   * Get data from cache
   */
  get<T>(key: string, type: keyof typeof this.configs = 'metadata'): T | null {
    try {
      const cacheKey = this.prefix + key
      const cached = localStorage.getItem(cacheKey)
      
      if (!cached) return null
      
      const entry: CacheEntry<T> = JSON.parse(cached)
      
      // Check if expired
      if (Date.now() > entry.expiresAt) {
        localStorage.removeItem(cacheKey)
        return null
      }
      
      return entry.data
    } catch (error) {
      console.warn('Cache get error:', error)
      return null
    }
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T, type: keyof typeof this.configs = 'metadata'): void {
    try {
      const config = this.configs[type]
      const cacheKey = this.prefix + key
      const now = Date.now()
      
      const entry: CacheEntry<T> = {
        data,
        timestamp: now,
        expiresAt: now + config.ttl
      }
      
      localStorage.setItem(cacheKey, JSON.stringify(entry))
      
      // Enforce max size if configured
      if (config.maxSize) {
        this.enforceMaxSize(type, config.maxSize)
      }
    } catch (error) {
      console.warn('Cache set error:', error)
    }
  }

  /**
   * Check if data exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * Remove specific entry from cache
   */
  remove(key: string): void {
    try {
      const cacheKey = this.prefix + key
      localStorage.removeItem(cacheKey)
    } catch (error) {
      console.warn('Cache remove error:', error)
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key)
        }
      })
    } catch (error) {
      console.warn('Cache clear error:', error)
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    try {
      const keys = Object.keys(localStorage)
      const now = Date.now()
      
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          try {
            const cached = localStorage.getItem(key)
            if (cached) {
              const entry: CacheEntry<any> = JSON.parse(cached)
              if (now > entry.expiresAt) {
                localStorage.removeItem(key)
              }
            }
          } catch {
            // Remove corrupted entries
            localStorage.removeItem(key)
          }
        }
      })
    } catch (error) {
      console.warn('Cache cleanup error:', error)
    }
  }

  /**
   * Enforce maximum cache size by removing oldest entries
   */
  private enforceMaxSize(type: keyof typeof this.configs, maxSize: number): void {
    try {
      const keys = Object.keys(localStorage)
      const typeKeys = keys.filter(key => key.startsWith(this.prefix))
      
      if (typeKeys.length <= maxSize) return
      
      // Get entries with timestamps
      const entries = typeKeys.map(key => {
        try {
          const cached = localStorage.getItem(key)
          if (cached) {
            const entry: CacheEntry<any> = JSON.parse(cached)
            return { key, timestamp: entry.timestamp }
          }
        } catch {
          return { key, timestamp: 0 }
        }
        return null
      }).filter(Boolean) as { key: string; timestamp: number }[]
      
      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a.timestamp - b.timestamp)
      
      // Remove oldest entries
      const toRemove = entries.slice(0, entries.length - maxSize)
      toRemove.forEach(({ key }) => localStorage.removeItem(key))
    } catch (error) {
      console.warn('Cache size enforcement error:', error)
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { totalEntries: number; totalSize: number; types: Record<string, number> } {
    try {
      const keys = Object.keys(localStorage)
      const cacheKeys = keys.filter(key => key.startsWith(this.prefix))
      
      let totalSize = 0
      const types: Record<string, number> = {}
      
      cacheKeys.forEach(key => {
        try {
          const value = localStorage.getItem(key)
          if (value) {
            totalSize += value.length
            // Try to determine type from key or content
            const type = 'unknown'
            types[type] = (types[type] || 0) + 1
          }
        } catch {
          // Ignore errors
        }
      })
      
      return {
        totalEntries: cacheKeys.length,
        totalSize,
        types
      }
    } catch (error) {
      console.warn('Cache stats error:', error)
      return { totalEntries: 0, totalSize: 0, types: {} }
    }
  }
}

// Export singleton instance
export const ankiCache = AnkiCache.getInstance()

/**
 * Cached fetch wrapper for Anki data
 */
export async function cachedFetch<T>(
  url: string, 
  cacheKey: string, 
  type: 'json' | 'image' | 'metadata' = 'metadata'
): Promise<T> {
  // Try cache first
  const cached = ankiCache.get<T>(cacheKey, type)
  if (cached) {
    console.log(`🎯 Cache hit for ${cacheKey} - serving from digital memory palace!`)
    return cached
  }

  console.log(`💾 Cache miss for ${cacheKey} - time to fetch from the cloud...`)
  
  // Fetch from network
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
  }
  
  const data = await response.json()
  
  // Cache the result
  ankiCache.set(cacheKey, data, type)
  
  return data
}

/**
 * Preload and cache image URLs
 */
export function preloadImages(imageUrls: string[]): void {
  imageUrls.forEach(url => {
    const img = new Image()
    img.src = url
    // Images will be cached by the browser
  })
}
