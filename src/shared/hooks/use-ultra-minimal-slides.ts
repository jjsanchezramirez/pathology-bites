/**
 * Ultra-minimal virtual slides hook
 * 
 * Strategy:
 * 1. Load 4.38 MB search index once (cached 7 days)
 * 2. All search/filtering happens client-side (instant)
 * 3. Load full details on-demand only when needed
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { VirtualSlide } from '@/shared/types/virtual-slides'

// Smart-minimal search index (essential fields for display + search)
interface MinimalSlide {
  id: string
  diagnosis: string
  repository: string
  category: string
  subcategory?: string
  patient_info?: string
  age?: string | null
  gender?: string | null
  stain_type?: string
  preview_image_url?: string | null
  slide_url?: string | null
  case_url?: string | null
  clinical_history?: string
  searchText: string
}

interface UseUltraMinimalSlidesOptions {
  search?: string
  repository?: string
  category?: string
}

export function useUltraMinimalSlides(options: UseUltraMinimalSlidesOptions = {}) {
  const [searchIndex, setSearchIndex] = useState<MinimalSlide[]>([])
  const [slideDetails, setSlideDetails] = useState<Map<string, VirtualSlide>>(new Map())
  const [isLoadingIndex, setIsLoadingIndex] = useState(true)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load search index once on mount
  useEffect(() => {
    async function loadSearchIndex() {
      try {
        setIsLoadingIndex(true)
        setError(null)
        
        console.log('🔄 Loading ultra-minimal search index (complete dataset)...')
        const response = await fetch('/api/virtual-slides/search', {
          headers: { 'Cache-Control': 'public, max-age=604800' } // 7 days
        })

        if (!response.ok) {
          throw new Error(`Failed to load search index: ${response.status}`)
        }

        const result = await response.json()
        setSearchIndex(result.data)

        console.log(`✅ Complete search index loaded: ${result.data.length} slides, ${result.metadata.fileSize}`)
        console.log(`🔍 Search capability: Full dataset of ${result.data.length} slides available for client-side search`)
        
      } catch (err) {
        console.error('❌ Failed to load search index:', err)
        setError(err instanceof Error ? err.message : 'Failed to load search index')
      } finally {
        setIsLoadingIndex(false)
      }
    }
    
    loadSearchIndex()
  }, [])

  // Client-side filtering (instant, no API calls)
  const filteredSlides = useMemo(() => {
    if (!searchIndex.length) return []
    
    let filtered = searchIndex
    
    // Search filter
    if (options.search?.trim()) {
      const searchTerm = options.search.toLowerCase().trim()
      filtered = filtered.filter(slide => 
        slide.searchText.includes(searchTerm)
      )
    }
    
    // Repository filter
    if (options.repository && options.repository !== 'all') {
      filtered = filtered.filter(slide => slide.repository === options.repository)
    }
    
    // Category filter
    if (options.category && options.category !== 'all') {
      filtered = filtered.filter(slide => slide.category === options.category)
    }
    
    return filtered
  }, [searchIndex, options.search, options.repository, options.category])

  // Load full details on-demand
  const loadSlideDetails = useCallback(async (slideIds: string[]): Promise<VirtualSlide[]> => {
    const uncachedIds = slideIds.filter(id => !slideDetails.has(id))
    
    if (uncachedIds.length === 0) {
      return slideIds.map(id => slideDetails.get(id)!).filter(Boolean)
    }
    
    try {
      setIsLoadingDetails(true)
      
      console.log(`🔄 Loading optimized details for ${uncachedIds.length} slides...`)
      
      const response = await fetch(`/api/virtual-slides/optimized?ids=${uncachedIds.join(',')}`, {
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
      
      console.log(`✅ Loaded optimized details: ${newSlides.length} slides`)
      
      return slideIds.map(id => slideDetails.get(id) || newSlides.find((s: VirtualSlide) => s.id === id))
        .filter(Boolean) as VirtualSlide[]
      
    } catch (err) {
      console.error('❌ Failed to load slide details:', err)
      throw err
    } finally {
      setIsLoadingDetails(false)
    }
  }, [slideDetails])

  // Generate random slides (instant, client-side)
  const generateRandomSlides = useCallback((count: number): MinimalSlide[] => {
    if (!searchIndex.length) return []
    
    // Use filtered slides if filters are applied, otherwise use full index
    const sourceSlides = filteredSlides.length > 0 ? filteredSlides : searchIndex
    
    // Shuffle and return
    const shuffled = [...sourceSlides].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, count)
  }, [searchIndex, filteredSlides])

  // Get unique filter values from search index
  const repositories = useMemo(() => {
    return [...new Set(searchIndex.map(s => s.repository))].filter(Boolean).sort()
  }, [searchIndex])

  const categories = useMemo(() => {
    return [...new Set(searchIndex.map(s => s.category))].filter(Boolean).sort()
  }, [searchIndex])

  return {
    // Core data
    searchIndex,
    filteredSlides,
    slideDetails,
    
    // Filter options
    repositories,
    categories,
    
    // Loading states
    isLoadingIndex,
    isLoadingDetails,
    error,
    
    // Actions
    loadSlideDetails,
    generateRandomSlides
  }
}
