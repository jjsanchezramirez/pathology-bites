import { NextResponse } from 'next/server'
import { createOptimizedResponse } from '@/shared/utils/compression'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'

// R2 Configuration (same pattern as virtual slides)
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

export async function GET() {
  try {
    console.log('🔄 ABPath content specs API called - using R2 private bucket access')
    
    let data: any
    
    try {
      const r2Client = createR2Client()
      
      const command = new GetObjectCommand({
        Bucket: 'pathology-bites-data',
        Key: 'abpath-content-specs.json'
      })

      const response = await r2Client.send(command)
      
      if (!response.Body) {
        throw new Error('No response body from R2')
      }

      console.log('📊 R2 response received, parsing JSON...')
      const bodyContent = await response.Body.transformToString()
      const contentSize = bodyContent.length
      console.log('📏 Content size:', `${(contentSize / (1024 * 1024)).toFixed(1)}MB`)
      
      data = JSON.parse(bodyContent)
      console.log('✅ ABPath content specs parsed successfully')

    } catch (fetchError) {
      console.error('❌ ABPath content specs R2 fetch error:', fetchError)
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch ABPath content specifications from R2 private bucket',
          details: (fetchError as any)?.message || 'Unknown error',
          bucket: 'pathology-bites-data',
          key: 'abpath-content-specs.json'
        },
        { status: 500 }
      )
    }

    // Return with compression and aggressive caching for static data
    return createOptimizedResponse(data, {
      compress: true,
      cache: {
        maxAge: 86400, // 24 hours - static data can be cached aggressively
        staleWhileRevalidate: 300, // 5 minutes
        public: true
      }
    })

  } catch (error) {
    console.error('Error loading content specifications:', error)

    return NextResponse.json(
      { error: 'Failed to load content specifications' },
      { status: 500 }
    )
  }
}
