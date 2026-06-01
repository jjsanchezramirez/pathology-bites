// src/shared/types/virtual-slides.ts
/**
 * Canonical VirtualSlide interface - USE THIS EVERYWHERE
 * Based on the actual data structure in virtual-slides.json
 */

export interface VirtualSlide {
  id: string;
  repository: string;
  category: string;
  subcategory: string;
  diagnosis: string;
  acronym?: string | string[]; // WHO medical abbreviation(s)
  patient_info: string;
  age: string | null; // Note: This is string in the actual data, not number
  gender: string | null;
  clinical_history: string;
  stain_type: string;
  image_url?: string; // Optional for use with different data sources
  preview_image_url: string;
  slide_url: string;
  case_url: string;
  other_urls: string[];
  source_metadata: Record<string, unknown>;
  groupId?: string; // case-group id (pair/panel) — siblings resolvable via getRelatedSlides
  loginWalled?: boolean; // external page requires login (MGH) — hide the link, use the viewer
  // Direct tile-source (DZI) URL for repos whose slide_url is a course page, not the slide
  // itself (LearnHaem). The viewer resolves tiles from this; slide_url stays the source link.
  tileSourceUrl?: string;
  // MGH only: number of hosted slides in the case (present iff >1). MGH has no corpus
  // case-group; its within-case stains live behind /pv-http/.../list, fetched lazily when
  // the row's related-slides panel is expanded. Lets the row show the count without that hit.
  mghSlideCount?: number;
}

export interface SearchIndex {
  slide: VirtualSlide;
  diagnosis: string;
}

// Repository metadata
export interface RepositoryInfo {
  name: string;
  logo: string;
  description?: string;
  url?: string;
}

// Filter types
export interface VirtualSlideFilters {
  search?: string;
  repository?: string;
  category?: string;
  organSystem?: string;
}

// API response types
export interface VirtualSlidesResponse {
  data: VirtualSlide[];
  metadata?: {
    totalSlides: number;
    originalTotal: number;
    filters: VirtualSlideFilters;
    performance?: {
      source: string;
      cached: boolean;
      compressionEnabled: boolean;
    };
  };
}

export interface PaginatedVirtualSlidesResponse {
  data: VirtualSlide[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  filters: VirtualSlideFilters;
}
