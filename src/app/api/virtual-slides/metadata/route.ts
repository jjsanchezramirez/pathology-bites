// src/app/api/virtual-slides/metadata/route.ts
/**
 * Lightweight metadata API for virtual slides
 * Returns only essential fields for initial page load (~95% size reduction)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createOptimizedResponse } from '@/shared/utils/compression'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'

// R2 Configuration (same pattern)
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

// Minimal slide interface for metadata
interface SlideMetadata {
  id: string
  repository: string
  category: string
  subcategory: string
  diagnosis: string
  hasDetails: boolean // Indicates if full details are available
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    console.log('🔄 Virtual slides metadata API called')

    let slides: any[]
    
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
      console.error('❌ Virtual slides metadata fetch error:', fetchError)
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch virtual slides metadata',
          details: (fetchError as any)?.message || 'Unknown error'
        },
        { status: 500 }
      )
    }

    // Transform to lightweight metadata (95% size reduction)
    const metadata: SlideMetadata[] = slides.map(slide => ({
      id: slide.id,
      repository: slide.repository || 'Unknown',
      category: slide.category || 'Uncategorized',
      subcategory: slide.subcategory || 'General',
      diagnosis: slide.diagnosis || 'No diagnosis available',
      hasDetails: Boolean(slide.url || slide.thumbnail_url || slide.patient_info || slide.clinical_history)
    }))

    // Apply filters to metadata
    let filteredMetadata = metadata
    
    const search = searchParams.get('search')
    if (search) {
      const searchLower = search.toLowerCase()
      filteredMetadata = metadata.filter(slide =>
        slide.diagnosis?.toLowerCase().includes(searchLower) ||
        slide.repository?.toLowerCase().includes(searchLower) ||
        slide.category?.toLowerCase().includes(searchLower) ||
        slide.subcategory?.toLowerCase().includes(searchLower)
      )
    }

    const repository = searchParams.get('repository')
    if (repository) {
      filteredMetadata = filteredMetadata.filter(slide => 
        slide.repository === repository
      )
    }

    const category = searchParams.get('category')
    if (category) {
      filteredMetadata = filteredMetadata.filter(slide => 
        slide.category === category
      )
    }

    const subcategory = searchParams.get('subcategory')
    if (subcategory) {
      filteredMetadata = filteredMetadata.filter(slide => 
        slide.subcategory === subcategory
      )
    }

    // Calculate size reduction
    const originalSize = JSON.stringify(slides).length
    const metadataSize = JSON.stringify(filteredMetadata).length
    const sizeReduction = ((originalSize - metadataSize) / originalSize * 100).toFixed(1)

    console.log(`📊 Metadata response: ${filteredMetadata.length} slides, ${sizeReduction}% size reduction`)

    return createOptimizedResponse({
      data: filteredMetadata,
      metadata: {
        totalSlides: filteredMetadata.length,
        originalTotal: slides.length,
        sizeReduction: `${sizeReduction}%`,
        payloadType: 'metadata-only',
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
          loadingStrategy: 'progressive'
        }
      }
    }, {
      compress: true,
      cache: {
        maxAge: 86400, // 24 hours - metadata changes infrequently
        staleWhileRevalidate: 1800, // 30 minutes
        public: true
      }
    })

  } catch (error) {
    console.error('Virtual slides metadata API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch virtual slides metadata',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}