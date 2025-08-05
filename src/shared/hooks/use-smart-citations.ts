// src/shared/hooks/use-smart-citations.ts
/**
 * Smart caching hook for citation generation
 * Minimizes API calls with intelligent client-side caching
 */

import { useState, useCallback } from 'react'
import { CitationData } from '@/shared/utils/citation-extractor'

interface CitationCache {
  [key: string]: {
    data: CitationData
    timestamp: number
    type: 'url' | 'doi' | 'isbn'
  }
}

interface UseSmartCitationsResult {
  generateCitation: (input: string, type: 'url' | 'doi' | 'isbn') => Promise<CitationData>
  isLoading: boolean
  error: string | null
  clearCache: () => void
  getCacheStats: () => { size: number; oldestEntry: string | null }
}

// Cache duration: 24 hours for citations (they rarely change)
const CACHE_TTL = 24 * 60 * 60 * 1000
const MAX_CACHE_SIZE = 100 // Limit memory usage

export function useSmartCitations(): UseSmartCitationsResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cache, setCache] = useState<CitationCache>(() => {
    // Load cache from localStorage on initialization
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('pathology-bites-citations-cache')
        return stored ? JSON.parse(stored) : {}
      } catch {
        return {}
      }
    }
    return {}
  })

  // Normalize input for consistent caching
  const normalizeInput = useCallback((input: string, type: 'url' | 'doi' | 'isbn'): string => {
    const trimmed = input.trim().toLowerCase()
    
    switch (type) {
      case 'doi':
        return trimmed.replace(/^doi:/, '').replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
      case 'isbn':
        return trimmed.replace(/[-\s]/g, '').replace(/^isbn:?/i, '')
      case 'url':
        return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
      default:
        return trimmed
    }
  }, [])

  // Save cache to localStorage
  const saveCache = useCallback((newCache: CitationCache) => {
    setCache(newCache)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pathology-bites-citations-cache', JSON.stringify(newCache))
      } catch (error) {
        console.warn('Failed to save citations cache to localStorage:', error)
      }
    }
  }, [])

  // Clean expired entries and manage cache size
  const cleanCache = useCallback((currentCache: CitationCache): CitationCache => {
    const now = Date.now()
    const validEntries: CitationCache = {}
    
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

  const generateCitation = useCallback(async (input: string, type: 'url' | 'doi' | 'isbn'): Promise<CitationData> => {
    if (!input.trim()) {
      throw new Error('Input cannot be empty')
    }

    setIsLoading(true)
    setError(null)

    try {
      const normalizedInput = normalizeInput(input, type)
      const cacheKey = `${type}:${normalizedInput}`
      
      // Check cache first
      const cachedEntry = cache[cacheKey]
      if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL) {
        console.log(`🎯 Citation cache hit: ${type} - ${normalizedInput.substring(0, 50)}...`)
        setIsLoading(false)
        return cachedEntry.data
      }

      // Cache miss - fetch from API
      console.log(`🔄 Citation cache miss: ${type} - ${normalizedInput.substring(0, 50)}...`)
      
      let citationData: CitationData
      
      switch (type) {
        case 'url':
          const urlResponse = await fetch(`/api/tools/citation-generator/extract-url-metadata?url=${encodeURIComponent(input.trim())}`)
          if (!urlResponse.ok) {
            const errorData = await urlResponse.json().catch(() => ({ error: 'Unknown error' }))
            throw new Error(errorData.error || `HTTP ${urlResponse.status}: Failed to fetch website metadata`)
          }
          const urlMetadata = await urlResponse.json()
          citationData = {
            title: urlMetadata.title || extractTitleFromUrl(input),
            authors: Array.isArray(urlMetadata.authors) && urlMetadata.authors.length > 0
              ? urlMetadata.authors
              : ['Unknown Author'],
            year: urlMetadata.year || new Date().getFullYear().toString(),
            url: input,
            publisher: urlMetadata.publisher || extractDomainFromUrl(input),
            accessDate: new Date().toLocaleDateString('en-CA'),
            type: 'website'
          }
          break
          
        case 'isbn':
          const cleanIsbn = input.replace(/[-\s]/g, '')
          const isbnResponse = await fetch(`/api/tools/citation-generator/extract-book-metadata?isbn=${encodeURIComponent(cleanIsbn)}`)
          if (!isbnResponse.ok) {
            const errorData = await isbnResponse.json().catch(() => ({ error: 'Unknown error' }))
            throw new Error(errorData.error || `HTTP ${isbnResponse.status}: Failed to fetch book metadata`)
          }
          const bookMetadata = await isbnResponse.json()
          citationData = {
            title: bookMetadata.title || 'Unknown Title',
            authors: Array.isArray(bookMetadata.authors) && bookMetadata.authors.length > 0
              ? bookMetadata.authors
              : ['Unknown Author'],
            year: bookMetadata.year || new Date().getFullYear().toString(),
            publisher: bookMetadata.publisher || 'Unknown Publisher',
            type: 'book'
          }
          break
          
        case 'doi':
          const cleanDoi = input.replace(/^doi:/, '').replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
          const doiResponse = await fetch(`/api/tools/citation-generator/extract-journal-metadata?doi=${encodeURIComponent(cleanDoi)}`)
          if (!doiResponse.ok) {
            const errorData = await doiResponse.json().catch(() => ({ error: 'Unknown error' }))
            throw new Error(errorData.error || `HTTP ${doiResponse.status}: Failed to fetch journal metadata`)
          }
          const journalMetadata = await doiResponse.json()
          citationData = {
            title: journalMetadata.title || 'Unknown Title',
            authors: Array.isArray(journalMetadata.authors) && journalMetadata.authors.length > 0
              ? journalMetadata.authors
              : ['Unknown Author'],
            year: journalMetadata.year || new Date().getFullYear().toString(),
            journal: journalMetadata.journal || 'Unknown Journal',
            volume: journalMetadata.volume,
            issue: journalMetadata.issue,
            pages: journalMetadata.pages,
            doi: journalMetadata.doi || cleanDoi,
            url: journalMetadata.url,
            type: 'journal'
          }
          break
          
        default:
          throw new Error('Unsupported citation type')
      }

      // Update cache
      const cleanedCache = cleanCache(cache)
      const newCache = {
        ...cleanedCache,
        [cacheKey]: {
          data: citationData,
          timestamp: Date.now(),
          type
        }
      }
      
      saveCache(newCache)
      console.log(`✅ Citation cached: ${type} - ${normalizedInput.substring(0, 50)}...`)
      
      return citationData

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate citation'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [cache, normalizeInput, cleanCache, saveCache])

  const clearCache = useCallback(() => {
    setCache({})
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pathology-bites-citations-cache')
    }
    console.log('🗑️ Citations cache cleared')
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

  return {
    generateCitation,
    isLoading,
    error,
    clearCache,
    getCacheStats
  }
}

// Helper functions
function extractDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace(/^www\./, '')
  } catch {
    return 'Unknown Website'
  }
}

function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    
    const segments = pathname.split('/').filter(segment => segment.length > 0)
    const lastSegment = segments[segments.length - 1]
    
    if (lastSegment && lastSegment !== 'index.html') {
      return lastSegment
        .replace(/[-_]/g, ' ')
        .replace(/\.(html?|php|aspx?)$/i, '')
        .replace(/\b\w/g, l => l.toUpperCase())
    }
    
    return urlObj.hostname.replace(/^www\./, '')
  } catch {
    return 'Web Page'
  }
}