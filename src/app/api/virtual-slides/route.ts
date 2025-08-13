// src/app/api/virtual-slides/route.ts
/**
 * Virtual slides API endpoint using R2 private bucket access
 * Uses S3Client to fetch data from private bucket with proper authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { createOptimizedResponse } from '@/shared/utils/compression'
import { VirtualSlide } from '@/shared/types/virtual-slides'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'

// R2 Configuration (same as cell quiz)
function getR2Config() {
  const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
  const CLOUDFLARE_R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  const CLOUDFLARE_R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY

  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_R2_ACCESS_KEY_ID || !CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
    throw new Error('Missing required Cloudflare R2 environment variables')
  }

  return {
    CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_R2_ACCESS_KEY_ID,
    CLOUDFLARE_R2_SECRET_ACCESS_KEY
  }
}

// Create R2 client
function createR2Client() {
  const config = getR2Config()

  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: config.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
  })
}



export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // ✅ MANDATORY PAGINATION: Prevent large responses
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20'))) // Max 50 items per request

    console.log(`🔄 Virtual slides API called - page ${page}, limit ${limit}`)

    let slides: VirtualSlide[]
    
    try {
      console.log('🌐 Fetching from R2 private bucket...')
      const r2Client = createR2Client()
      
      const command = new GetObjectCommand({
        Bucket: 'pathology-bites-data',
        Key: 'virtual-slides.json'
      })

      const response = await r2Client.send(command)
      
      if (!response.Body) {
        throw new Error('No response body from R2')
      }

      console.log('📊 R2 response received, parsing JSON...')
      const bodyContent = await response.Body.transformToString()
      const contentSize = bodyContent.length
      console.log('📏 Content size:', `${(contentSize / (1024 * 1024)).toFixed(1)}MB`)
      
      slides = JSON.parse(bodyContent)
      console.log(`✅ Virtual slides parsed successfully: ${slides.length} slides`)

    } catch (fetchError) {
      console.error('❌ Virtual slides R2 fetch error details:')
      console.error('   Error type:', fetchError?.constructor?.name)
      console.error('   Error message:', (fetchError as any)?.message)
      console.error('   Full error:', fetchError)
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch virtual slides from R2 private bucket',
          details: (fetchError as any)?.message || 'Unknown error',
          bucket: 'pathology-bites-data',
          key: 'virtual-slides.json'
        },
        { status: 500 }
      )
    }

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

    // ✅ APPLY PAGINATION: Calculate pagination after filtering
    const totalItems = filteredSlides.length
    const totalPages = Math.ceil(totalItems / limit)
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedSlides = filteredSlides.slice(startIndex, endIndex)

    console.log(`📄 Returning page ${page}/${totalPages} (${paginatedSlides.length}/${totalItems} slides)`)

    // Return with aggressive compression and 24-hour caching
    return createOptimizedResponse({
      data: paginatedSlides, // ✅ Return only paginated data
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      metadata: {
        totalSlides: paginatedSlides.length,
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
        maxAge: 86400, // 24 hours - static data can be cached aggressively
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
