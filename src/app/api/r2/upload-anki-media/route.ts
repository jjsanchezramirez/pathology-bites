// src/app/api/r2/upload-anki-media/route.ts
/**
 * API endpoint for bulk uploading Anki media files to Cloudflare R2
 * Uploads all files to pathology-bites-images/anki/ directory
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { uploadToR2 } from '@/shared/services/r2-storage'

// Supported image file extensions (case-insensitive)
const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.jpglarge', '.png_m']

// Content-type mapping for different file extensions
const CONTENT_TYPE_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.jpglarge': 'image/jpeg',
  '.png_m': 'image/png'
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
  r2Key?: string
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
      
      if (SUPPORTED_EXTENSIONS.includes(ext) || !ext) {
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
      targetPath: 'anki/',
      totalFiles: imageFiles.length,
      totalSize,
      totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
      supportedExtensions: SUPPORTED_EXTENSIONS,
      files: imageFiles.slice(0, 20), // Show first 20 files as preview
      message: `Found ${imageFiles.length} files (${Math.round(totalSize / (1024 * 1024) * 100) / 100} MB) to upload to anki/. Use POST to start upload.`
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

    console.log(`Starting Anki media upload from ${mediaDir} to ${targetBucket}/anki/`)

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

    // Filter for supported files
    const mediaFiles = files.filter(filename => {
      const ext = path.extname(filename).toLowerCase()
      return SUPPORTED_EXTENSIONS.includes(ext) || !ext // Include files without extension
    })

    console.log(`Found ${mediaFiles.length} media files to upload`)

    const results: UploadResult[] = []
    const errors: string[] = []
    let uploadedFiles = 0
    let totalSize = 0
    let uploadedSize = 0
    const startTime = Date.now()

    // Upload each file to anki/ directory
    for (let i = 0; i < mediaFiles.length; i++) {
      const filename = mediaFiles[i]
      const filePath = path.join(mediaDir, filename)
      const ext = path.extname(filename).toLowerCase()
      const contentType = CONTENT_TYPE_MAP[ext] || 'application/octet-stream'
      
      // Create R2 key with anki/ prefix
      const r2Key = `anki/${filename}`

      try {
        // Read file
        const fileBuffer = await fs.readFile(filePath)
        const fileSize = fileBuffer.length
        totalSize += fileSize

        // Progress logging
        if (i % 50 === 0 || i < 20) {
          const elapsed = (Date.now() - startTime) / 1000
          const rate = i > 0 ? i / elapsed : 0
          const eta = rate > 0 ? (mediaFiles.length - i) / rate : 0
          console.log(`Uploading ${i + 1}/${mediaFiles.length}: ${filename} → anki/${filename} (${Math.round(fileSize / 1024)} KB) - ${rate.toFixed(1)} files/sec, ETA: ${Math.round(eta)}s`)
        }

        // Upload to R2 with anki/ prefix
        const uploadResult = await uploadToR2(fileBuffer, r2Key, {
          contentType,
          bucket: targetBucket,
          metadata: {
            source: 'anki-media-upload',
            originalFilename: filename,
            uploadedAt: new Date().toISOString()
          }
        })

        results.push({
          filename,
          success: true,
          url: uploadResult.url,
          size: fileSize,
          r2Key: r2Key
        })

        uploadedFiles++
        uploadedSize += fileSize

      } catch (error) {
        const errorMsg = `Failed to upload ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)

        results.push({
          filename,
          success: false,
          error: errorMsg,
          r2Key: r2Key
        })

        errors.push(errorMsg)
      }
    }

    const response: BulkUploadResponse = {
      success: uploadedFiles > 0,
      totalFiles: mediaFiles.length,
      uploadedFiles,
      failedFiles: mediaFiles.length - uploadedFiles,
      results,
      errors,
      totalSize,
      uploadedSize
    }

    const durationSeconds = (Date.now() - startTime) / 1000
    const avgRate = uploadedFiles / durationSeconds

    console.log(`Anki media upload completed in ${durationSeconds.toFixed(1)}s: ${uploadedFiles}/${mediaFiles.length} files uploaded successfully (${avgRate.toFixed(1)} files/sec)`)

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache',
        'X-Total-Files': mediaFiles.length.toString(),
        'X-Uploaded-Files': uploadedFiles.toString(),
        'X-Total-Size': totalSize.toString(),
        'X-Uploaded-Size': uploadedSize.toString(),
        'X-Duration': durationSeconds.toString()
      }
    })

  } catch (error) {
    console.error('Anki media bulk upload error:', error)
    return NextResponse.json({
      error: 'Failed to perform bulk upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}