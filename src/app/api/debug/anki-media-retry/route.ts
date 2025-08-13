// src/app/api/debug/anki-media-retry/route.ts
/**
 * API endpoint for retrying failed Anki media uploads with proper filename handling
 * Specifically handles files with spaces and special characters in filenames
 * Debug endpoint - no authentication required
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { uploadToR2 } from '@/shared/services/r2-storage'

// Supported image file extensions (case-insensitive)
const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg']

// Content-type mapping for different file extensions
const CONTENT_TYPE_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
}

interface RetryResult {
  filename: string
  success: boolean
  url?: string
  error?: string
  size?: number
  sanitizedFilename?: string
}

interface RetryResponse {
  success: boolean
  totalRetryFiles: number
  uploadedFiles: number
  failedFiles: number
  results: RetryResult[]
  errors: string[]
  totalSize: number
  uploadedSize: number
}

// Function to sanitize filename for R2 upload
function sanitizeFilename(filename: string): string {
  // Replace spaces with underscores and remove/replace problematic characters
  return filename
    .replace(/\s+/g, '_')           // Replace spaces with underscores
    .replace(/[^\w\-_.]/g, '_')     // Replace special chars with underscores
    .replace(/_+/g, '_')            // Replace multiple underscores with single
    .replace(/^_|_$/g, '')          // Remove leading/trailing underscores
}

// GET endpoint - Preview files that would be retried
export async function GET(request: NextRequest) {
  try {
    const mediaDir = path.join(process.cwd(), 'json', 'anki', 'media')
    
    // Check if directory exists
    try {
      await fs.access(mediaDir)
    } catch {
      return NextResponse.json({
        error: 'Anki media directory not found',
        path: mediaDir
      }, { status: 404 })
    }

    // Read directory contents and find files with spaces
    const files = await fs.readdir(mediaDir)
    
    // Filter for image files with spaces (the ones that failed)
    const failedFiles = files.filter(filename => {
      const ext = path.extname(filename).toLowerCase()
      return SUPPORTED_EXTENSIONS.includes(ext) && filename.includes(' ')
    })

    console.log(`Found ${failedFiles.length} files with spaces that need retry`)

    // Analyze each failed file
    const retryPreview = []
    let totalSize = 0

    for (const filename of failedFiles) {
      const filePath = path.join(mediaDir, filename)
      const ext = path.extname(filename).toLowerCase()
      const sanitizedFilename = sanitizeFilename(filename)
      
      try {
        const stats = await fs.stat(filePath)
        retryPreview.push({
          originalFilename: filename,
          sanitizedFilename,
          size: stats.size,
          extension: ext,
          contentType: CONTENT_TYPE_MAP[ext] || 'application/octet-stream'
        })
        totalSize += stats.size
      } catch (error) {
        console.error(`Error reading file ${filename}:`, error)
      }
    }

    return NextResponse.json({
      preview: true,
      directory: mediaDir,
      totalRetryFiles: retryPreview.length,
      totalSize,
      totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
      files: retryPreview,
      message: `Found ${retryPreview.length} failed files ready for retry with sanitized filenames. Use POST to start retry.`
    })

  } catch (error) {
    console.error('Error previewing retry files:', error)
    return NextResponse.json({
      error: 'Failed to preview retry files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST endpoint - Retry failed uploads with sanitized filenames
export async function POST(request: NextRequest) {
  try {
    const mediaDir = path.join(process.cwd(), 'json', 'anki', 'media')
    const targetBucket = 'pathology-bites-images'
    
    // Check if directory exists
    try {
      await fs.access(mediaDir)
    } catch {
      return NextResponse.json({
        error: 'Anki media directory not found',
        path: mediaDir
      }, { status: 404 })
    }

    console.log(`Starting retry upload from ${mediaDir} to R2 bucket ${targetBucket}`)

    // Read directory contents and find files with spaces
    const files = await fs.readdir(mediaDir)
    
    // Filter for image files with spaces (the ones that failed)
    const failedFiles = files.filter(filename => {
      const ext = path.extname(filename).toLowerCase()
      return SUPPORTED_EXTENSIONS.includes(ext) && filename.includes(' ')
    })

    console.log(`Found ${failedFiles.length} files to retry`)

    const results: RetryResult[] = []
    const errors: string[] = []
    let uploadedFiles = 0
    let totalSize = 0
    let uploadedSize = 0
    const startTime = Date.now()

    // Retry each failed file
    for (let i = 0; i < failedFiles.length; i++) {
      const originalFilename = failedFiles[i]
      const sanitizedFilename = sanitizeFilename(originalFilename)
      const filePath = path.join(mediaDir, originalFilename)
      const ext = path.extname(originalFilename).toLowerCase()
      const contentType = CONTENT_TYPE_MAP[ext] || 'application/octet-stream'

      try {
        // Read file
        const fileBuffer = await fs.readFile(filePath)
        const fileSize = fileBuffer.length
        totalSize += fileSize

        console.log(`Retrying ${i + 1}/${failedFiles.length}: "${originalFilename}" -> "${sanitizedFilename}" (${Math.round(fileSize / 1024)} KB)`)

        // Upload to R2 with sanitized filename and no problematic metadata
        const uploadResult = await uploadToR2(fileBuffer, sanitizedFilename, {
          contentType,
          bucket: targetBucket,
          metadata: {
            source: 'anki-media-retry',
            originalname: sanitizedFilename, // Use sanitized name in metadata too
            uploadedAt: new Date().toISOString()
          }
        })

        results.push({
          filename: originalFilename,
          sanitizedFilename,
          success: true,
          url: uploadResult.url,
          size: fileSize
        })

        uploadedFiles++
        uploadedSize += fileSize

      } catch (error) {
        const errorMsg = `Failed to retry upload ${originalFilename}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        
        results.push({
          filename: originalFilename,
          sanitizedFilename,
          success: false,
          error: errorMsg
        })
        
        errors.push(errorMsg)
      }
    }

    const response: RetryResponse = {
      success: uploadedFiles > 0,
      totalRetryFiles: failedFiles.length,
      uploadedFiles,
      failedFiles: failedFiles.length - uploadedFiles,
      results,
      errors,
      totalSize,
      uploadedSize
    }

    const elapsed = (Date.now() - startTime) / 1000
    console.log(`Retry upload completed in ${elapsed.toFixed(1)}s: ${uploadedFiles}/${failedFiles.length} files uploaded successfully`)

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache',
        'X-Total-Retry-Files': failedFiles.length.toString(),
        'X-Uploaded-Files': uploadedFiles.toString(),
        'X-Total-Size': totalSize.toString(),
        'X-Uploaded-Size': uploadedSize.toString(),
        'X-Elapsed-Time': elapsed.toString()
      }
    })

  } catch (error) {
    console.error('Retry upload error:', error)
    return NextResponse.json({
      error: 'Failed to perform retry upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
