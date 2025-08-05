// src/shared/types/virtual-slides.ts
/**
 * Canonical VirtualSlide interface - USE THIS EVERYWHERE
 * Based on the actual data structure in virtual-slides.json
 */

export interface VirtualSlide {
  id: string
  repository: string
  category: string
  subcategory: string
  diagnosis: string
  patient_info: string
  age: string | null  // Note: This is string in the actual data, not number
  gender: string | null
  clinical_history: string
  stain_type: string
  image_url?: string  // Optional for compatibility with different data sources
  preview_image_url: string
  slide_url: string
  case_url: string
  other_urls: string[]
  source_metadata: Record<string, unknown>
}

export interface SearchIndex {
  slide: VirtualSlide
  diagnosis: string
}

// Repository metadata
export interface RepositoryInfo {
  name: string
  logo: string
  description?: string
  url?: string
}

// Filter types
export interface VirtualSlideFilters {
  search?: string
  repository?: string
  category?: string
  organSystem?: string
}

// API response types
export interface VirtualSlidesResponse {
  data: VirtualSlide[]
  metadata?: {
    totalSlides: number
    originalTotal: number
    filters: VirtualSlideFilters
    performance?: {
      source: string
      cached: boolean
      compressionEnabled: boolean
    }
  }
}

export interface PaginatedVirtualSlidesResponse {
  data: VirtualSlide[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
  filters: VirtualSlideFilters
}
