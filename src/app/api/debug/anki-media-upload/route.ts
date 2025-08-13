// src/app/api/debug/anki-media-upload/route.ts
/**
 * API endpoint for bulk uploading Anki media files to Cloudflare R2
 * Transfers all image files from local json/anki/media/ directory to R2 bucket
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

interface FileInfo {
  filename: string
  size: number
  extension: string
  contentType: string
}

interface UploadResult {
  filename: string
  success: boolean
  url?: string
  error?: string
  size?: number
}

interface BulkUploadResponse {
  success: boolean
  totalFiles: number
  uploadedFiles: number
  failedFiles: number
  results: UploadResult[]
  errors: string[]
  totalSize: number
  uploadedSize: number
}

// GET endpoint - Preview files that would be uploaded
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

    // Read directory contents
    const files = await fs.readdir(mediaDir)
    
    // Filter and analyze image files
    const imageFiles: FileInfo[] = []
    let totalSize = 0

    for (const filename of files) {
      const ext = path.extname(filename).toLowerCase()
      
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        const filePath = path.join(mediaDir, filename)
        const stats = await fs.stat(filePath)
        
        const fileInfo: FileInfo = {
          filename,
          size: stats.size,
          extension: ext,
          contentType: CONTENT_TYPE_MAP[ext] || 'application/octet-stream'
        }
        
        imageFiles.push(fileInfo)
        totalSize += stats.size
      }
    }

    return NextResponse.json({
      preview: true,
      directory: mediaDir,
      totalFiles: imageFiles.length,
      totalSize,
      totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
      supportedExtensions: SUPPORTED_EXTENSIONS,
      files: imageFiles.slice(0, 10), // Show first 10 files as preview
      message: `Found ${imageFiles.length} image files (${Math.round(totalSize / (1024 * 1024) * 100) / 100} MB). Use POST to start upload.`
    })

  } catch (error) {
    console.error('Error previewing Anki media files:', error)
    return NextResponse.json({
      error: 'Failed to preview files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST endpoint - Perform bulk upload
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

    console.log(`Starting bulk upload from ${mediaDir} to R2 bucket ${targetBucket}`)

    // Read directory contents
    const files = await fs.readdir(mediaDir)

    // Filter for image files
    const imageFiles = files.filter(filename => {
      const ext = path.extname(filename).toLowerCase()
      return SUPPORTED_EXTENSIONS.includes(ext)
    })

    console.log(`Found ${imageFiles.length} image files to upload`)

    const results: UploadResult[] = []
    const errors: string[] = []
    let uploadedFiles = 0
    let totalSize = 0
    let uploadedSize = 0
    const startTime = Date.now()

    // Upload each file
    for (let i = 0; i < imageFiles.length; i++) {
      const filename = imageFiles[i]
      const filePath = path.join(mediaDir, filename)
      const ext = path.extname(filename).toLowerCase()
      const contentType = CONTENT_TYPE_MAP[ext] || 'application/octet-stream'

      try {
        // Read file
        const fileBuffer = await fs.readFile(filePath)
        const fileSize = fileBuffer.length
        totalSize += fileSize

        // Progress logging every 100 files
        if (i % 100 === 0 || i < 50) {
          const elapsed = (Date.now() - startTime) / 1000
          const rate = i > 0 ? i / elapsed : 0
          const eta = rate > 0 ? (imageFiles.length - i) / rate : 0
          console.log(`Uploading ${i + 1}/${imageFiles.length}: ${filename} (${Math.round(fileSize / 1024)} KB) - ${rate.toFixed(1)} files/sec, ETA: ${Math.round(eta)}s`)
        }

        // Upload to R2 (sanitize metadata to avoid header issues)
        const uploadResult = await uploadToR2(fileBuffer, filename, {
          contentType,
          bucket: targetBucket,
          metadata: {
            source: 'anki-media-migration',
            originalname: filename.replace(/[^\w\-_.]/g, '_'), // Sanitize filename for metadata
            uploadedAt: new Date().toISOString()
          }
        })

        results.push({
          filename,
          success: true,
          url: uploadResult.url,
          size: fileSize
        })

        uploadedFiles++
        uploadedSize += fileSize

      } catch (error) {
        const errorMsg = `Failed to upload ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)

        results.push({
          filename,
          success: false,
          error: errorMsg
        })

        errors.push(errorMsg)
      }
    }

    const response: BulkUploadResponse = {
      success: uploadedFiles > 0,
      totalFiles: imageFiles.length,
      uploadedFiles,
      failedFiles: imageFiles.length - uploadedFiles,
      results,
      errors,
      totalSize,
      uploadedSize
    }

    console.log(`Bulk upload completed: ${uploadedFiles}/${imageFiles.length} files uploaded successfully`)

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache',
        'X-Total-Files': imageFiles.length.toString(),
        'X-Uploaded-Files': uploadedFiles.toString(),
        'X-Total-Size': totalSize.toString(),
        'X-Uploaded-Size': uploadedSize.toString()
      }
    })

  } catch (error) {
    console.error('Bulk upload error:', error)
    return NextResponse.json({
      error: 'Failed to perform bulk upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
