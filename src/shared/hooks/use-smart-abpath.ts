// src/shared/hooks/use-smart-abpath.ts
/**
 * Smart loading hook for ABPath Content Specifications
 * Optimizes API calls with intelligent caching and pagination
 */

import { useState, useCallback, useEffect, useMemo } from 'react'

interface PathologySection {
  section: number
  title: string
  type: 'ap' | 'cp'
  items?: any[]
  subsections?: any[]
  line?: number
  note?: string
}

interface UseSmartABPathOptions {
  search?: string
  category?: string
  showAP?: boolean
  showCP?: boolean
  sectionsPerPage?: number
}

interface SmartABPathResult {
  sections: PathologySection[]
  allSections: PathologySection[] // For accurate statistics
  metadata: any
  pagination: any
  isLoading: boolean
  error: any
  actions: {
    loadPage: (page: number) => void
    switchToFullDataset: () => void
    reset: () => void
  }
  strategy: 'paginated' | 'full-dataset' | 'loading'
}

export function useSmartABPath(options: UseSmartABPathOptions = {}): SmartABPathResult {
  const [currentPage, setCurrentPage] = useState(1)
  const [apiResponse, setApiResponse] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<any>(null)
  const sectionsPerPage = options.sectionsPerPage || 7

  // Build type filter
  const typeFilter = useMemo(() => {
    if (options.showAP && !options.showCP) return 'ap'
    if (!options.showAP && options.showCP) return 'cp'
    return 'all' // Both or neither (default to both)
  }, [options.showAP, options.showCP])

  // Smart data fetching function - always load full dataset for accurate statistics
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Always use main API for full dataset (ABPath is small, R2 egress is free)
      console.log('🔄 ABPath API call: full dataset for accurate statistics')
      const response = await fetch('/api/tools/abpath-content-specs', {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'public, max-age=86400'
        }
      })
      
      if (!response.ok) {
        throw new Error(`ABPath API failed: ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ ABPath full dataset loaded')
      
      // Store complete dataset for client-side filtering and accurate statistics
      setApiResponse({
        allSections: [
          ...(result.content_specifications.ap_sections || []),
          ...(result.content_specifications.cp_sections || [])
        ],
        metadata: result.metadata,
        strategy: 'full-dataset-client-filtering'
      })
      
    } catch (err) {
      console.error('❌ ABPath API error:', err)
      setError(err)
    } finally {
      setIsLoading(false)
    }
  }, []) // No dependencies - only fetch once

  // Fetch data only once on mount
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Client-side filtering and pagination logic
  const processedData = useMemo(() => {
    if (!apiResponse?.allSections) {
      return {
        filteredSections: [],
        paginatedSections: [],
        totalFiltered: 0,
        totalPages: 1
      }
    }

    const allSections = apiResponse.allSections
    
    // Apply all filters client-side
    let filteredSections = allSections

    // Type filter (AP/CP)
    if (typeFilter !== 'all') {
      filteredSections = filteredSections.filter((section: any) => section.type === typeFilter)
    }

    // Category filter
    if (options.category && options.category !== 'all') {
      const [filterType, sectionNum] = options.category.split('_')
      if (filterType && sectionNum) {
        filteredSections = filteredSections.filter((section: any) =>
          section.type.toUpperCase() === filterType.toUpperCase() && 
          section.section.toString() === sectionNum
        )
      }
    }

    // Search filter
    if (options.search) {
      const searchLower = options.search.toLowerCase()
      filteredSections = filteredSections.filter((section: any) => {
        const titleMatch = section.title.toLowerCase().includes(searchLower)
        const noteMatch = section.note?.toLowerCase().includes(searchLower)
        
        // Search within items and subsections
        let contentMatch = false
        
        if (section.items) {
          contentMatch = section.items.some((item: any) => 
            item.title?.toLowerCase().includes(searchLower) ||
            item.note?.toLowerCase().includes(searchLower)
          )
        }
        
        if (!contentMatch && section.subsections) {
          contentMatch = section.subsections.some((subsection: any) =>
            subsection.title?.toLowerCase().includes(searchLower) ||
            subsection.items?.some((item: any) =>
              item.title?.toLowerCase().includes(searchLower) ||
              item.note?.toLowerCase().includes(searchLower)
            )
          )
        }
        
        return titleMatch || noteMatch || contentMatch
      })
    }

    // Calculate pagination
    const totalFiltered = filteredSections.length
    const totalPages = Math.ceil(totalFiltered / sectionsPerPage)
    const startIndex = (currentPage - 1) * sectionsPerPage
    const endIndex = startIndex + sectionsPerPage
    const paginatedSections = filteredSections.slice(startIndex, endIndex)

    return {
      filteredSections,
      paginatedSections,
      totalFiltered,
      totalPages
    }
  }, [apiResponse, typeFilter, options.category, options.search, currentPage, sectionsPerPage])

  // Actions
  const loadPage = useCallback((page: number) => {
    console.log(`🔄 ABPath loading page ${page}`)
    setCurrentPage(page)
  }, [])

  const switchToFullDataset = useCallback(() => {
    // No-op since we're already using full dataset
    console.log('💡 ABPath already using full dataset')
  }, [])

  const reset = useCallback(() => {
    setCurrentPage(1)
  }, [])

  // Reset to page 1 when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
  }, [options.search, options.category, typeFilter])

  // Build pagination object
  const pagination = useMemo(() => ({
    currentPage,
    totalPages: processedData.totalPages,
    sectionsPerPage,
    totalSections: processedData.totalFiltered,
    hasNextPage: currentPage < processedData.totalPages,
    hasPrevPage: currentPage > 1
  }), [currentPage, processedData.totalPages, processedData.totalFiltered, sectionsPerPage])

  return {
    sections: processedData.paginatedSections,
    allSections: apiResponse?.allSections || [], // For statistics
    metadata: apiResponse?.metadata,
    pagination,
    isLoading,
    error,
    actions: {
      loadPage,
      switchToFullDataset,
      reset
    },
    strategy: isLoading ? 'loading' : 'full-dataset'
  }
}