import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

// Types for WSI data
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

// Get random WSI with repository filtering
async function getRandomWSI(categoryFilter?: string): Promise<VirtualSlide> {
  try {
    console.log('[WSI Select] Loading virtual slides data...')
    const filePath = join(process.cwd(), 'data', 'virtual-slides.json')
    const fileContent = await readFile(filePath, 'utf-8')
    const data = JSON.parse(fileContent)

    // Handle both array format and object with slides property
    let slides: VirtualSlide[] = Array.isArray(data) ? data : (data.slides || [])
    console.log(`[WSI Select] Loaded ${slides.length} total slides`)

    // Filter out problematic repositories (as noted in memories)
    const excludedRepositories = ['Leeds', 'Recut Club', 'Toronto']
    slides = slides.filter(slide => 
      !excludedRepositories.some(excluded => 
        slide.repository.toLowerCase().includes(excluded.toLowerCase())
      )
    )
    console.log(`[WSI Select] After repository filtering: ${slides.length} slides`)

    // Apply category filter if provided
    if (categoryFilter) {
      slides = slides.filter(slide => 
        slide.category.toLowerCase().includes(categoryFilter.toLowerCase()) ||
        slide.subcategory.toLowerCase().includes(categoryFilter.toLowerCase())
      )
      console.log(`[WSI Select] After category filter '${categoryFilter}': ${slides.length} slides`)
    }

    // Filter for slides with accessible images (basic URL validation)
    slides = slides.filter(slide => {
      const imageUrl = slide.image_url || slide.slide_url || slide.case_url
      return imageUrl &&
             imageUrl.startsWith('http') &&
             !imageUrl.includes('localhost')
    })
    console.log(`[WSI Select] After URL validation: ${slides.length} slides`)

    if (slides.length === 0) {
      throw new Error('No suitable WSI slides found after filtering')
    }

    // Select random slide
    const randomIndex = Math.floor(Math.random() * slides.length)
    const selectedSlide = slides[randomIndex]
    
    console.log(`[WSI Select] Selected slide: ${selectedSlide.id} - ${selectedSlide.diagnosis}`)
    console.log(`[WSI Select] Repository: ${selectedSlide.repository}`)
    console.log(`[WSI Select] Category: ${selectedSlide.category}`)
    
    return selectedSlide

  } catch (error) {
    console.error('[WSI Select] Error loading WSI data:', error)
    throw new Error('Failed to load virtual slide data')
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log('[WSI Select] Starting WSI selection request')

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    console.log('[WSI Select] Category filter:', category)

    // Get random WSI
    const wsi = await getRandomWSI(category || undefined)
    
    const selectionTime = Date.now() - startTime
    console.log(`[WSI Select] WSI selection completed in ${selectionTime}ms`)

    const result = {
      success: true,
      wsi: wsi,
      metadata: {
        selected_at: new Date().toISOString(),
        selection_time_ms: selectionTime,
        category_filter: category,
        repository: wsi.repository
      }
    }

    return NextResponse.json(result, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    
  } catch (error) {
    console.error('[WSI Select] Error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to select WSI',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
