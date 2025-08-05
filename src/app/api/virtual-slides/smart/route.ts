// src/app/api/virtual-slides/smart/route.ts
/**
 * Smart paginated API for virtual slides
 * Balances UX (fast initial load) with efficiency (leverages R2 zero egress)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createOptimizedResponse } from '@/shared/utils/compression'
import { VirtualSlide } from '@/shared/types/virtual-slides'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'

// R2 Configuration
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
    
    // Smart defaults
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200) // Max 200 per page
    const fullDataset = searchParams.get('full') === 'true' // Escape hatch for power users
    
    // Search and filter params
    const search = searchParams.get('search')
    const repository = searchParams.get('repository')
    const category = searchParams.get('category')
    const subcategory = searchParams.get('subcategory')

    console.log(`🔄 Smart API called: page=${page}, limit=${limit}, full=${fullDataset}`)

    let slides: VirtualSlide[]
    
    try {
      const r2Client = createR2Client()
      
      const command = new GetObjectCommand({
        Bucket: 'pathology-bites-data',
        Key: 'virtual-slides.json'
      })

      const response = await r2Client.send(command)
      
      if (!response.Body) {
        throw new Error('No response body from R2')
      }

      const bodyContent = await response.Body.transformToString()
      slides = JSON.parse(bodyContent)
      console.log(`✅ Full dataset loaded: ${slides.length} slides`)

    } catch (fetchError) {
      console.error('❌ Smart API R2 fetch error:', fetchError)
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch virtual slides',
          details: (fetchError as any)?.message || 'Unknown error'
        },
        { status: 500 }
      )
    }

    // Apply filters first (server-side for efficiency)
    let filteredSlides = slides
    
    if (search) {
      const searchLower = search.toLowerCase()
      filteredSlides = slides.filter(slide =>
        slide.diagnosis?.toLowerCase().includes(searchLower) ||
        slide.repository?.toLowerCase().includes(searchLower) ||
        slide.category?.toLowerCase().includes(searchLower) ||
        slide.subcategory?.toLowerCase().includes(searchLower) ||
        slide.patient_info?.toLowerCase().includes(searchLower)
      )
    }

    if (repository && repository !== 'all') {
      filteredSlides = filteredSlides.filter(slide => 
        slide.repository === repository
      )
    }

    if (category && category !== 'all') {
      filteredSlides = filteredSlides.filter(slide => 
        slide.category === category
      )
    }

    if (subcategory && subcategory !== 'all') {
      filteredSlides = filteredSlides.filter(slide => 
        slide.subcategory === subcategory
      )
    }

    const totalFiltered = filteredSlides.length

    // Smart pagination logic
    let resultSlides: VirtualSlide[]
    let pagination: any

    if (fullDataset) {
      // Power user escape hatch - return everything (R2 egress is free!)
      resultSlides = filteredSlides
      pagination = {
        strategy: 'full-dataset',
        totalItems: totalFiltered,
        note: 'Full dataset returned - R2 egress is free'
      }
    } else {
      // Smart pagination for better UX
      const totalPages = Math.ceil(totalFiltered / limit)
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      
      resultSlides = filteredSlides.slice(startIndex, endIndex)
      
      pagination = {
        strategy: 'paginated',
        page,
        limit,
        totalItems: totalFiltered,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        smartTip: totalFiltered < 500 ? 'Consider using ?full=true for better performance' : undefined
      }
    }

    // Calculate payload info
    const payloadSize = JSON.stringify(resultSlides).length
    const fullSize = JSON.stringify(filteredSlides).length
    const sizeReduction = fullDataset ? 0 : ((fullSize - payloadSize) / fullSize * 100)

    console.log(`📊 Smart API response: ${resultSlides.length} slides, ${sizeReduction.toFixed(1)}% size reduction`)

    return createOptimizedResponse({
      data: resultSlides,
      pagination,
      metadata: {
        totalSlides: resultSlides.length,
        filteredTotal: totalFiltered,
        originalTotal: slides.length,
        payloadStrategy: fullDataset ? 'full-dataset' : 'paginated',
        sizeReduction: fullDataset ? '0%' : `${sizeReduction.toFixed(1)}%`,
        filters: {
          search,
          repository,
          category,
          subcategory
        },
        performance: {
          source: 'cloudflare-r2',
          cached: true,
          compressionEnabled: true,
          egressCost: '$0 (R2 zero egress)',
          strategy: 'smart-pagination'
        }
      }
    }, {
      compress: true,
      cache: {
        maxAge: 86400, // 24 hours - leverage free egress
        staleWhileRevalidate: 1800, // 30 minutes
        public: true
      }
    })

  } catch (error) {
    console.error('Smart virtual slides API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch virtual slides',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}