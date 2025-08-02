/**
 * Cloudflare R2 Storage Service
 * 
 * Centralized service for all R2 storage operations, replacing Supabase Storage.
 * Provides S3-compatible API for image upload, deletion, and management.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

// R2 Configuration - Load dynamically to support scripts
function getR2Config() {
  const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
  const CLOUDFLARE_R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  const CLOUDFLARE_R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  const CLOUDFLARE_R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'pathology-bites-images'
  const CLOUDFLARE_R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL || (CLOUDFLARE_ACCOUNT_ID ? `https://pub-${CLOUDFLARE_ACCOUNT_ID}.r2.dev` : '')

  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_R2_ACCESS_KEY_ID || !CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
    throw new Error('Missing required Cloudflare R2 environment variables. Please check CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, and CLOUDFLARE_R2_SECRET_ACCESS_KEY.')
  }

  return {
    CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_R2_ACCESS_KEY_ID,
    CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    CLOUDFLARE_R2_BUCKET_NAME,
    CLOUDFLARE_R2_PUBLIC_URL
  }
}

// Create R2 client dynamically
function createR2Client() {
  const config = getR2Config()

  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: config.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: false,
  })
}

export interface R2UploadResult {
  url: string
  key: string
  size: number
  contentType: string
}

export interface R2FileInfo {
  size: number
  lastModified: Date
  contentType: string
  exists: boolean
}

/**
 * Upload file to R2 storage
 */
export async function uploadToR2(
  file: File | Buffer,
  key: string,
  options: {
    contentType?: string
    metadata?: Record<string, string>
    cacheControl?: string
  } = {}
): Promise<R2UploadResult> {
  try {
    const config = getR2Config()
    const r2Client = createR2Client()

    const contentType = options.contentType || (file instanceof File ? file.type : 'application/octet-stream')
    const fileBuffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file

    const command = new PutObjectCommand({
      Bucket: config.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      CacheControl: options.cacheControl || '3600',
      Metadata: options.metadata || {}
    })

    await r2Client.send(command)

    const publicUrl = `${config.CLOUDFLARE_R2_PUBLIC_URL}/${key}`

    return {
      url: publicUrl,
      key,
      size: fileBuffer.length,
      contentType
    }
  } catch (error) {
    console.error('R2 upload error:', error)
    throw new Error(`Failed to upload to R2: ${error}`)
  }
}

/**
 * Delete single file from R2 storage
 */
export async function deleteFromR2(key: string): Promise<void> {
  try {
    const config = getR2Config()
    const r2Client = createR2Client()

    const command = new DeleteObjectCommand({
      Bucket: config.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key
    })

    await r2Client.send(command)
  } catch (error) {
    console.error('R2 delete error:', error)
    throw new Error(`Failed to delete from R2: ${error}`)
  }
}

/**
 * Delete multiple files from R2 storage
 */
export async function bulkDeleteFromR2(keys: string[]): Promise<{ deleted: string[], errors: string[] }> {
  const result = { deleted: [] as string[], errors: [] as string[] }

  if (keys.length === 0) return result

  try {
    const config = getR2Config()
    const r2Client = createR2Client()

    // R2 supports bulk delete up to 1000 objects
    const chunks = []
    for (let i = 0; i < keys.length; i += 1000) {
      chunks.push(keys.slice(i, i + 1000))
    }

    for (const chunk of chunks) {
      try {
        const command = new DeleteObjectsCommand({
          Bucket: config.CLOUDFLARE_R2_BUCKET_NAME,
          Delete: {
            Objects: chunk.map(key => ({ Key: key }))
          }
        })

        const response = await r2Client.send(command)
        
        // Track successful deletions
        response.Deleted?.forEach(deleted => {
          if (deleted.Key) result.deleted.push(deleted.Key)
        })

        // Track errors
        response.Errors?.forEach(error => {
          result.errors.push(`${error.Key}: ${error.Message}`)
        })
      } catch (error) {
        chunk.forEach(key => {
          result.errors.push(`${key}: ${error}`)
        })
      }
    }
  } catch (error) {
    console.error('R2 bulk delete error:', error)
    keys.forEach(key => {
      result.errors.push(`${key}: ${error}`)
    })
  }

  return result
}

/**
 * Get file information from R2 storage
 */
export async function getR2FileInfo(key: string): Promise<R2FileInfo | null> {
  try {
    const config = getR2Config()
    const r2Client = createR2Client()

    const command = new HeadObjectCommand({
      Bucket: config.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key
    })

    const response = await r2Client.send(command)

    return {
      size: response.ContentLength || 0,
      lastModified: response.LastModified || new Date(),
      contentType: response.ContentType || 'application/octet-stream',
      exists: true
    }
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return {
        size: 0,
        lastModified: new Date(),
        contentType: 'application/octet-stream',
        exists: false
      }
    }
    console.error('R2 file info error:', error)
    return null
  }
}

/**
 * Generate R2 public URL for a given key
 */
export function getR2PublicUrl(key: string): string {
  const config = getR2Config()
  return `${config.CLOUDFLARE_R2_PUBLIC_URL}/${key}`
}

/**
 * Extract R2 key from public URL
 */
export function extractR2KeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    if (urlObj.hostname.includes('r2.dev') || urlObj.hostname.includes('r2.cloudflarestorage.com')) {
      return urlObj.pathname.substring(1) // Remove leading slash
    }
    return null
  } catch {
    return null
  }
}

/**
 * Generate storage path for images (maintains compatibility with existing structure)
 */
export function generateImageStoragePath(filename: string, category: string): string {
  const timestamp = Date.now()
  const cleanName = filename.toLowerCase().replace(/[^a-z0-9.-]/g, '-')
  return `images/${category}/${timestamp}-${cleanName}`
}

/**
 * Generate storage path for data files
 */
export function generateDataStoragePath(filename: string): string {
  return `data/${filename}`
}

export default {
  upload: uploadToR2,
  delete: deleteFromR2,
  bulkDelete: bulkDeleteFromR2,
  getFileInfo: getR2FileInfo,
  getPublicUrl: getR2PublicUrl,
  extractKeyFromUrl: extractR2KeyFromUrl,
  generateImagePath: generateImageStoragePath,
  generateDataPath: generateDataStoragePath
}
