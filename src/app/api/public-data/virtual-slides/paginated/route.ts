import { NextRequest, NextResponse } from 'next/server'

export const revalidate = 86400 // 24h ISR-like caching

// In-memory cache for the full dataset to avoid repeated fetches
let cachedData: any = null
let cacheTimestamp: number = 0
const CACHE_TTL = 86400 * 1000 // 24 hours in ms

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '100')
  const search = searchParams.get('search') || ''

  // Hard-coded R2 data URL - this is a public, static URL that doesn't change
  const base = 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev'
  const url = `${base}/virtual-slides/virtual-slides.json`
  
  try {
    // Check if we need to fetch fresh data
    const now = Date.now()
    if (!cachedData || (now - cacheTimestamp) > CACHE_TTL) {
      console.log('[VirtualSlides Paginated API] Fetching fresh data from R2...')
      const res = await fetch(url, { 
        next: { revalidate: 86400 }
      })
      if (!res.ok) {
        return NextResponse.json({ error: 'Upstream fetch failed', status: res.status }, { status: 502 })
      }
      cachedData = await res.json()
      cacheTimestamp = now
    }

    // Support both array and wrapped formats
    const slides = Array.isArray(cachedData) ? cachedData : (cachedData.data ?? [])
    
    // Filter by search if provided
    let filteredSlides = slides
    if (search) {
      const searchTerm = search.toLowerCase()
      filteredSlides = slides.filter((slide: any) => 
        (slide.diagnosis || '').toLowerCase().includes(searchTerm) ||
        (slide.category || '').toLowerCase().includes(searchTerm) ||
        (slide.subcategory || '').toLowerCase().includes(searchTerm)
      )
    }

    // Implement pagination
    const total = filteredSlides.length
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedSlides = filteredSlides.slice(startIndex, endIndex)

    return NextResponse.json({
      data: paginatedSlides,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: endIndex < total,
        hasPrev: page > 1
      }
    }, {
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=300'
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Proxy fetch error', message: err?.message || 'Unknown error' }, { status: 500 })
  }
}