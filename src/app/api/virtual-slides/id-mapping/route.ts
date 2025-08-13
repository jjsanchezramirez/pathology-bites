/**
 * ID Mapping endpoint
 * Fetches ID mapping from R2 with maximum caching
 * Maps short IDs to original slide IDs for ultra-minimal strategy
 */

import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

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
    console.log('🔍 ID mapping API called - fetching from R2')
    
    // Fetch ID mapping from R2 with maximum caching
    const r2Client = createR2Client()
    
    const command = new GetObjectCommand({
      Bucket: 'pathology-bites-data',
      Key: 'virtual-slides-id-mapping.json'
    })

    const response = await r2Client.send(command)
    
    if (!response.Body) {
      throw new Error('No response body from R2')
    }

    const mappingData = await response.Body.transformToString()
    const idMapping = JSON.parse(mappingData)
    
    console.log(`✅ ID mapping loaded from R2: ${Object.keys(idMapping).length} mappings, ${(mappingData.length / 1024).toFixed(2)} KB`)
    
    return new NextResponse(JSON.stringify({
      data: idMapping,
      metadata: {
        totalMappings: Object.keys(idMapping).length,
        fileSize: `${(mappingData.length / 1024).toFixed(2)} KB`,
        performance: {
          source: 'r2-storage',
          cached: true,
          strategy: 'id-mapping'
        }
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        // Maximum caching - ID mapping rarely changes
        'Cache-Control': 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=604800', // 30 days cache, 7 days stale
        'CDN-Cache-Control': 'public, max-age=2592000',
        'Vercel-CDN-Cache-Control': 'public, max-age=2592000',
        'Vary': 'Accept-Encoding',
        'ETag': response.ETag || undefined
      }
    })
    
  } catch (error) {
    console.error('❌ ID mapping API R2 fetch error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch ID mapping from R2',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Metadata endpoint
export async function HEAD(request: NextRequest) {
  try {
    const r2Client = createR2Client()
    
    const command = new GetObjectCommand({
      Bucket: 'pathology-bites-data',
      Key: 'virtual-slides-id-mapping.json'
    })

    const response = await r2Client.send(command)
    
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': response.ContentLength?.toString() || '0',
        'Last-Modified': response.LastModified?.toUTCString() || new Date().toUTCString(),
        'Cache-Control': 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=604800',
        'CDN-Cache-Control': 'public, max-age=2592000',
        'ETag': response.ETag || undefined
      }
    })
    
  } catch (error) {
    return new NextResponse(null, { status: 404 })
  }
}
