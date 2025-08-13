// src/app/api/debug/upload-ankoma/route.ts
/**
 * API endpoint for uploading ankoma.json to Cloudflare R2
 * One-time operation to migrate the JSON file to R2
 * Debug endpoint - no authentication required
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { uploadToR2 } from '@/shared/services/r2-storage'

export async function POST(request: NextRequest) {
  try {
    const ankomaPath = path.join(process.cwd(), 'json', 'anki', 'ankoma.json')
    const targetBucket = 'pathology-bites-data'
    
    console.log('Starting ankoma.json upload to R2...')
    
    // Check if file exists
    try {
      await fs.access(ankomaPath)
    } catch {
      return NextResponse.json({
        error: 'ankoma.json not found',
        path: ankomaPath
      }, { status: 404 })
    }

    // Read the file
    const fileBuffer = await fs.readFile(ankomaPath)
    const fileSize = fileBuffer.length
    
    console.log(`Uploading ankoma.json (${Math.round(fileSize / (1024 * 1024) * 100) / 100} MB) to ${targetBucket}`)

    // Upload to R2
    const uploadResult = await uploadToR2(fileBuffer, 'ankoma.json', {
      contentType: 'application/json',
      bucket: targetBucket,
      metadata: {
        source: 'ankoma-migration',
        originalPath: ankomaPath,
        uploadedAt: new Date().toISOString()
      }
    })

    console.log('ankoma.json uploaded successfully to R2')

    return NextResponse.json({
      success: true,
      message: 'ankoma.json uploaded successfully',
      url: uploadResult.url,
      size: fileSize,
      sizeMB: Math.round(fileSize / (1024 * 1024) * 100) / 100,
      bucket: targetBucket,
      key: 'ankoma.json'
    }, {
      headers: {
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('ankoma.json upload error:', error)
    return NextResponse.json({
      error: 'Failed to upload ankoma.json',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint to check if ankoma.json exists in R2
export async function GET(request: NextRequest) {
  try {
    // Try to fetch the file from R2 to check if it exists
    const response = await fetch('https://pathology-bites-data.r2.dev/ankoma.json')
    
    if (response.ok) {
      const contentLength = response.headers.get('content-length')
      return NextResponse.json({
        exists: true,
        size: contentLength ? parseInt(contentLength) : null,
        sizeMB: contentLength ? Math.round(parseInt(contentLength) / (1024 * 1024) * 100) / 100 : null,
        url: 'https://pathology-bites-data.r2.dev/ankoma.json',
        message: 'ankoma.json exists in R2'
      })
    } else {
      return NextResponse.json({
        exists: false,
        message: 'ankoma.json not found in R2',
        suggestion: 'Use POST to upload the file'
      })
    }
  } catch (error) {
    console.error('Error checking ankoma.json in R2:', error)
    return NextResponse.json({
      error: 'Failed to check ankoma.json in R2',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
