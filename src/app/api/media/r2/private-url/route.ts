/**
 * API endpoint for generating signed URLs for private R2 files
 * Provides temporary access to files in private buckets
 * Debug endpoint - no authentication required
 */

import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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
  })
}

export async function POST(request: NextRequest) {
  try {
    const { key, bucket, expiresIn = 3600 } = await request.json()

    if (!key || !bucket) {
      return NextResponse.json(
        { error: 'Missing required parameters: key and bucket' },
        { status: 400 }
      )
    }

    const r2Client = createR2Client()

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    })

    // Generate signed URL (default 1 hour expiration)
    const signedUrl = await getSignedUrl(r2Client, command, {
      expiresIn: Math.min(expiresIn, 7200) // Max 2 hours
    })

    return NextResponse.json({
      signedUrl,
      key,
      bucket,
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
    })

  } catch (error) {
    console.error('R2 signed URL generation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate signed URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const bucket = searchParams.get('bucket')
    const expiresIn = parseInt(searchParams.get('expiresIn') || '3600')

    if (!key || !bucket) {
      return NextResponse.json(
        { error: 'Missing required parameters: key and bucket' },
        { status: 400 }
      )
    }

    const r2Client = createR2Client()

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    })

    // Generate signed URL
    const signedUrl = await getSignedUrl(r2Client, command, {
      expiresIn: Math.min(expiresIn, 7200) // Max 2 hours
    })

    return NextResponse.json({
      signedUrl,
      key,
      bucket,
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
    })

  } catch (error) {
    console.error('R2 signed URL generation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate signed URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
