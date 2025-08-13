// src/app/api/debug/anki-media-analysis/route.ts
/**
 * API endpoint for analyzing Anki media upload failures
 * Compares local files with uploaded files to identify failures and their causes
 * Debug endpoint - no authentication required
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { listR2Files } from '@/shared/services/r2-storage'

// Supported image file extensions (case-insensitive)
const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg']

interface FileAnalysis {
  filename: string
  localExists: boolean
  uploadedToR2: boolean
  size?: number
  extension: string
  status: 'success' | 'failed' | 'skipped'
  failureReason?: string
}

interface AnalysisResult {
  summary: {
    totalLocalFiles: number
    totalUploadedFiles: number
    successfulUploads: number
    failedUploads: number
    skippedFiles: number
  }
  failedFiles: FileAnalysis[]
  skippedFiles: FileAnalysis[]
  successfulFiles: FileAnalysis[]
  detailedAnalysis: {
    failureReasons: Record<string, number>
    extensionBreakdown: Record<string, { total: number, uploaded: number, failed: number }>
  }
}

export async function GET(request: NextRequest) {
  try {
    const mediaDir = path.join(process.cwd(), 'json', 'anki', 'media')
    const targetBucket = 'pathology-bites-images'
    
    console.log('Starting Anki media upload analysis...')
    
    // Check if directory exists
    try {
      await fs.access(mediaDir)
    } catch {
      return NextResponse.json({
        error: 'Anki media directory not found',
        path: mediaDir
      }, { status: 404 })
    }

    // Get all local image files
    const localFiles = await fs.readdir(mediaDir)
    const localImageFiles = localFiles.filter(filename => {
      const ext = path.extname(filename).toLowerCase()
      return SUPPORTED_EXTENSIONS.includes(ext)
    })

    console.log(`Found ${localImageFiles.length} local image files`)

    // Get all uploaded files from R2
    console.log('Fetching uploaded files from R2...')
    const uploadedFiles = new Set<string>()
    let continuationToken: string | undefined
    let hasMore = true

    while (hasMore) {
      const r2Result = await listR2Files({
        bucket: targetBucket,
        maxKeys: 1000,
        continuationToken
      })

      r2Result.files.forEach(file => uploadedFiles.add(file.key))
      hasMore = r2Result.isTruncated
      continuationToken = r2Result.nextContinuationToken

      console.log(`Fetched batch: ${r2Result.files.length} files, total so far: ${uploadedFiles.size}`)
    }

    console.log(`Found ${uploadedFiles.size} uploaded files in R2`)

    // Analyze each local file
    const analysis: FileAnalysis[] = []
    const extensionStats: Record<string, { total: number, uploaded: number, failed: number }> = {}
    const failureReasons: Record<string, number> = {}

    for (const filename of localImageFiles) {
      const filePath = path.join(mediaDir, filename)
      const ext = path.extname(filename).toLowerCase()
      const isUploaded = uploadedFiles.has(filename)
      
      // Initialize extension stats
      if (!extensionStats[ext]) {
        extensionStats[ext] = { total: 0, uploaded: 0, failed: 0 }
      }
      extensionStats[ext].total++

      let fileAnalysis: FileAnalysis = {
        filename,
        localExists: true,
        uploadedToR2: isUploaded,
        extension: ext,
        status: isUploaded ? 'success' : 'failed'
      }

      try {
        const stats = await fs.stat(filePath)
        fileAnalysis.size = stats.size
      } catch (error) {
        fileAnalysis.localExists = false
        fileAnalysis.status = 'skipped'
        fileAnalysis.failureReason = 'File not accessible locally'
      }

      // Determine failure reason for files that weren't uploaded
      if (!isUploaded && fileAnalysis.localExists) {
        let failureReason = 'Unknown failure'
        
        // Check for common failure patterns
        if (filename.includes(' ')) {
          failureReason = 'Filename contains spaces (metadata header issue)'
        } else if (filename.match(/[^\w\-_.]/)) {
          failureReason = 'Filename contains special characters (metadata header issue)'
        } else if (fileAnalysis.size === 0) {
          failureReason = 'Empty file (0 bytes)'
        } else if (!SUPPORTED_EXTENSIONS.includes(ext)) {
          failureReason = 'Unsupported file extension'
        } else if (fileAnalysis.size && fileAnalysis.size > 100 * 1024 * 1024) {
          failureReason = 'File too large (>100MB)'
        }
        
        fileAnalysis.failureReason = failureReason
        failureReasons[failureReason] = (failureReasons[failureReason] || 0) + 1
        extensionStats[ext].failed++
      } else if (isUploaded) {
        extensionStats[ext].uploaded++
      }

      analysis.push(fileAnalysis)
    }

    // Separate files by status
    const failedFiles = analysis.filter(f => f.status === 'failed')
    const skippedFiles = analysis.filter(f => f.status === 'skipped')
    const successfulFiles = analysis.filter(f => f.status === 'success')

    const result: AnalysisResult = {
      summary: {
        totalLocalFiles: localImageFiles.length,
        totalUploadedFiles: uploadedFiles.size,
        successfulUploads: successfulFiles.length,
        failedUploads: failedFiles.length,
        skippedFiles: skippedFiles.length
      },
      failedFiles: failedFiles.sort((a, b) => a.filename.localeCompare(b.filename)),
      skippedFiles: skippedFiles.sort((a, b) => a.filename.localeCompare(b.filename)),
      successfulFiles: successfulFiles.slice(0, 10), // Show first 10 successful files as sample
      detailedAnalysis: {
        failureReasons,
        extensionBreakdown: extensionStats
      }
    }

    console.log(`Analysis complete: ${successfulFiles.length} successful, ${failedFiles.length} failed, ${skippedFiles.length} skipped`)

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-cache',
        'X-Analysis-Timestamp': new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json({
      error: 'Failed to analyze upload results',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST endpoint for retry failed uploads
export async function POST(request: NextRequest) {
  try {
    const { retryFailedOnly = true } = await request.json()
    
    return NextResponse.json({
      message: 'Retry functionality not yet implemented',
      suggestion: 'Use the main upload endpoint with specific file filtering'
    }, { status: 501 })

  } catch (error) {
    console.error('Retry error:', error)
    return NextResponse.json({
      error: 'Failed to process retry request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
