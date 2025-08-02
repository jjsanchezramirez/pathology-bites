// src/shared/utils/r2-direct-access.ts
/**
 * Direct R2 access utilities to minimize Vercel API usage
 * Uses public R2 URLs and client-side caching for optimal performance
 */

// R2 public URLs - no Vercel API calls needed
export const R2_PUBLIC_URLS = {
  ABPATH_CONTENT_SPECS_JSON: '',
  CELL_QUIZ_IMAGES_JSON: '',
  CELL_QUIZ_REFERENCES_JSON: '',
  NLM_JOURNAL_ABBREVIATIONS_JSON: '',
  VIRTUAL_SLIDES_JSON: '',
  CONTEXT_DATA_URL: '',
  PATHOLOGY_BITES_IMAGES_URL: 's',
  PATHPRIMER_DATA: '',
  IMAGES: '',
} as const

interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  staleWhileRevalidate?: number // Serve stale data while revalidating
}

interface CachedResponse<T> {
  data: T
  timestamp: number
  etag?: string
}

/**
 * Client-side cache for R2 data to minimize requests
 */
class R2Cache {
  private cache = new Map<string, CachedResponse<any>>()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly DEFAULT_SWR = 2 * 60 * 1000 // 2 minutes

  /**
   * Fetch data with intelligent caching
   */
  async fetch<T>(
    url: string, 
    options: CacheOptions = {}
  ): Promise<T> {
    const { ttl = this.DEFAULT_TTL, staleWhileRevalidate = this.DEFAULT_SWR } = options
    const cacheKey = url
    const cached = this.cache.get(cacheKey)
    const now = Date.now()

    // Return fresh cached data
    if (cached && (now - cached.timestamp) < ttl) {
      return cached.data
    }

    // Return stale data while revalidating in background
    if (cached && (now - cached.timestamp) < (ttl + staleWhileRevalidate)) {
      // Revalidate in background
      this.fetchAndCache(url, cacheKey).catch(console.error)
      return cached.data
    }

    // Fetch fresh data
    return this.fetchAndCache(url, cacheKey)
  }

  private async fetchAndCache<T>(url: string, cacheKey: string): Promise<T> {
    try {
      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'public, max-age=300', // 5 minutes browser cache
        }
      })

      if (!response.ok) {
        throw new Error(`R2 fetch failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const etag = response.headers.get('etag')

      // Cache the response
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        etag: etag || undefined
      })

      return data
    } catch (error) {
      console.error('R2 direct fetch error:', error)
      
      // Return stale data if available during errors
      const cached = this.cache.get(cacheKey)
      if (cached) {
        console.warn('Returning stale data due to fetch error')
        return cached.data
      }
      
      throw error
    }
  }

  /**
   * Invalidate cache entry
   */
  invalidate(url: string): void {
    this.cache.delete(url)
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache stats for debugging
   */
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
      totalMemory: JSON.stringify(Array.from(this.cache.values())).length
    }
  }
}

// Global cache instance
export const r2Cache = new R2Cache()

/**
 * Direct R2 data fetchers - no Vercel API usage
 */
export const r2DirectAccess = {
  /**
   * Fetch virtual slides data directly from R2
   */
  async getVirtualSlides(options: CacheOptions = {}) {
    return r2Cache.fetch(R2_PUBLIC_URLS.VIRTUAL_SLIDES_JSON, {
      ttl: 10 * 60 * 1000, // 10 minutes (this data changes infrequently)
      staleWhileRevalidate: 5 * 60 * 1000, // 5 minutes
      ...options
    })
  },

  /**
   * Fetch PathPrimer data directly from R2
   */
  async getPathPrimerData(filename: string, options: CacheOptions = {}) {
    const url = `${R2_PUBLIC_URLS.PATHPRIMER_DATA}/${filename}`
    return r2Cache.fetch(url, {
      ttl: 30 * 60 * 1000, // 30 minutes (educational content is stable)
      staleWhileRevalidate: 10 * 60 * 1000, // 10 minutes
      ...options
    })
  },

  /**
   * Get optimized image URL directly from R2
   */
  getImageUrl(imagePath: string, options?: {
    width?: number
    height?: number
    quality?: number
    format?: 'webp' | 'avif' | 'jpeg' | 'png'
  }): string {
    const baseUrl = `${R2_PUBLIC_URLS.IMAGES}/${imagePath}`
    
    // If no optimization needed, return direct URL
    if (!options) return baseUrl
    
    // Build Cloudflare Image Resizing URL
    const params = new URLSearchParams()
    if (options.width) params.set('width', options.width.toString())
    if (options.height) params.set('height', options.height.toString())
    if (options.quality) params.set('quality', options.quality.toString())
    if (options.format) params.set('format', options.format)
    
    return `${baseUrl}?${params.toString()}`
  },

  /**
   * Preload critical data for better UX
   */
  async preloadCriticalData() {
    try {
      // Preload virtual slides in background
      this.getVirtualSlides().catch(console.error)
      
      console.log('R2 critical data preloading initiated')
    } catch (error) {
      console.error('R2 preload failed:', error)
    }
  }
}

/**
 * Hook for using R2 direct access in React components
 */
export function useR2DirectAccess() {
  return {
    ...r2DirectAccess,
    cache: r2Cache,
    clearCache: () => r2Cache.clear(),
    getCacheStats: () => r2Cache.getStats()
  }
}
