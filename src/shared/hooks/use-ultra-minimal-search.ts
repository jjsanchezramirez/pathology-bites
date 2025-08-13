/**
 * Ultra-minimal search hook with 2-file strategy
 * 1. Loads ultra-minimal search index (2.5 MB) for instant search
 * 2. Fetches full details on-demand when needed
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { VirtualSlide } from '@/shared/types/virtual-slides'

// Ultra-minimal search entry (compressed format)
interface UltraMinimalEntry {
  i: string // Short ID (base-36)
  s: string // Compressed searchText
}

// ID mapping type
type IdMapping = Record<string, string>

interface UseUltraMinimalSearchResult {
  // Search state
  searchResults: string[] // Array of original slide IDs
  isLoading: boolean
  error: string | null
  
  // Search functions
  search: (query: string) => void
  clearSearch: () => void
  
  // Detail loading
  loadSlideDetails: (ids: string[]) => Promise<VirtualSlide[]>
  slideDetailsCache: Map<string, VirtualSlide>
  
  // Stats
  totalSlides: number
  searchResultsCount: number
}

export function useUltraMinimalSearch(): UseUltraMinimalSearchResult {
  const [searchIndex, setSearchIndex] = useState<UltraMinimalEntry[]>([])
  const [idMapping, setIdMapping] = useState<IdMapping>({})
  const [searchResults, setSearchResults] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [slideDetailsCache, setSlideDetailsCache] = useState<Map<string, VirtualSlide>>(new Map())

  // Load ultra-minimal search index and ID mapping
  useEffect(() => {
    async function loadSearchIndex() {
      try {
        setIsLoading(true)
        console.log('🔄 Loading ultra-minimal search index...')

        // Load search index and ID mapping from R2 APIs in parallel
        const [searchResponse, mappingResponse] = await Promise.all([
          fetch('/api/virtual-slides/search'),
          fetch('/api/virtual-slides/id-mapping')
        ])

        if (!searchResponse.ok || !mappingResponse.ok) {
          throw new Error('Failed to load search data from R2')
        }

        const [searchResult, mappingResult] = await Promise.all([
          searchResponse.json(),
          mappingResponse.json()
        ])

        const searchData = searchResult.data
        const mappingData = mappingResult.data

        setSearchIndex(searchData)
        setIdMapping(mappingData)
        
        // Initialize with all slides
        const allIds = searchData.map((entry: UltraMinimalEntry) => mappingData[entry.i])
        setSearchResults(allIds)

        console.log(`✅ Ultra-minimal search loaded: ${searchData.length} slides, ${(JSON.stringify(searchData).length / 1024).toFixed(2)} KB`)
        
      } catch (err) {
        console.error('❌ Failed to load search index:', err)
        setError(err instanceof Error ? err.message : 'Failed to load search data')
      } finally {
        setIsLoading(false)
      }
    }

    loadSearchIndex()
  }, [])

  // Load full slide details on-demand
  const loadSlideDetails = useCallback(async (ids: string[]): Promise<VirtualSlide[]> => {
    // Check cache first
    const uncachedIds = ids.filter(id => !slideDetailsCache.has(id))

    if (uncachedIds.length === 0) {
      // All slides are cached
      return ids.map(id => slideDetailsCache.get(id)!).filter(Boolean)
    }

    try {
      console.log(`📋 Loading details for ${uncachedIds.length} slides...`)

      const response = await fetch(`/api/virtual-slides/details?ids=${uncachedIds.join(',')}`)

      if (!response.ok) {
        throw new Error(`Failed to load slide details: ${response.status}`)
      }

      const result = await response.json()
      const slides: VirtualSlide[] = result.data || []

      // Update cache
      setSlideDetailsCache(prev => {
        const newCache = new Map(prev)
        slides.forEach(slide => {
          newCache.set(slide.id, slide)
        })
        return newCache
      })

      // Return all requested slides (cached + newly loaded)
      const allRequestedSlides = ids.map(id => {
        const cached = slideDetailsCache.get(id)
        if (cached) return cached
        return slides.find(s => s.id === id)
      }).filter(Boolean) as VirtualSlide[]

      return allRequestedSlides

    } catch (err) {
      console.error('❌ Failed to load slide details:', err)
      throw err
    }
  }, [slideDetailsCache])

  // Search function (client-side, instant)
  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      // Show all slides
      const allIds = searchIndex.map(entry => idMapping[entry.i])
      setSearchResults(allIds)
      return
    }

    const queryLower = query.toLowerCase()
    const matchingEntries = searchIndex.filter(entry =>
      entry.s.includes(queryLower)
    )

    const matchingIds = matchingEntries.map(entry => idMapping[entry.i])
    setSearchResults(matchingIds)

    console.log(`🔍 Search "${query}": ${matchingIds.length} results`)

    // Immediately fetch details for the first page of results (surgical precision)
    const firstPageIds = matchingIds.slice(0, 10) // First 10 results
    if (firstPageIds.length > 0) {
      console.log(`📋 Pre-loading details for first ${firstPageIds.length} search results...`)
      try {
        await loadSlideDetails(firstPageIds)
      } catch (error) {
        console.error('Failed to pre-load search result details:', error)
      }
    }
  }, [searchIndex, idMapping, loadSlideDetails])

  // Clear search
  const clearSearch = useCallback(async () => {
    const allIds = searchIndex.map(entry => idMapping[entry.i])
    setSearchResults(allIds)

    // Pre-load details for first page when showing all results
    const firstPageIds = allIds.slice(0, 10)
    if (firstPageIds.length > 0) {
      console.log(`📋 Pre-loading details for first ${firstPageIds.length} slides...`)
      try {
        await loadSlideDetails(firstPageIds)
      } catch (error) {
        console.error('Failed to pre-load slide details:', error)
      }
    }
  }, [searchIndex, idMapping, loadSlideDetails])



  // Memoized stats
  const stats = useMemo(() => ({
    totalSlides: searchIndex.length,
    searchResultsCount: searchResults.length
  }), [searchIndex.length, searchResults.length])

  return {
    searchResults,
    isLoading,
    error,
    search,
    clearSearch,
    loadSlideDetails,
    slideDetailsCache,
    totalSlides: stats.totalSlides,
    searchResultsCount: stats.searchResultsCount
  }
}
