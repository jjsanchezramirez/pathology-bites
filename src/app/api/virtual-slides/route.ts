// src/app/api/virtual-slides/route.ts
/**
 * Optimized virtual slides API endpoint
 * Redirects to direct R2 URLs when possible to minimize Vercel usage
 */

import { NextRequest, NextResponse } from 'next/server'
import { createOptimizedResponse } from '@/shared/utils/compression'

// R2 URL for virtual slides data (migrated from massive local file)
const VIRTUAL_SLIDES_R2_URL = 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/pathology-bites-data/virtual-slides.json'

// Check if request can be redirected to direct R2 access
function shouldRedirectToR2(searchParams: URLSearchParams): boolean {
  // Only redirect simple requests without complex filtering
  const hasComplexFilters = searchParams.has('search') ||
                           searchParams.has('repository') ||
                           searchParams.has('category')

  // Redirect if no filters or pagination
  return !hasComplexFilters && !searchParams.has('page') && !searchParams.has('limit')
}

interface VirtualSlide {
  id: string
  repository: string
  category: string
  subcategory: string
  diagnosis: string
  patient_info: string
  age: number | null
  gender: string | null
  clinical_history: string
  stain_type: string
  preview_image_url: string
  slide_url: string
  case_url: string
  other_urls: string[]
  source_metadata: Record<string, unknown>
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // For simple requests, redirect directly to R2 to save Vercel bandwidth
    if (shouldRedirectToR2(searchParams)) {
      return NextResponse.redirect(VIRTUAL_SLIDES_R2_URL, {
        status: 302,
        headers: {
          'Cache-Control': 'public, max-age=3600',
          'X-Redirect-Reason': 'direct-r2-access'
        }
      })
    }

    // Check if pagination is requested
    const page = searchParams.get('page')
    const limit = searchParams.get('limit')
    const usePagination = page !== null || limit !== null

    if (usePagination) {
      // Redirect to paginated endpoint for better performance
      const paginatedUrl = new URL('/api/virtual-slides/paginated', request.url)
      searchParams.forEach((value, key) => {
        paginatedUrl.searchParams.set(key, value)
      })

      return NextResponse.redirect(paginatedUrl.toString())
    }

    // For full dataset requests, fetch from R2 with aggressive caching
    const response = await fetch(VIRTUAL_SLIDES_R2_URL, {
      headers: {
        'Cache-Control': 'public, max-age=3600' // 1 hour cache
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch virtual slides data: ${response.status}`)
    }

    const slides: VirtualSlide[] = await response.json()

    // Apply basic filters if provided
    let filteredSlides = slides
    
    const search = searchParams.get('search')
    if (search) {
      const searchLower = search.toLowerCase()
      filteredSlides = slides.filter(slide =>
        slide.diagnosis?.toLowerCase().includes(searchLower) ||
        slide.repository?.toLowerCase().includes(searchLower) ||
        slide.category?.toLowerCase().includes(searchLower)
      )
    }

    const repository = searchParams.get('repository')
    if (repository) {
      filteredSlides = filteredSlides.filter(slide => 
        slide.repository === repository
      )
    }

    const category = searchParams.get('category')
    if (category) {
      filteredSlides = filteredSlides.filter(slide => 
        slide.category === category
      )
    }

    // Return with aggressive compression (this is a HUGE dataset)
    return createOptimizedResponse({
      data: filteredSlides,
      metadata: {
        totalSlides: filteredSlides.length,
        originalTotal: slides.length,
        filters: {
          search,
          repository,
          category
        },
        performance: {
          source: 'cloudflare-r2',
          cached: true,
          compressionEnabled: true
        }
      }
    }, {
      compress: true,
      cache: {
        maxAge: 3600, // 1 hour
        staleWhileRevalidate: 1800, // 30 minutes
        public: true
      }
    })

  } catch (error) {
    console.error('Virtual slides API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch virtual slides data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
