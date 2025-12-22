// src/app/api/media/r2/upload-anki-media/route.ts
/**
 * API endpoint for bulk uploading Anki media files to Cloudflare R2
 * Features:
 * - Aggressive image compression using Sharp
 * - Automatic resizing for very large images (max 2400px)
 * - Replaces existing files with same name
 * - Uploads all files to pathology-bites-images/anki/ directory
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import sharp from 'sharp'
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

// Compression settings - aggressive but maintains quality
const COMPRESSION_CONFIG = {
  // Maximum dimensions - resize larger images
  maxWidth: 2400,
  maxHeight: 2400,

  // JPEG settings
  jpeg: {
    quality: 85,        // High quality, aggressive compression
    progressive: true,  // Progressive loading
    mozjpeg: true      // Use mozjpeg for better compression
  },

  // PNG settings
  png: {
    quality: 85,
    compressionLevel: 9,  // Maximum compression
    progressive: true
  },

  // WebP settings (convert large PNGs to WebP for better compression)
  webp: {
    quality: 85,
    effort: 6  // Higher effort = better compression (0-6)
  }
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
  originalSize?: number
  compressionRatio?: number
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
  compressionRatio: number
}

/**
 * Compress an image file using Sharp
 * - Resizes very large images
 * - Applies aggressive compression while maintaining quality
 * - Handles different image formats appropriately
 * - SVG files are passed through without compression
 */
async function compressImage(
  fileBuffer: Buffer,
  filename: string,
  ext: string
): Promise<{ buffer: Buffer; originalSize: number; compressedSize: number }> {
  const originalSize = fileBuffer.length

  // SVG files - no compression needed, already optimal
  if (ext === '.svg') {
    return {
      buffer: fileBuffer,
      originalSize,
      compressedSize: originalSize
    }
  }

  // GIF files - preserve animation, light compression only
  if (ext === '.gif') {
    const compressed = await sharp(fileBuffer, { animated: true })
      .gif()
      .toBuffer()
    return {
      buffer: compressed,
      originalSize,
      compressedSize: compressed.length
    }
  }

  try {
    // Start with Sharp pipeline
    let pipeline = sharp(fileBuffer)

    // Get image metadata to check dimensions
    const metadata = await pipeline.metadata()

    // Resize if image is larger than max dimensions
    if (
      metadata.width &&
      metadata.height &&
      (metadata.width > COMPRESSION_CONFIG.maxWidth ||
        metadata.height > COMPRESSION_CONFIG.maxHeight)
    ) {
      pipeline = pipeline.resize(COMPRESSION_CONFIG.maxWidth, COMPRESSION_CONFIG.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      console.log(
        `  Resizing ${filename}: ${metadata.width}x${metadata.height} → max ${COMPRESSION_CONFIG.maxWidth}x${COMPRESSION_CONFIG.maxHeight}`
      )
    }

    // Apply format-specific compression
    let compressed: Buffer
    if (ext === '.png' || ext === '.png_m') {
      compressed = await pipeline
        .png({
          quality: COMPRESSION_CONFIG.png.quality,
          compressionLevel: COMPRESSION_CONFIG.png.compressionLevel,
          progressive: COMPRESSION_CONFIG.png.progressive
        })
        .toBuffer()
    } else if (ext === '.jpg' || ext === '.jpeg' || ext === '.jpglarge') {
      compressed = await pipeline
        .jpeg({
          quality: COMPRESSION_CONFIG.jpeg.quality,
          progressive: COMPRESSION_CONFIG.jpeg.progressive,
          mozjpeg: COMPRESSION_CONFIG.jpeg.mozjpeg
        })
        .toBuffer()
    } else {
      // Unknown format - use JPEG as fallback
      compressed = await pipeline
        .jpeg({
          quality: COMPRESSION_CONFIG.jpeg.quality,
          progressive: COMPRESSION_CONFIG.jpeg.progressive
        })
        .toBuffer()
    }

    const compressionRatio = compressed.length / originalSize
    const savings = ((1 - compressionRatio) * 100).toFixed(1)

    if (compressionRatio < 0.9) {
      // Only log if we achieved >10% compression
      console.log(
        `  Compressed ${filename}: ${(originalSize / 1024).toFixed(1)} KB → ${(compressed.length / 1024).toFixed(1)} KB (${savings}% reduction)`
      )
    }

    return {
      buffer: compressed,
      originalSize,
      compressedSize: compressed.length
    }
  } catch (error) {
    console.error(`  Failed to compress ${filename}, using original:`, error)
    // If compression fails, return original
    return {
      buffer: fileBuffer,
      originalSize,
      compressedSize: originalSize
    }
  }
}

// GET endpoint - Preview files that would be uploaded
export async function GET(request: NextRequest) {
  try {
    const mediaDir = path.join(process.cwd(), 'anki', 'media')
    
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

// POST endpoint - Perform bulk upload with compression
export async function POST(request: NextRequest) {
  try {
    const mediaDir = path.join(process.cwd(), 'anki', 'media')
    const targetBucket = 'pathology-bites-images'

    console.log(`Starting Anki media upload with compression from ${mediaDir} to ${targetBucket}/anki/`)
    console.log(`Compression settings: max ${COMPRESSION_CONFIG.maxWidth}x${COMPRESSION_CONFIG.maxHeight}, JPEG quality ${COMPRESSION_CONFIG.jpeg.quality}, PNG quality ${COMPRESSION_CONFIG.png.quality}`)

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
        const originalSize = fileBuffer.length
        totalSize += originalSize

        // Progress logging
        if (i % 50 === 0 || i < 20) {
          const elapsed = (Date.now() - startTime) / 1000
          const rate = i > 0 ? i / elapsed : 0
          const eta = rate > 0 ? (mediaFiles.length - i) / rate : 0
          console.log(`\nProcessing ${i + 1}/${mediaFiles.length}: ${filename} (${Math.round(originalSize / 1024)} KB) - ${rate.toFixed(1)} files/sec, ETA: ${Math.round(eta)}s`)
        }

        // Compress image
        const { buffer: compressedBuffer, originalSize: origSize, compressedSize } = await compressImage(
          fileBuffer,
          filename,
          ext
        )

        // Upload compressed file to R2 (replaces existing file with same name)
        const uploadResult = await uploadToR2(compressedBuffer, r2Key, {
          contentType,
          bucket: targetBucket,
          metadata: {
            source: 'anki-media-upload',
            originalFilename: filename,
            originalSize: origSize.toString(),
            compressedSize: compressedSize.toString(),
            compressionRatio: (compressedSize / origSize).toFixed(4),
            uploadedAt: new Date().toISOString()
          }
        })

        const fileCompressionRatio = compressedSize / origSize

        results.push({
          filename,
          success: true,
          url: uploadResult.url,
          size: compressedSize,
          originalSize: origSize,
          compressionRatio: fileCompressionRatio,
          r2Key: r2Key
        })

        uploadedFiles++
        uploadedSize += compressedSize

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

    const overallCompressionRatio = totalSize > 0 ? uploadedSize / totalSize : 1
    const savingsPercent = ((1 - overallCompressionRatio) * 100).toFixed(1)

    const response: BulkUploadResponse = {
      success: uploadedFiles > 0,
      totalFiles: mediaFiles.length,
      uploadedFiles,
      failedFiles: mediaFiles.length - uploadedFiles,
      results,
      errors,
      totalSize,
      uploadedSize,
      compressionRatio: overallCompressionRatio
    }

    const durationSeconds = (Date.now() - startTime) / 1000
    const avgRate = uploadedFiles / durationSeconds

    console.log(`\n✅ Anki media upload completed in ${durationSeconds.toFixed(1)}s:`)
    console.log(`   - Files: ${uploadedFiles}/${mediaFiles.length} uploaded successfully`)
    console.log(`   - Original size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`   - Compressed size: ${(uploadedSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`   - Compression: ${savingsPercent}% size reduction`)
    console.log(`   - Speed: ${avgRate.toFixed(1)} files/sec`)

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