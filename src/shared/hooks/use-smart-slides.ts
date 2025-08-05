// src/shared/hooks/use-smart-slides.ts
/**
 * Smart loading hook for virtual slides
 * Progressive enhancement: starts with pagination, upgrades to full dataset as needed
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useCachedData } from './use-cached-data'
import { VirtualSlide } from '@/shared/types/virtual-slides'

interface UseSmartSlidesOptions {
  search?: string
  repository?: string
  category?: string
  subcategory?: string
  initialLimit?: number
}

interface SmartSlidesResult {
  slides: VirtualSlide[]
  isLoading: boolean
  error: any
  pagination: {
    currentPage: number
    totalPages: number
    hasNextPage: boolean
    canLoadMore: boolean
    isLoadingMore: boolean
  }
  metadata: any
  actions: {
    loadNextPage: () => void
    switchToFullDataset: () => void
    reset: () => void
  }
  strategy: 'paginated' | 'full-dataset' | 'loading'
}

export function useSmartSlides(options: UseSmartSlidesOptions = {}): SmartSlidesResult {
  const [currentPage, setCurrentPage] = useState(1)
  const [allLoadedSlides, setAllLoadedSlides] = useState<VirtualSlide[]>([])
  const [useFullDataset, setUseFullDataset] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  
  const limit = options.initialLimit || 50

  // Build cache key from options
  const cacheKey = useMemo(() => {
    const keyParts = ['smart-slides']
    if (options.search) keyParts.push(`search-${options.search}`)
    if (options.repository) keyParts.push(`repo-${options.repository}`)
    if (options.category) keyParts.push(`cat-${options.category}`)
    if (options.subcategory) keyParts.push(`sub-${options.subcategory}`)
    if (useFullDataset) keyParts.push('full')
    else keyParts.push(`page-${currentPage}`)
    
    return keyParts.join('-')
  }, [options, currentPage, useFullDataset])

  // Smart data fetching
  const { data: apiResponse, isLoading, error, refetch } = useCachedData(
    cacheKey,
    async () => {
      const params = new URLSearchParams()
      
      if (useFullDataset) {
        params.set('full', 'true')
      } else {
        params.set('page', currentPage.toString())
        params.set('limit', limit.toString())
      }
      
      if (options.search) params.set('search', options.search)
      if (options.repository) params.set('repository', options.repository)
      if (options.category) params.set('category', options.category)
      if (options.subcategory) params.set('subcategory', options.subcategory)

      console.log(`🔄 Smart slides API call: ${useFullDataset ? 'full dataset' : `page ${currentPage}`}`)
      
      const response = await fetch(`/api/virtual-slides/smart?${params}`, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'public, max-age=86400'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Smart slides API failed: ${response.status}`)
      }

      const result = await response.json()
      
      console.log(`✅ Smart slides loaded: ${result.data.length} slides, strategy: ${result.pagination?.strategy || 'unknown'}`)
      
      return result
    },
    {
      ttl: 24 * 60 * 60 * 1000, // 24 hours - R2 egress is free
      staleTime: 12 * 60 * 60 * 1000, // 12 hours
      storage: 'localStorage',
      prefix: 'pathology-bites-smart'
    }
  )

  // Combine slides for paginated strategy
  const slides = useMemo(() => {
    if (!apiResponse?.data) return []
    
    if (useFullDataset || currentPage === 1) {
      return apiResponse.data
    } else {
      // For subsequent pages, combine with previously loaded slides
      const newSlides = apiResponse.data
      const existingIds = new Set(allLoadedSlides.map(s => s.id))
      const uniqueNewSlides = newSlides.filter((s: VirtualSlide) => !existingIds.has(s.id))
      
      return [...allLoadedSlides, ...uniqueNewSlides]
    }
  }, [apiResponse, allLoadedSlides, currentPage, useFullDataset])

  // Update accumulated slides when new data comes in
  useEffect(() => {
    if (apiResponse?.data && !useFullDataset) {
      if (currentPage === 1) {
        setAllLoadedSlides(apiResponse.data)
      } else {
        setAllLoadedSlides(prev => {
          const existingIds = new Set(prev.map(s => s.id))
          const newSlides = apiResponse.data.filter((s: VirtualSlide) => !existingIds.has(s.id))
          return [...prev, ...newSlides]
        })
      }
    }
  }, [apiResponse, currentPage, useFullDataset])

  // Actions
  const loadNextPage = useCallback(async () => {
    if (useFullDataset || !apiResponse?.pagination?.hasNextPage || isLoadingMore) {
      return
    }

    setIsLoadingMore(true)
    setCurrentPage(prev => prev + 1)
    
    // The useEffect will trigger a new API call
    setTimeout(() => setIsLoadingMore(false), 1000) // Reset loading state
  }, [useFullDataset, apiResponse?.pagination?.hasNextPage, isLoadingMore])

  const switchToFullDataset = useCallback(() => {
    console.log('🚀 Switching to full dataset strategy')
    setUseFullDataset(true)
    setCurrentPage(1)
    setAllLoadedSlides([])
  }, [])

  const reset = useCallback(() => {
    setCurrentPage(1)
    setAllLoadedSlides([])
    setUseFullDataset(false)
    setIsLoadingMore(false)
  }, [])

  // Smart strategy recommendations
  const strategy = useMemo(() => {
    if (isLoading) return 'loading'
    if (useFullDataset) return 'full-dataset'
    return 'paginated'
  }, [isLoading, useFullDataset])

  // Auto-switch logic for better UX
  useEffect(() => {
    if (apiResponse?.pagination?.smartTip && !useFullDataset) {
      console.log('💡 Smart tip:', apiResponse.pagination.smartTip)
    }
  }, [apiResponse, useFullDataset])

  return {
    slides,
    isLoading,
    error,
    pagination: {
      currentPage,
      totalPages: apiResponse?.pagination?.totalPages || 1,
      hasNextPage: apiResponse?.pagination?.hasNextPage || false,
      canLoadMore: !useFullDataset && (apiResponse?.pagination?.hasNextPage || false),
      isLoadingMore
    },
    metadata: apiResponse?.metadata,
    actions: {
      loadNextPage,
      switchToFullDataset,
      reset
    },
    strategy
  }
}