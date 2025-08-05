// src/app/api/tools/cell-quiz/references/route.ts
/**
 * API endpoint for cell quiz references data
 * Serves data from local file system with compression and caching
 */

import { NextRequest, NextResponse } from 'next/server'
import { createOptimizedResponse } from '@/shared/utils/compression'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

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

export async function GET() {
  try {
    // Fetch from R2 private bucket
    const r2Client = createR2Client()

    const command = new GetObjectCommand({
      Bucket: 'pathology-bites-data',
      Key: 'cell-quiz-references.json'
    })

    const response = await r2Client.send(command)

    if (!response.Body) {
      throw new Error('No data received from R2')
    }

    // Convert stream to string
    const fileContent = await response.Body.transformToString()
    const data = JSON.parse(fileContent)

    // Return with compression and aggressive 24-hour caching
    return createOptimizedResponse(data, {
      compress: true,
      cache: {
        maxAge: 86400, // 24 hours
        staleWhileRevalidate: 3600, // 1 hour
        public: true
      }
    })

  } catch (error) {
    console.error('Error loading cell quiz references from R2:', error)

    return NextResponse.json(
      { error: 'Failed to load cell quiz references' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate the data structure
    if (!body.cells || !Array.isArray(body.cells)) {
      return NextResponse.json(
        { error: 'Invalid data structure: cells array required' },
        { status: 400 }
      )
    }

    // Upload to R2 private bucket
    const r2Client = createR2Client()

    const command = new PutObjectCommand({
      Bucket: 'pathology-bites-data',
      Key: 'cell-quiz-references.json',
      Body: JSON.stringify(body, null, 2),
      ContentType: 'application/json'
    })

    await r2Client.send(command)

    return NextResponse.json({
      success: true,
      message: 'Cell quiz references updated successfully',
      cellCount: body.cells.length
    })

  } catch (error) {
    console.error('Error updating cell quiz references:', error)
    return NextResponse.json(
      { error: 'Failed to update cell quiz references' },
      { status: 500 }
    )
  }
}
