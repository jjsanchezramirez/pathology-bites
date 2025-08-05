// src/shared/hooks/use-progressive-slides.ts
/**
 * Smart progressive loading hook for virtual slides
 * Implements "what you use is what you get" pattern
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useCachedData } from './use-cached-data'

interface SlideMetadata {
  id: string
  repository: string
  category: string
  subcategory: string
  diagnosis: string
  hasDetails: boolean
}

interface VirtualSlide extends SlideMetadata {
  url?: string
  thumbnail_url?: string
  patient_info?: string
  clinical_history?: string
  age?: number | null
  gender?: string | null
  [key: string]: any
}

interface UseProgressiveSlidesOptions {
  search?: string
  repository?: string
  category?: string
  subcategory?: string
}

interface ProgressiveSlideData {
  metadata: SlideMetadata
  details?: VirtualSlide
  isLoadingDetails: boolean
  hasDetails: boolean
}

export function useProgressiveSlides(options: UseProgressiveSlidesOptions = {}) {
  const [detailsCache, setDetailsCache] = useState<Map<string, VirtualSlide>>(new Map())
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set())
  const [prefetchQueue, setPrefetchQueue] = useState<string[]>([])

  // Load lightweight metadata first (95% size reduction)
  const { 
    data: metadataResponse, 
    isLoading: isLoadingMetadata, 
    error: metadataError 
  } = useCachedData(
    `virtual-slides-metadata-${JSON.stringify(options)}`,
    async () => {
      const params = new URLSearchParams()
      if (options.search) params.set('search', options.search)
      if (options.repository) params.set('repository', options.repository)
      if (options.category) params.set('category', options.category)
      if (options.subcategory) params.set('subcategory', options.subcategory)

      console.log('🔄 Fetching virtual slides metadata...')
      const response = await fetch(`/api/virtual-slides/metadata?${params}`, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'public, max-age=86400'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.status}`)
      }

      const result = await response.json()
      console.log(`✅ Metadata loaded: ${result.data.length} slides, ${result.metadata.sizeReduction} size reduction`)
      
      return result
    },
    {
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      staleTime: 12 * 60 * 60 * 1000, // 12 hours
      storage: 'localStorage',
      prefix: 'pathology-bites-metadata'
    }
  )

  const metadata = metadataResponse?.data || []

  // Smart detail loading with batching
  const loadSlideDetails = useCallback(async (slideIds: string | string[]) => {
    const ids = Array.isArray(slideIds) ? slideIds : [slideIds]
    const uncachedIds = ids.filter(id => !detailsCache.has(id) && !loadingDetails.has(id))
    
    if (uncachedIds.length === 0) {
      return // All requested slides are already cached or loading
    }

    console.log(`🔄 Loading details for ${uncachedIds.length} slides...`)
    
    // Mark as loading
    setLoadingDetails(prev => {
      const newSet = new Set(prev)
      uncachedIds.forEach(id => newSet.add(id))
      return newSet
    })

    try {
      // Use batch API for multiple slides, single API for one slide
      const url = uncachedIds.length === 1 
        ? `/api/virtual-slides/details?id=${uncachedIds[0]}`
        : `/api/virtual-slides/details?ids=${uncachedIds.join(',')}`

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'public, max-age=86400'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to load slide details: ${response.status}`)
      }

      const result = await response.json()
      const slides = result.data || []

      console.log(`✅ Details loaded: ${slides.length} slides`)

      // Update cache
      setDetailsCache(prev => {
        const newCache = new Map(prev)
        slides.forEach((slide: VirtualSlide) => {
          newCache.set(slide.id, slide)
        })
        return newCache
      })

    } catch (error) {
      console.error('❌ Failed to load slide details:', error)
    } finally {
      // Remove from loading set
      setLoadingDetails(prev => {
        const newSet = new Set(prev)
        uncachedIds.forEach(id => newSet.delete(id))
        return newSet
      })
    }
  }, [detailsCache, loadingDetails])

  // Predictive prefetching based on user behavior
  const prefetchSlideDetails = useCallback((slideIds: string[]) => {
    const uniqueIds = [...new Set(slideIds)]
    const uncachedIds = uniqueIds.filter(id => !detailsCache.has(id) && !loadingDetails.has(id))
    
    if (uncachedIds.length > 0) {
      setPrefetchQueue(prev => {
        const newQueue = [...prev, ...uncachedIds]
        return [...new Set(newQueue)] // Remove duplicates
      })
    }
  }, [detailsCache, loadingDetails])

  // Process prefetch queue with debouncing
  useEffect(() => {
    if (prefetchQueue.length === 0) return

    const timer = setTimeout(() => {
      const batchSize = Math.min(10, prefetchQueue.length) // Prefetch in small batches
      const batch = prefetchQueue.slice(0, batchSize)
      
      loadSlideDetails(batch)
      setPrefetchQueue(prev => prev.slice(batchSize))
    }, 500) // 500ms debounce

    return () => clearTimeout(timer)
  }, [prefetchQueue, loadSlideDetails])

  // Combine metadata with cached details
  const progressiveSlides: ProgressiveSlideData[] = useMemo(() => {
    return metadata.map((meta: any) => ({
      metadata: meta,
      details: detailsCache.get(meta.id),
      isLoadingDetails: loadingDetails.has(meta.id),
      hasDetails: meta.hasDetails
    }))
  }, [metadata, detailsCache, loadingDetails])

  // Helper function to get slide data (metadata + details if available)
  const getSlideData = useCallback((slideId: string) => {
    const progressiveSlide = progressiveSlides.find(s => s.metadata.id === slideId)
    if (!progressiveSlide) return null

    // Return combined data (metadata + details if available)
    return {
      ...progressiveSlide.metadata,
      ...(progressiveSlide.details || {}),
      _isLoadingDetails: progressiveSlide.isLoadingDetails,
      _hasFullDetails: Boolean(progressiveSlide.details)
    }
  }, [progressiveSlides])

  return {
    // Core data
    slides: progressiveSlides,
    metadata: metadataResponse?.metadata,
    
    // Loading states
    isLoadingMetadata,
    isLoadingAnyDetails: loadingDetails.size > 0,
    
    // Errors
    error: metadataError,
    
    // Actions
    loadSlideDetails,
    prefetchSlideDetails,
    getSlideData,
    
    // Stats
    totalSlides: metadata.length,
    cachedDetailsCount: detailsCache.size,
    loadingDetailsCount: loadingDetails.size,
    prefetchQueueSize: prefetchQueue.length
  }
}