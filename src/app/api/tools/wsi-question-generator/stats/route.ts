import { NextRequest, NextResponse } from 'next/server'

// R2 URL for virtual slides data
const VIRTUAL_SLIDES_R2_URL = 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/pathology-bites-data/virtual-slides.json'

interface VirtualSlide {
  id: string
  repository: string
  category: string
  subcategory: string
  diagnosis: string
  patient_info: string
  age: string | null
  gender: string | null
  clinical_history: string
  stain_type: string
  preview_image_url?: string
  slide_url?: string
  case_url?: string
  image_url?: string
  thumbnail_url?: string
  other_urls?: string[]
  source_metadata?: Record<string, unknown>
  magnification?: string
  organ_system?: string
  difficulty_level?: string
  keywords?: string[]
  created_at?: string
  updated_at?: string
}

interface WSIStats {
  totalSlides: number
  totalRepositories: number
  repositories: string[]
  categories: string[]
  totalCategories: number
}

export async function GET(request: NextRequest) {
  try {
    console.log('[WSI Stats] Loading virtual slides data from R2...')
    
    // Fetch with aggressive caching since stats don't change often
    const response = await fetch(VIRTUAL_SLIDES_R2_URL, {
      headers: {
        'Cache-Control': 'public, max-age=86400' // 24 hour cache
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch virtual slides data: ${response.status}`)
    }

    const data = await response.json()
    
    // Handle both array format and object with slides property
    let slides: VirtualSlide[] = Array.isArray(data) ? data : (data.slides || [])
    console.log(`[WSI Stats] Loaded ${slides.length} total slides`)

    // Filter out problematic repositories (as noted in memories)
    const excludedRepositories = ['Leeds', 'Recut Club', 'Toronto']
    slides = slides.filter(slide => 
      !excludedRepositories.some(excluded => 
        slide.repository.toLowerCase().includes(excluded.toLowerCase())
      )
    )

    console.log(`[WSI Stats] After filtering: ${slides.length} slides`)

    // Calculate statistics
    const repositories = [...new Set(slides.map(slide => slide.repository))].sort()
    const categories = [...new Set(slides.map(slide => slide.category))].sort()

    const stats: WSIStats = {
      totalSlides: slides.length,
      totalRepositories: repositories.length,
      repositories,
      categories,
      totalCategories: categories.length
    }

    console.log(`[WSI Stats] Generated stats:`, {
      totalSlides: stats.totalSlides,
      totalRepositories: stats.totalRepositories,
      totalCategories: stats.totalCategories
    })

    return NextResponse.json({
      success: true,
      stats
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600', // 24h cache, 1h stale
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    console.error('[WSI Stats] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch WSI statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache'
      }
    })
  }
}
