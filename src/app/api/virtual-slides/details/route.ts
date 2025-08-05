// src/app/api/virtual-slides/details/route.ts
/**
 * On-demand details API for virtual slides
 * Returns full slide data only for requested IDs (batch support)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createOptimizedResponse } from '@/shared/utils/compression'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { VirtualSlide } from '@/shared/types/virtual-slides'

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
    
    // Support both single ID and batch IDs
    const singleId = searchParams.get('id')
    const batchIds = searchParams.get('ids')?.split(',').filter(Boolean) || []
    
    const requestedIds = singleId ? [singleId] : batchIds
    
    if (requestedIds.length === 0) {
      return NextResponse.json(
        { error: 'No slide IDs provided. Use ?id=slideId or ?ids=id1,id2,id3' },
        { status: 400 }
      )
    }

    // Limit batch size to prevent abuse
    if (requestedIds.length > 50) {
      return NextResponse.json(
        { error: 'Batch size limited to 50 slides per request' },
        { status: 400 }
      )
    }

    console.log(`🔄 Virtual slides details API called for ${requestedIds.length} slides`)

    let allSlides: VirtualSlide[]
    
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
      allSlides = JSON.parse(bodyContent)

    } catch (fetchError) {
      console.error('❌ Virtual slides details fetch error:', fetchError)
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch virtual slides details',
          details: (fetchError as any)?.message || 'Unknown error'
        },
        { status: 500 }
      )
    }

    // Find requested slides
    const slideMap = new Map(allSlides.map(slide => [slide.id, slide]))
    const foundSlides: VirtualSlide[] = []
    const notFoundIds: string[] = []

    requestedIds.forEach(id => {
      const slide = slideMap.get(id)
      if (slide) {
        foundSlides.push(slide)
      } else {
        notFoundIds.push(id)
      }
    })

    console.log(`📊 Details response: ${foundSlides.length}/${requestedIds.length} slides found`)

    const result = {
      data: foundSlides,
      metadata: {
        requested: requestedIds.length,
        found: foundSlides.length,
        notFound: notFoundIds.length,
        notFoundIds: notFoundIds.length > 0 ? notFoundIds : undefined,
        payloadType: 'full-details',
        performance: {
          source: 'cloudflare-r2',
          cached: true,
          compressionEnabled: true,
          loadingStrategy: 'on-demand'
        }
      }
    }

    return createOptimizedResponse(result, {
      compress: true,
      cache: {
        maxAge: 86400, // 24 hours - slide details don't change often
        staleWhileRevalidate: 1800, // 30 minutes
        public: true
      }
    })

  } catch (error) {
    console.error('Virtual slides details API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch virtual slides details',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Support POST for larger batch requests
export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json()
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Request body must contain an array of slide IDs' },
        { status: 400 }
      )
    }

    if (ids.length > 100) {
      return NextResponse.json(
        { error: 'Batch size limited to 100 slides per POST request' },
        { status: 400 }
      )
    }

    // Create URL with ids parameter and reuse GET logic
    const url = new URL(request.url)
    url.searchParams.set('ids', ids.join(','))
    
    const getRequest = new NextRequest(url, {
      method: 'GET',
      headers: request.headers
    })

    return await GET(getRequest)

  } catch (error) {
    console.error('Virtual slides POST details error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process batch request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}