import { NextRequest, NextResponse } from 'next/server'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

// R2 configuration for educational content data bucket
const r2Client = new S3Client({
  region: 'auto',
  endpoint: 'https://1faba3419ce733a22d081e271ae7a750.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

export async function GET(request: NextRequest) {
  try {
    // List all files in the context/ folder of pathology-bites-data bucket
    const command = new ListObjectsV2Command({
      Bucket: 'pathology-bites-data',
      Prefix: 'context/',
      MaxKeys: 1000
    })

    const response = await r2Client.send(command)
    
    const files = response.Contents?.map(obj => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified,
      filename: obj.Key?.replace('context/', '')
    })) || []

    return NextResponse.json({
      success: true,
      bucket: 'pathology-bites-data',
      prefix: 'context/',
      totalFiles: files.length,
      files: files
    })

  } catch (error) {
    console.error('Error listing context files:', error)
    return NextResponse.json({
      error: 'Failed to list context files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}