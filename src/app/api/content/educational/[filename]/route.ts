import { NextRequest, NextResponse } from 'next/server'
import { createOptimizedResponse } from '@/shared/utils/compression'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// R2 configuration for educational content data bucket
const r2Client = new S3Client({
  region: 'auto',
  endpoint: 'https://1faba3419ce733a22d081e271ae7a750.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

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

    // Generate signed URL for private educational content file in pathology-bites-data bucket
    const contentKey = `context/${filename}`
    const command = new GetObjectCommand({
      Bucket: 'pathology-bites-data',
      Key: contentKey,
    })

    const signedUrl = await getSignedUrl(r2Client, command, {
      expiresIn: 3600 // 1 hour
    })

    // Fetch from R2 using signed URL for private file access
    const response = await fetch(signedUrl)

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        )
      }
      throw new Error(`Failed to fetch educational content file: ${response.status}`)
    }

    const data = await response.json()

    // Return with compression and 24-hour caching for educational content data
    return createOptimizedResponse(data, {
      compress: true,
      cache: {
        maxAge: 86400, // 24 hours - educational content is static
        staleWhileRevalidate: 1800, // 30 minutes
        public: true
      }
    })

  } catch (error) {
    console.error('Error reading educational content file:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
