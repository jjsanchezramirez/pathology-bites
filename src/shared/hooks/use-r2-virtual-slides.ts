// src/shared/hooks/use-r2-virtual-slides.ts
/**
 * Hook for direct R2 virtual slides access
 * Bypasses Vercel API routes for better performance and cost optimization
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { r2DirectAccess, r2Cache } from '@/shared/utils/r2-direct-access'
import { VirtualSlide } from '@/shared/types/virtual-slides'

interface UseR2VirtualSlidesOptions {
  search?: string
  repository?: string
  category?: string
  enabled?: boolean
  autoRefresh?: boolean
}

interface UseR2VirtualSlidesResult {
  data: VirtualSlide[] | null
  filteredData: VirtualSlide[]
  isLoading: boolean
  error: Error | null
  totalCount: number
  filteredCount: number
  refetch: () => Promise<void>
  clearCache: () => void
}

/**
 * Hook for accessing virtual slides directly from R2
 * This completely bypasses Vercel API routes for maximum efficiency
 */
export function useR2VirtualSlides(options: UseR2VirtualSlidesOptions = {}): UseR2VirtualSlidesResult {
  const {
    search,
    repository,
    category,
    enabled = true,
    autoRefresh = false
  } = options

  const [data, setData] = useState<VirtualSlide[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Memoized filtered data to avoid unnecessary recalculations
  const filteredData = useMemo(() => {
    if (!data) return []

    let filtered = data

    // Apply search filter
    if (search && search.trim()) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(slide =>
        slide.diagnosis?.toLowerCase().includes(searchLower) ||
        slide.repository?.toLowerCase().includes(searchLower) ||
        slide.category?.toLowerCase().includes(searchLower) ||
        slide.subcategory?.toLowerCase().includes(searchLower) ||
        slide.clinical_history?.toLowerCase().includes(searchLower)
      )
    }

    // Apply repository filter
    if (repository && repository !== 'all') {
      filtered = filtered.filter(slide => slide.repository === repository)
    }

    // Apply category filter
    if (category && category !== 'all') {
      filtered = filtered.filter(slide => slide.category === category)
    }

    return filtered
  }, [data, search, repository, category])

  // Fetch data directly from R2
  const fetchData = useCallback(async () => {
    if (!enabled) return

    setIsLoading(true)
    setError(null)

    try {
      console.log('Fetching virtual slides directly from R2...')
      const slides = await r2DirectAccess.getVirtualSlides({
        ttl: 10 * 60 * 1000, // 10 minutes cache
        staleWhileRevalidate: 5 * 60 * 1000 // 5 minutes stale-while-revalidate
      })

      const typedSlides = slides as VirtualSlide[]
      setData(typedSlides)
      console.log(`Loaded ${typedSlides.length} virtual slides from R2`)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch virtual slides')
      setError(error)
      console.error('R2 virtual slides fetch error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [enabled])

  // Clear cache
  const clearCache = useCallback(() => {
    // Clear cache by invalidating the URL
    r2Cache.invalidate('https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/pathology-bites-data/virtual-slides.json')
    setData(null)
  }, [])

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchData()
    }
  }, [enabled, fetchData])

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh || !enabled) return

    const interval = setInterval(fetchData, 5 * 60 * 1000) // 5 minutes
    return () => clearInterval(interval)
  }, [autoRefresh, enabled, fetchData])

  return {
    data,
    filteredData,
    isLoading,
    error,
    totalCount: data?.length || 0,
    filteredCount: filteredData.length,
    refetch: fetchData,
    clearCache
  }
}

/**
 * Hook for getting available categories and repositories
 * Useful for building filter UIs
 */
export function useR2VirtualSlidesMetadata() {
  const { data, isLoading, error } = useR2VirtualSlides({ enabled: true })

  const metadata = useMemo(() => {
    if (!data) return { categories: [], repositories: [], subcategories: [] }

    const categories = [...new Set(data.map(slide => slide.category).filter(Boolean))]
    const repositories = [...new Set(data.map(slide => slide.repository).filter(Boolean))]
    const subcategories = [...new Set(data.map(slide => slide.subcategory).filter(Boolean))]

    return {
      categories: categories.sort(),
      repositories: repositories.sort(),
      subcategories: subcategories.sort()
    }
  }, [data])

  return {
    ...metadata,
    isLoading,
    error,
    totalSlides: data?.length || 0
  }
}

/**
 * Hook for random slide selection
 * Useful for quiz/learning features
 */
export function useR2RandomSlide(filters: UseR2VirtualSlidesOptions = {}) {
  const { filteredData, isLoading, error } = useR2VirtualSlides(filters)
  const [currentSlide, setCurrentSlide] = useState<VirtualSlide | null>(null)

  const getRandomSlide = useCallback(() => {
    if (filteredData.length === 0) {
      setCurrentSlide(null)
      return null
    }

    const randomIndex = Math.floor(Math.random() * filteredData.length)
    const slide = filteredData[randomIndex]
    setCurrentSlide(slide)
    return slide
  }, [filteredData])

  // Auto-select first random slide when data loads
  useEffect(() => {
    if (filteredData.length > 0 && !currentSlide) {
      getRandomSlide()
    }
  }, [filteredData, currentSlide, getRandomSlide])

  return {
    currentSlide,
    getRandomSlide,
    availableCount: filteredData.length,
    isLoading,
    error
  }
}

/**
 * Performance monitoring for R2 access
 */
export function useR2Performance() {
  const [stats, setStats] = useState({
    cacheHits: 0,
    cacheMisses: 0,
    totalRequests: 0,
    averageResponseTime: 0
  })

  const updateStats = useCallback((hit: boolean, responseTime: number) => {
    setStats(prev => ({
      cacheHits: prev.cacheHits + (hit ? 1 : 0),
      cacheMisses: prev.cacheMisses + (hit ? 0 : 1),
      totalRequests: prev.totalRequests + 1,
      averageResponseTime: (prev.averageResponseTime * prev.totalRequests + responseTime) / (prev.totalRequests + 1)
    }))
  }, [])

  const resetStats = useCallback(() => {
    setStats({
      cacheHits: 0,
      cacheMisses: 0,
      totalRequests: 0,
      averageResponseTime: 0
    })
  }, [])

  return {
    stats,
    updateStats,
    resetStats,
    cacheHitRate: stats.totalRequests > 0 ? (stats.cacheHits / stats.totalRequests) * 100 : 0
  }
}
