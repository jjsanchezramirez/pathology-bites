import { NextResponse } from 'next/server'
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

// Get unique categories from embeddable WSI slides
async function getWSICategories(): Promise<string[]> {
  try {
    console.log('[WSI Categories] Attempting to load categories from private bucket...')
    
    // Generate signed URL for private categories file
    const categoriesCommand = new GetObjectCommand({
      Bucket: 'pathology-bites-data',
      Key: 'wsi-embeddable-categories.json',
    })

    const signedCategoriesUrl = await getSignedUrl(r2Client, categoriesCommand, {
      expiresIn: 7200 // 2 hours
    })
    
    // Try to fetch the tiny categories-only file first using signed URL
    let response = await fetch(signedCategoriesUrl)

    if (response.ok) {
      console.log('[WSI Categories] Using pre-generated categories file')
      const data = await response.json()
      return Array.isArray(data) ? data : (data.categories || [])
    }

    console.log('[WSI Categories] Categories file not available, extracting from metadata...')
    
    // Fallback to metadata file and extract categories using signed URL
    const metadataCommand = new GetObjectCommand({
      Bucket: 'pathology-bites-data',
      Key: 'wsi-embeddable-metadata.json',
    })

    const signedMetadataUrl = await getSignedUrl(r2Client, metadataCommand, {
      expiresIn: 3600 // 1 hour
    })
    
    response = await fetch(signedMetadataUrl)

    if (!response.ok) {
      throw new Error(`Failed to fetch WSI metadata: ${response.status}`)
    }

    const data = await response.json()
    const slides = Array.isArray(data) ? data : (data.slides || [])
    
    // Extract unique categories
    const categories = [...new Set(slides.map((slide: any) => slide.category))]
      .filter(Boolean) as string[]
    
    console.log(`[WSI Categories] Extracted ${categories.length} categories from metadata`)
    return categories.sort()

  } catch (error) {
    console.error('[WSI Categories] Error loading categories:', error)
    
    // Final fallback to hardcoded embeddable categories if all else fails
    console.log('[WSI Categories] Using fallback hardcoded categories')
    return [
      'Bone and Soft Tissue',
      'Breast',
      'Cardiovascular',
      'Dermatopathology', 
      'Gastrointestinal',
      'General Pathology',
      'Genitourinary',
      'Gynecological',
      'Head and Neck - Endocrine',
      'Hematopathology',
      'Neuropathology',
      'Pancreas, Biliary, Liver'
    ].sort()
  }
}

export async function GET() {
  const startTime = Date.now()

  try {
    console.log('[WSI Categories] Starting categories request')

    // Get categories with optimized loading
    const categories = await getWSICategories()
    
    const loadTime = Date.now() - startTime
    console.log(`[WSI Categories] Categories loaded in ${loadTime}ms`)

    const result = {
      success: true,
      categories: categories,
      metadata: {
        loaded_at: new Date().toISOString(),
        load_time_ms: loadTime,
        count: categories.length,
        optimization: 'categories-only'
      }
    }

    return NextResponse.json(result, { 
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=7200', // 2 hours cache - categories rarely change
        'X-Optimization': 'categories-only'
      }
    })
    
  } catch (error) {
    console.error('[WSI Categories] Error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to load WSI categories',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}