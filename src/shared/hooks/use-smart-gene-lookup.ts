// src/shared/hooks/use-smart-gene-lookup.ts
/**
 * Smart caching hook for gene lookup
 * Minimizes API calls with intelligent client-side caching
 */

import { useState, useCallback } from 'react'


interface GeneInfo {
  hgncId: string
  geneName: string
  geneProduct: string
  previousNames: string[]
  aliasSymbols: string[]
  chromosomeLocation: string
  description: string
}

interface GeneCache {
  [key: string]: {
    data: GeneInfo
    timestamp: number
  }
}

interface UseSmartGeneLookupResult {
  lookupGene: (symbol: string) => Promise<GeneInfo>
  isLoading: boolean
  error: string | null
  clearCache: () => void
  getCacheStats: () => { size: number; oldestEntry: string | null }
}

// Cache duration: 7 days (gene info is relatively stable)
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000
const MAX_CACHE_SIZE = 50 // Common genes only

export function useSmartGeneLookup(): UseSmartGeneLookupResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cache, setCache] = useState<GeneCache>(() => {
    // Load cache from localStorage on initialization
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('pathology-bites-gene-cache')
        return stored ? JSON.parse(stored) : {}
      } catch {
        return {}
      }
    }
    return {}
  })

  // Normalize gene symbol for consistent caching
  const normalizeSymbol = useCallback((symbol: string): string => {
    return symbol.trim().toUpperCase()
  }, [])

  // Save cache to localStorage
  const saveCache = useCallback((newCache: GeneCache) => {
    setCache(newCache)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pathology-bites-gene-cache', JSON.stringify(newCache))
      } catch (error) {
        console.warn('Failed to save gene cache to localStorage:', error)
      }
    }
  }, [])

  // Clean expired entries and manage cache size
  const cleanCache = useCallback((currentCache: GeneCache): GeneCache => {
    const now = Date.now()
    const validEntries: GeneCache = {}
    
    // Remove expired entries
    Object.entries(currentCache).forEach(([key, entry]) => {
      if (now - entry.timestamp < CACHE_TTL) {
        validEntries[key] = entry
      }
    })

    // If still too large, remove oldest entries
    if (Object.keys(validEntries).length > MAX_CACHE_SIZE) {
      const sortedEntries = Object.entries(validEntries)
        .sort(([, a], [, b]) => b.timestamp - a.timestamp) // Newest first
        .slice(0, MAX_CACHE_SIZE)
      
      return Object.fromEntries(sortedEntries)
    }

    return validEntries
  }, [])

  const lookupGene = useCallback(async (symbol: string): Promise<GeneInfo> => {
    if (!symbol.trim()) {
      throw new Error('Gene symbol cannot be empty')
    }

    setIsLoading(true)
    setError(null)

    try {
      const normalizedSymbol = normalizeSymbol(symbol)
      const cacheKey = normalizedSymbol
      
      // Check cache first
      const cachedEntry = cache[cacheKey]
      if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL) {
        console.log(`🎯 Gene cache hit: ${normalizedSymbol}`)
        setIsLoading(false)
        setError(null) // Ensure error is cleared on cache hit
        return cachedEntry.data
      }

      // Cache miss - fetch from API
      console.log(`🔄 Gene cache miss: ${normalizedSymbol}`)
      
      const response = await fetch(`/api/tools/gene-lookup?symbol=${encodeURIComponent(symbol.trim())}`)
      const result = await response.json()

      if (!response.ok) {
        const errorMessage = result.error || 'Failed to fetch gene information'
        setError(errorMessage)
        throw new Error(errorMessage)
      }

      const geneInfo = result.data

      // Update cache
      const cleanedCache = cleanCache(cache)
      const newCache = {
        ...cleanedCache,
        [cacheKey]: {
          data: geneInfo,
          timestamp: Date.now()
        }
      }
      
      saveCache(newCache)
      console.log(`✅ Gene cached: ${normalizedSymbol}`)
      
      // Clear any previous errors on successful lookup
      setError(null)
      
      return geneInfo

    } catch (err) {
      // Error already set above, don't set it again to prevent flashing
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [cache, normalizeSymbol, cleanCache, saveCache])

  const clearCache = useCallback(() => {
    setCache({})
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pathology-bites-gene-cache')
    }
    console.log('🗑️ Gene cache cleared')
  }, [])

  const getCacheStats = useCallback(() => {
    const entries = Object.values(cache)
    return {
      size: entries.length,
      oldestEntry: entries.length > 0 
        ? new Date(Math.min(...entries.map(e => e.timestamp))).toLocaleString()
        : null
    }
  }, [cache])

  // Initialize pre-loading of common genes after user interaction
  // Disabled to prevent interference with user searches
  // useEffect(() => {
  //   initializePreloading(lookupGene, {
  //     maxGenes: 8, // Conservative number for background loading
  //     batchSize: 2,
  //     delayBetweenBatches: 3000 // 3 second delays
  //   })
  // }, [lookupGene])

  return {
    lookupGene,
    isLoading,
    error,
    clearCache,
    getCacheStats
  }
}