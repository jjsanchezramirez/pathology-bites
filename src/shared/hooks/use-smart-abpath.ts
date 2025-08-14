// src/shared/hooks/use-smart-abpath.ts
/**
 * Smart loading hook for ABPath Content Specifications
 * Uses client-side direct R2 access for optimal performance and zero Vercel usage
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useClientABPath } from './use-client-abpath'

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
  allSections: PathologySection[] // For accurate statistics (unfiltered)
  filteredSections: PathologySection[] // For accurate statistics (filtered)
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
  const sectionsPerPage = options.sectionsPerPage || 7

  // Use client-side direct R2 access - zero Vercel usage
  const { data: clientData, isLoading, error } = useClientABPath()

  // Build type filter
  const typeFilter = useMemo(() => {
    if (options.showAP && !options.showCP) return 'ap'
    if (!options.showAP && options.showCP) return 'cp'
    if (options.showAP && options.showCP) return 'all' // Both selected
    return 'none' // Neither selected - show no results
  }, [options.showAP, options.showCP])

  // Process client data into the format expected by the component
  const apiResponse = useMemo(() => {
    if (!clientData) return null

    const allSections = [
      ...(clientData.content_specifications.ap_sections || []),
      ...(clientData.content_specifications.cp_sections || [])
    ]

    return {
      allSections,
      metadata: clientData.metadata,
      strategy: 'client-side-r2-direct'
    }
  }, [clientData])

  // Memoize filtering functions for better performance
  const filterHelpers = useMemo(() => {
    // Helper function to check if an item matches search
    const itemMatches = (item: any, searchLower: string): boolean => {
      const title = (item.title || '').toLowerCase()
      const note = (item.note || '').toLowerCase()
      const designation = (item.designation || '').toLowerCase()
      
      return title.includes(searchLower) || note.includes(searchLower) || designation.includes(searchLower)
    }
    
    // Helper function to filter items recursively
    const filterItems = (items: any[], searchLower: string): any[] => {
      return items.filter(item => {
        const matches = itemMatches(item, searchLower)
        const hasMatchingSubitems = item.subitems ? filterItems(item.subitems, searchLower).length > 0 : false
        
        return matches || hasMatchingSubitems
      }).map(item => ({
        ...item,
        subitems: item.subitems ? filterItems(item.subitems, searchLower) : undefined
      }))
    }
    
    return { itemMatches, filterItems }
  }, [])

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
    if (typeFilter === 'none') {
      filteredSections = [] // No results when neither AP nor CP is selected
    } else if (typeFilter !== 'all') {
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

    // Search filter - content-aware filtering that filters items within sections
    if (options.search) {
      const searchLower = options.search.toLowerCase()
      const { filterItems } = filterHelpers
      
      filteredSections = filteredSections.map((section: any) => {
        const sectionTitle = (section.title || '').toLowerCase()
        const sectionNote = (section.note || '').toLowerCase()
        const sectionMatches = sectionTitle.includes(searchLower) || sectionNote.includes(searchLower)
        
        // If section title/note matches, keep entire section
        if (sectionMatches) {
          return section
        }
        
        const filteredSection = { ...section }
        
        // Filter direct items
        if (section.items) {
          filteredSection.items = filterItems(section.items, searchLower)
        }
        
        // Filter subsections
        if (section.subsections) {
          filteredSection.subsections = section.subsections.map((subsection: any) => {
            const subsectionTitle = (subsection.title || '').toLowerCase()
            const subsectionMatches = subsectionTitle.includes(searchLower)
            
            // If subsection title matches, keep entire subsection
            if (subsectionMatches) {
              return subsection
            }
            
            const filteredSubsection = { ...subsection }
            
            // Filter subsection items
            if (subsection.items) {
              filteredSubsection.items = filterItems(subsection.items, searchLower)
            }
            
            // Filter subsection sections
            if (subsection.sections) {
              filteredSubsection.sections = subsection.sections.map((subSection: any) => {
                const subSectionTitle = (subSection.title || '').toLowerCase()
                const subSectionMatches = subSectionTitle.includes(searchLower)
                
                if (subSectionMatches) {
                  return subSection
                }
                
                return {
                  ...subSection,
                  items: subSection.items ? filterItems(subSection.items, searchLower) : undefined
                }
              }).filter((subSection: any) => 
                subSection.items && subSection.items.length > 0
              )
            }
            
            return filteredSubsection
          }).filter((subsection: any) => 
            (subsection.items && subsection.items.length > 0) ||
            (subsection.sections && subsection.sections.length > 0)
          )
        }
        
        return filteredSection
      }).filter((section: any) => 
        (section.items && section.items.length > 0) ||
        (section.subsections && section.subsections.length > 0)
      )
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
  }, [apiResponse, typeFilter, options.category, options.search, currentPage, sectionsPerPage, filterHelpers])

  // Actions
  const loadPage = useCallback((page: number) => {
    setCurrentPage(page)
  }, [])

  const switchToFullDataset = useCallback(() => {
    // No-op since we're already using full dataset
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
    allSections: apiResponse?.allSections || [], // For statistics (unfiltered)
    filteredSections: processedData.filteredSections, // For statistics (filtered)
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