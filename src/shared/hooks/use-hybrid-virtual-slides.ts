/**
 * Hybrid Virtual Slides Hook
 * 
 * Strategy:
 * 1. Load lightweight search index for fast search/filtering (6.4 MB vs 24.8 MB)
 * 2. Fetch full slide details on-demand when needed
 * 3. Cache everything aggressively to minimize API calls
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { VirtualSlide } from '@/shared/types/virtual-slides'

// Lightweight search index interface
interface SlideSearchIndex {
  id: string
  repository: string
  category: string
  subcategory: string
  diagnosis: string
  patient_info: string
  stain_type: string
  age: string | null
  gender: string | null
  searchText: string // Pre-computed searchable text
  keywords?: string[]
}

interface SlideMetadata {
  totalSlides: number
  repositories: string[]
  categories: string[]
  subcategories: string[]
  stainTypes: string[]
  generatedAt: string
}

interface UseHybridVirtualSlidesOptions {
  search?: string
  repository?: string
  category?: string
  subcategory?: string
  enableRandomMode?: boolean
  pageSize?: number
}

interface HybridSlidesResult {
  // Search index data (always available)
  searchIndex: SlideSearchIndex[]
  metadata: SlideMetadata | null
  
  // Filtered results
  filteredSlides: SlideSearchIndex[]
  
  // Full slide details (loaded on-demand)
  slideDetails: Map<string, VirtualSlide>
  
  // Loading states
  isLoadingIndex: boolean
  isLoadingDetails: boolean
  
  // Actions
  loadSlideDetails: (slideIds: string[]) => Promise<VirtualSlide[]>
  generateRandomSlides: (count: number) => SlideSearchIndex[]
  
  // Error handling
  error: string | null
}

export function useHybridVirtualSlides(options: UseHybridVirtualSlidesOptions = {}): HybridSlidesResult {
  const [searchIndex, setSearchIndex] = useState<SlideSearchIndex[]>([])
  const [metadata, setMetadata] = useState<SlideMetadata | null>(null)
  const [slideDetails, setSlideDetails] = useState<Map<string, VirtualSlide>>(new Map())
  const [isLoadingIndex, setIsLoadingIndex] = useState(true)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load search index on mount
  useEffect(() => {
    async function loadSearchIndex() {
      try {
        setIsLoadingIndex(true)
        setError(null)
        
        console.log('🔄 Loading virtual slides search index...')
        
        // Load both index and metadata in parallel
        // Use API endpoint for index (better caching) and static file for metadata
        const [indexResponse, metadataResponse] = await Promise.all([
          fetch('/api/virtual-slides/search-index', {
            headers: { 'Cache-Control': 'public, max-age=86400' }
          }),
          fetch('/data/virtual-slides-metadata.json', {
            headers: { 'Cache-Control': 'public, max-age=86400' }
          })
        ])
        
        if (!indexResponse.ok) {
          throw new Error(`Failed to load search index: ${indexResponse.status}`)
        }
        
        if (!metadataResponse.ok) {
          throw new Error(`Failed to load metadata: ${metadataResponse.status}`)
        }
        
        const [indexData, metadataData] = await Promise.all([
          indexResponse.json(),
          metadataResponse.json()
        ])
        
        setSearchIndex(indexData)
        setMetadata(metadataData)
        
        console.log(`✅ Search index loaded: ${indexData.length} slides`)
        console.log(`📊 Index size: ${(JSON.stringify(indexData).length / 1024).toFixed(2)} KB`)
        
      } catch (err) {
        console.error('❌ Failed to load search index:', err)
        setError(err instanceof Error ? err.message : 'Failed to load search index')
      } finally {
        setIsLoadingIndex(false)
      }
    }
    
    loadSearchIndex()
  }, [])

  // Client-side filtering using search index
  const filteredSlides = useMemo(() => {
    if (!searchIndex.length) return []
    
    let filtered = searchIndex
    
    // Apply search filter
    if (options.search?.trim()) {
      const searchTerm = options.search.toLowerCase().trim()
      const searchWords = searchTerm.split(/\s+/)
      
      filtered = filtered.filter(slide => {
        // Search in pre-computed searchText for performance
        const matchesText = slide.searchText.includes(searchTerm)
        
        // Also check keywords if available
        const matchesKeywords = slide.keywords?.some(keyword => 
          keyword.toLowerCase().includes(searchTerm)
        ) || false
        
        // Multi-word search: all words must match
        const matchesAllWords = searchWords.every(word =>
          slide.searchText.includes(word)
        )
        
        return matchesText || matchesKeywords || matchesAllWords
      })
    }
    
    // Apply repository filter
    if (options.repository && options.repository !== 'all') {
      filtered = filtered.filter(slide => slide.repository === options.repository)
    }
    
    // Apply category filter
    if (options.category && options.category !== 'all') {
      filtered = filtered.filter(slide => slide.category === options.category)
    }
    
    // Apply subcategory filter
    if (options.subcategory && options.subcategory !== 'all') {
      filtered = filtered.filter(slide => slide.subcategory === options.subcategory)
    }
    
    return filtered
  }, [searchIndex, options.search, options.repository, options.category, options.subcategory])

  // Load full slide details on-demand
  const loadSlideDetails = useCallback(async (slideIds: string[]): Promise<VirtualSlide[]> => {
    const uncachedIds = slideIds.filter(id => !slideDetails.has(id))
    
    if (uncachedIds.length === 0) {
      // Return cached details
      return slideIds.map(id => slideDetails.get(id)!).filter(Boolean)
    }
    
    try {
      setIsLoadingDetails(true)
      
      console.log(`🔄 Loading details for ${uncachedIds.length} slides...`)
      
      // Use existing details API
      const response = await fetch(`/api/virtual-slides/details?ids=${uncachedIds.join(',')}`, {
        headers: { 'Cache-Control': 'public, max-age=86400' }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to load slide details: ${response.status}`)
      }
      
      const result = await response.json()
      const newSlides = result.data || []
      
      // Update cache
      setSlideDetails(prev => {
        const newCache = new Map(prev)
        newSlides.forEach((slide: VirtualSlide) => {
          newCache.set(slide.id, slide)
        })
        return newCache
      })
      
      console.log(`✅ Loaded details for ${newSlides.length} slides`)
      
      // Return all requested slides (cached + newly loaded)
      return slideIds.map(id => slideDetails.get(id) || newSlides.find((s: VirtualSlide) => s.id === id))
        .filter(Boolean) as VirtualSlide[]
      
    } catch (err) {
      console.error('❌ Failed to load slide details:', err)
      throw err
    } finally {
      setIsLoadingDetails(false)
    }
  }, [slideDetails])

  // Generate random slides from complete dataset
  const generateRandomSlides = useCallback((count: number): SlideSearchIndex[] => {
    if (!searchIndex.length) return []
    
    // Apply current filters to random selection
    const eligibleSlides = filteredSlides.length > 0 ? filteredSlides : searchIndex
    
    // Shuffle and return requested count
    const shuffled = [...eligibleSlides].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, count)
  }, [searchIndex, filteredSlides])

  return {
    searchIndex,
    metadata,
    filteredSlides,
    slideDetails,
    isLoadingIndex,
    isLoadingDetails,
    loadSlideDetails,
    generateRandomSlides,
    error
  }
}
