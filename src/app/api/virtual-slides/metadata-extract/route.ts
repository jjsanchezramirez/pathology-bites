/**
 * Extract metadata from virtual slides for filters
 * Creates a metadata JSON file with repositories, categories, and organ systems
 */

import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
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

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Extracting metadata from virtual slides...')
    
    const r2Client = createR2Client()

    // Load the optimized dataset
    const command = new GetObjectCommand({
      Bucket: 'pathology-bites-data',
      Key: 'virtual-slides-optimized.json'
    })

    const response = await r2Client.send(command)
    
    if (!response.Body) {
      throw new Error('No response body from R2')
    }

    const slidesData = await response.Body.transformToString()
    const slides: VirtualSlide[] = JSON.parse(slidesData)

    console.log(`📊 Processing ${slides.length} slides for metadata extraction...`)

    // Extract unique values
    const repositories = new Set<string>()
    const categories = new Set<string>()
    const organSystems = new Set<string>()

    slides.forEach(slide => {
      if (slide.repository) repositories.add(slide.repository)
      if (slide.category) categories.add(slide.category)
      if (slide.subcategory) organSystems.add(slide.subcategory)
    })

    const metadata = {
      repositories: Array.from(repositories).sort(),
      categories: Array.from(categories).sort(),
      organSystems: Array.from(organSystems).sort(),
      totalSlides: slides.length,
      extractedAt: new Date().toISOString(),
      stats: {
        repositoriesCount: repositories.size,
        categoriesCount: categories.size,
        organSystemsCount: organSystems.size
      }
    }

    console.log(`✅ Metadata extracted:`)
    console.log(`   - ${metadata.repositories.length} repositories`)
    console.log(`   - ${metadata.categories.length} categories`)
    console.log(`   - ${metadata.organSystems.length} organ systems`)

    // Upload metadata to R2
    const metadataJson = JSON.stringify(metadata, null, 2)
    
    const uploadCommand = new PutObjectCommand({
      Bucket: 'pathology-bites-data',
      Key: 'virtual-slides-metadata.json',
      Body: metadataJson,
      ContentType: 'application/json',
      CacheControl: 'public, max-age=86400' // 24 hours
    })

    await r2Client.send(uploadCommand)

    console.log('📤 Metadata uploaded to R2: virtual-slides-metadata.json')

    return NextResponse.json({
      success: true,
      metadata,
      message: 'Metadata extracted and uploaded to R2 successfully'
    })

  } catch (error) {
    console.error('❌ Metadata extraction error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to extract metadata',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
