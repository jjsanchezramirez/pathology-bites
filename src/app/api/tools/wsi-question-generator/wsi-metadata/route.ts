import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// R2 configuration for private pathology-bites-data bucket
const r2Client = new S3Client({
  region: 'auto',
  endpoint: 'https://1faba3419ce733a22d081e271ae7a750.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

// Fallback to full virtual-slides.json if metadata file doesn't exist yet - using correct data bucket
const VIRTUAL_SLIDES_R2_URL = 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/virtual-slides/virtual-slides.json'

interface WSIMetadata {
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
}

// Get random WSI from pre-filtered metadata
async function getRandomWSIFromMetadata(categoryFilter?: string, excludeIds?: string[]): Promise<WSIMetadata> {
  try {
    console.log('[WSI Metadata] Attempting to load pre-filtered metadata from private bucket...')
    
    // Generate signed URL for private WSI metadata file
    const metadataCommand = new GetObjectCommand({
      Bucket: 'pathology-bites-data',
      Key: 'wsi/wsi-embeddable-metadata.json',
    })

    const signedMetadataUrl = await getSignedUrl(r2Client, metadataCommand, {
      expiresIn: 3600 // 1 hour
    })
    
    // Try to fetch the lightweight metadata file first using signed URL
    let response = await fetch(signedMetadataUrl)

    let slides: WSIMetadata[] = []

    if (response.ok) {
      console.log('[WSI Metadata] Using pre-filtered metadata file')
      const data = await response.json()
      slides = Array.isArray(data) ? data : (data.slides || [])
    } else {
      console.log('[WSI Metadata] Pre-filtered metadata not available, falling back to full file')
      
      // Fallback to full virtual-slides.json with aggressive caching (data doesn't change often)
      response = await fetch(VIRTUAL_SLIDES_R2_URL, {
        headers: {
          'Cache-Control': 'public, max-age=86400' // 24 hour cache for data files - excellent for performance
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch virtual slides data: ${response.status}`)
      }

      const data = await response.json()
      let fullSlides = Array.isArray(data) ? data : (data.slides || [])
      
      // Apply embeddable repository filtering
      const embeddableRepositories = [
        'Hematopathology eTutorial',
        'Rosai Collection', 
        'PathPresenter',
        'MGH Pathology'
      ]
      
      slides = fullSlides.filter((slide: any) => 
        embeddableRepositories.includes(slide.repository) &&
        slide.slide_url && 
        slide.slide_url.startsWith('http') && 
        !slide.slide_url.includes('localhost')
      ).map((slide: any) => ({
        id: slide.id,
        repository: slide.repository,
        category: slide.category,
        subcategory: slide.subcategory,
        diagnosis: slide.diagnosis,
        patient_info: slide.patient_info,
        age: slide.age,
        gender: slide.gender,
        clinical_history: slide.clinical_history,
        stain_type: slide.stain_type,
        preview_image_url: slide.preview_image_url,
        slide_url: slide.slide_url,
        case_url: slide.case_url,
        image_url: slide.image_url
      }))
    }

    console.log(`[WSI Metadata] Loaded ${slides.length} embeddable slides`)

    // Apply category filter if provided
    if (categoryFilter) {
      slides = slides.filter(slide => 
        slide.category.toLowerCase().includes(categoryFilter.toLowerCase()) ||
        slide.subcategory.toLowerCase().includes(categoryFilter.toLowerCase())
      )
      console.log(`[WSI Metadata] After category filter '${categoryFilter}': ${slides.length} slides`)
    }

    // Apply exclusion filter if provided
    if (excludeIds && excludeIds.length > 0) {
      console.log(`[WSI Metadata] Excluding these slide IDs: ${excludeIds.join(', ')}`)
      const beforeExclusion = slides.length
      slides = slides.filter(slide => !excludeIds.includes(slide.id))
      console.log(`[WSI Metadata] After excluding ${excludeIds.length} recent IDs: ${slides.length} slides (removed ${beforeExclusion - slides.length})`)
      
      // Debug: Show some slide IDs to verify exclusion is working
      if (slides.length > 0) {
        const sampleIds = slides.slice(0, 5).map(s => s.id)
        console.log(`[WSI Metadata] Sample remaining slide IDs: ${sampleIds.join(', ')}`)
      }
    }

    if (slides.length === 0) {
      throw new Error('No suitable WSI slides found after filtering')
    }

    // Improved random selection with better entropy to prevent repetition
    const randomSeed = Date.now() + Math.random() * 1000000 + (Math.random() * 99999)
    const randomIndex = Math.floor((randomSeed % slides.length))
    const selectedSlide = slides[randomIndex]
    
    console.log(`[WSI Metadata] Random seed: ${randomSeed}, index: ${randomIndex} of ${slides.length}`)
    
    console.log(`[WSI Metadata] Selected slide: ${selectedSlide.id} - ${selectedSlide.diagnosis}`)
    
    return selectedSlide

  } catch (error) {
    console.error('[WSI Metadata] Error loading WSI metadata:', error)
    throw new Error('Failed to load virtual slide metadata')
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log('[WSI Metadata] Starting optimized WSI selection request')

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const excludeParam = searchParams.get('exclude')
    const excludeIds = excludeParam ? excludeParam.split(',').filter(id => id.trim()) : []
    
    console.log('[WSI Metadata] Category filter:', category)
    console.log('[WSI Metadata] Exclude IDs:', excludeIds)

    // Get random WSI from lightweight metadata
    const wsi = await getRandomWSIFromMetadata(category || undefined, excludeIds)
    
    const selectionTime = Date.now() - startTime
    console.log(`[WSI Metadata] WSI selection completed in ${selectionTime}ms`)

    const result = {
      success: true,
      wsi: wsi,
      metadata: {
        selected_at: new Date().toISOString(),
        selection_time_ms: selectionTime,
        category_filter: category,
        repository: wsi.repository,
        optimization: 'metadata-only',
        random_seed: Date.now() // Add random seed for debugging
      }
    }

    return NextResponse.json(result, { 
      status: 200,
      headers: {
        // NEVER cache the selection result - each request should be random
        'Cache-Control': 'no-cache, no-store, must-revalidate', 
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Optimization': 'wsi-metadata',
        'X-Random-Seed': result.metadata.random_seed.toString() // Debug info
      }
    })
    
  } catch (error) {
    console.error('[WSI Metadata] Error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to select WSI from metadata',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}