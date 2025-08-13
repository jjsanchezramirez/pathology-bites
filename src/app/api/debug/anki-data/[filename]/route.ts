// src/app/api/debug/anki-data/[filename]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { transformAnkomaData } from '@/shared/utils/r2-url-transformer'

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
    forcePathStyle: false,
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    // Validate filename to prevent directory traversal
    if (!filename || filename.includes('..') || !filename.endsWith('.json')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      )
    }

    console.log(`Loading Anki JSON file: ${filename} from R2`)

    // Get file directly from pathology-bites-data bucket using S3 client
    const r2Client = createR2Client()

    const command = new GetObjectCommand({
      Bucket: 'pathology-bites-data',
      Key: filename
    })

    const response = await r2Client.send(command)

    if (!response.Body) {
      console.error(`No data received for ${filename} from R2`)
      return NextResponse.json(
        { error: 'File not found in R2' },
        { status: 404 }
      )
    }

    // Convert stream to string and parse JSON
    const fileContent = await response.Body.transformToString()
    const rawJsonData = JSON.parse(fileContent)

    // Transform image URLs for ankoma.json files to use R2 public URLs
    const jsonData = filename === 'ankoma.json' ? transformAnkomaData(rawJsonData) : rawJsonData

    console.log(`Successfully loaded ${filename} from R2 (${Math.round(fileContent.length / 1024)} KB)`)

    return NextResponse.json(jsonData, {
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800', // Aggressive caching: 24h cache, 7d stale
        'CDN-Cache-Control': 'public, max-age=86400',
        'Vercel-CDN-Cache-Control': 'public, max-age=86400'
      }
    })
  } catch (error) {
    console.error('Error reading Anki file from R2:', error)
    return NextResponse.json(
      { error: 'Failed to read file from R2' },
      { status: 500 }
    )
  }
}