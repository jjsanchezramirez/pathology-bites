// src/app/api/virtual-slides/paginated/route.ts
/**
 * Paginated API endpoint for virtual slides data
 * Reduces bandwidth by serving data in chunks instead of entire 846K+ line file
 */

import { NextRequest, NextResponse } from 'next/server'
import { createOptimizedResponse } from '@/shared/utils/compression'

// This will be replaced with R2 URL after migration
const VIRTUAL_SLIDES_R2_URL = 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/pathology-bites-data/virtual-slides.json'

interface PaginationParams {
  page: number
  limit: number
  search?: string
  repository?: string
  category?: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const params: PaginationParams = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '50'), 100), // Max 100 per page
      search: searchParams.get('search') || undefined,
      repository: searchParams.get('repository') || undefined,
      category: searchParams.get('category') || undefined
    }

    // Validate pagination params
    if (params.page < 1 || params.limit < 1) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      )
    }

    // Fetch data from R2 (cached by Cloudflare)
    const response = await fetch(VIRTUAL_SLIDES_R2_URL, {
      headers: {
        'Cache-Control': 'public, max-age=3600' // 1 hour cache
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch virtual slides data: ${response.status}`)
    }

    const allSlides = await response.json()
    
    // Apply filters
    let filteredSlides = allSlides
    
    if (params.search) {
      const searchLower = params.search.toLowerCase()
      filteredSlides = filteredSlides.filter((slide: any) =>
        slide.diagnosis?.toLowerCase().includes(searchLower) ||
        slide.repository?.toLowerCase().includes(searchLower) ||
        slide.category?.toLowerCase().includes(searchLower)
      )
    }
    
    if (params.repository) {
      filteredSlides = filteredSlides.filter((slide: any) =>
        slide.repository === params.repository
      )
    }
    
    if (params.category) {
      filteredSlides = filteredSlides.filter((slide: any) =>
        slide.category === params.category
      )
    }

    // Calculate pagination
    const totalItems = filteredSlides.length
    const totalPages = Math.ceil(totalItems / params.limit)
    const startIndex = (params.page - 1) * params.limit
    const endIndex = startIndex + params.limit
    
    const paginatedSlides = filteredSlides.slice(startIndex, endIndex)

    const result = {
      data: paginatedSlides,
      pagination: {
        page: params.page,
        limit: params.limit,
        totalItems,
        totalPages,
        hasNextPage: params.page < totalPages,
        hasPreviousPage: params.page > 1
      },
      filters: {
        search: params.search,
        repository: params.repository,
        category: params.category
      }
    }

    return createOptimizedResponse(result, {
      compress: true,
      cache: {
        maxAge: 1800, // 30 minutes
        staleWhileRevalidate: 300, // 5 minutes
        public: true
      }
    })

  } catch (error) {
    console.error('Virtual slides pagination error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch virtual slides data' },
      { status: 500 }
    )
  }
}
