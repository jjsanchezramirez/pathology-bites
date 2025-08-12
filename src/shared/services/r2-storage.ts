/**
 * Cloudflare R2 Storage Service
 * 
 * Centralized service for all R2 storage operations, replacing Supabase Storage.
 * Provides S3-compatible API for image upload, deletion, and management.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, HeadObjectCommand, ListObjectsV2Command, CopyObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

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

export interface R2FileListItem {
  key: string
  url: string
  size: number
  lastModified: Date
  contentType?: string
  etag?: string
}

export interface R2ListResult {
  files: R2FileListItem[]
  totalCount: number
  isTruncated: boolean
  nextContinuationToken?: string
  prefix?: string
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
    bucket?: string
  } = {}
): Promise<R2UploadResult> {
  try {
    const config = getR2Config()
    const r2Client = createR2Client()

    const contentType = options.contentType || (file instanceof File ? file.type : 'application/octet-stream')
    const fileBuffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file
    const bucketName = options.bucket || config.CLOUDFLARE_R2_BUCKET_NAME

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      CacheControl: options.cacheControl || '3600',
      Metadata: options.metadata || {}
    })

    await r2Client.send(command)

    // Use custom bucket URL if specified
    const baseUrl = options.bucket ? `https://${options.bucket}.r2.dev` : config.CLOUDFLARE_R2_PUBLIC_URL
    const publicUrl = `${baseUrl}/${key}`

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
export async function deleteFromR2(key: string, bucket?: string): Promise<void> {
  try {
    const config = getR2Config()
    const r2Client = createR2Client()

    const bucketName = bucket || config.CLOUDFLARE_R2_BUCKET_NAME

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key
    })

    await r2Client.send(command)
    console.log(`Successfully deleted ${key} from R2 bucket ${bucketName}`)
  } catch (error) {
    console.error('R2 delete error:', error)
    throw new Error(`Failed to delete from R2: ${error}`)
  }
}

/**
 * Delete multiple files from R2 storage
 */
export async function bulkDeleteFromR2(keys: string[], bucket?: string): Promise<{ deleted: string[], errors: string[] }> {
  const result = { deleted: [] as string[], errors: [] as string[] }

  if (keys.length === 0) return result

  try {
    const config = getR2Config()
    const r2Client = createR2Client()

    const bucketName = bucket || config.CLOUDFLARE_R2_BUCKET_NAME

    // R2 supports bulk delete up to 1000 objects
    const chunks = []
    for (let i = 0; i < keys.length; i += 1000) {
      chunks.push(keys.slice(i, i + 1000))
    }

    for (const chunk of chunks) {
      try {
        const command = new DeleteObjectsCommand({
          Bucket: bucketName,
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
 * Get file content from R2 storage
 */
export async function getFileContent(bucket: string, key: string): Promise<Uint8Array | null> {
  try {
    const r2Client = createR2Client()

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    })

    const response = await r2Client.send(command)
    
    if (!response.Body) {
      return null
    }

    // Convert stream to bytes
    const chunks: any[] = []
    const stream = response.Body as any
    
    // Handle different stream types
    if (stream.transformToByteArray) {
      // AWS SDK v3 stream
      return await stream.transformToByteArray()
    } else if (stream.getReader) {
      // Web Streams API
      const reader = stream.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }
    } else {
      // Node.js stream
      for await (const chunk of stream) {
        chunks.push(chunk)
      }
    }

    // Combine all chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }

    return result
  } catch (error: any) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return null
    }
    console.error('R2 get file content error:', error)
    throw error
  }
}

/**
 * Generate R2 public URL for a given key
 * Returns public URL for public buckets, or indicates private access needed
 */
export function getR2PublicUrl(key: string, bucket?: string): string {
  try {
    const config = getR2Config()
    const bucketName = bucket || config.CLOUDFLARE_R2_BUCKET_NAME

    // Public access buckets
    if (bucketName === 'pathology-bites-images') {
      return `${config.CLOUDFLARE_R2_PUBLIC_URL}/${key}`
    }
  } catch (error) {
    // Fallback for client-side or when env vars are not available
    const bucketName = bucket || 'pathology-bites-images'
    
    // Public access buckets
    if (bucketName === 'pathology-bites-images') {
      const publicUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL || 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev'
      return `${publicUrl}/${key}`
    }
    
    // Anki media bucket uses its own domain
    if (bucketName === 'pathology-bites-anki') {
      return `https://pathology-bites-anki.r2.dev/${key}`
    }

    // For private buckets, return a placeholder that indicates signed URL needed
    return `[PRIVATE:${bucketName}]${key}`
  }
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
 * Generate standardized storage path for images in library folder
 * Format: library/YYYYMMDDHHMMSS-{cleaned-filename}
 */
export function generateImageStoragePath(filename: string, category: string): string {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 19).replace(/[-:T]/g, '').slice(0, 14) // YYYYMMDDHHMMSS (no hyphens)

  // Clean filename with graceful special character handling, preserve extension
  const nameParts = filename.split('.')
  const extension = nameParts.pop()?.toLowerCase() || 'jpg'
  const baseName = nameParts.join('.')
    .toLowerCase()
    .trim()
    // Replace common special characters with meaningful equivalents
    .replace(/&/g, 'and')
    .replace(/\+/g, 'plus')
    .replace(/%/g, 'percent')
    .replace(/@/g, 'at')
    .replace(/\$/g, 'dollar')
    // Replace whitespace and punctuation with single hyphens
    .replace(/[\s\-_]+/g, '-') // Multiple spaces, hyphens, underscores → single hyphen
    .replace(/[^\w\-]/g, '-') // Non-word characters (except existing hyphens) → hyphen
    .replace(/-+/g, '-') // Multiple consecutive hyphens → single hyphen
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens

  // Format: library/YYYYMMDDHHMMSS-{cleaned-name}.{ext}
  return `library/${dateStr}-${baseName}.${extension}`
}

/**
 * List files in R2 storage with pagination support
 */
export async function listR2Files(options: {
  prefix?: string
  maxKeys?: number
  continuationToken?: string
  bucket?: string
} = {}): Promise<R2ListResult> {
  try {
    const config = getR2Config()
    const r2Client = createR2Client()

    // Use provided bucket or default to configured bucket
    const bucketName = options.bucket || config.CLOUDFLARE_R2_BUCKET_NAME

    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: options.prefix,
      MaxKeys: Math.min(options.maxKeys || 1000, 1000), // AWS S3 limit is 1000
      ContinuationToken: options.continuationToken
    })

    const response = await r2Client.send(command)

    const files: R2FileListItem[] = (response.Contents || []).map(object => ({
      key: object.Key || '',
      url: getR2PublicUrl(object.Key || '', bucketName),
      size: object.Size || 0,
      lastModified: object.LastModified || new Date(),
      etag: object.ETag
    }))

    return {
      files,
      totalCount: response.KeyCount || 0,
      isTruncated: response.IsTruncated || false,
      nextContinuationToken: response.NextContinuationToken,
      prefix: options.prefix
    }
  } catch (error) {
    console.error('R2 list files error:', error)
    throw new Error(`Failed to list R2 files: ${error}`)
  }
}

/**
 * Generate storage path for data files
 */
export function generateDataStoragePath(filename: string): string {
  return `data/${filename}`
}

/**
 * Copy an object within R2 storage
 */
export async function copyR2Object(sourceKey: string, destinationKey: string, sourceBucket?: string, destinationBucket?: string): Promise<void> {
  try {
    const config = getR2Config()
    const r2Client = createR2Client()

    const srcBucket = sourceBucket || config.CLOUDFLARE_R2_BUCKET_NAME
    const destBucket = destinationBucket || config.CLOUDFLARE_R2_BUCKET_NAME

    const command = new CopyObjectCommand({
      Bucket: destBucket,
      CopySource: `${srcBucket}/${sourceKey}`,
      Key: destinationKey
    })

    await r2Client.send(command)
    console.log(`Successfully copied ${sourceKey} to ${destinationKey}`)
  } catch (error) {
    console.error('R2 copy error:', error)
    throw new Error(`Failed to copy R2 object: ${error}`)
  }
}

/**
 * Move an object within R2 storage (copy then delete)
 */
export async function moveR2Object(sourceKey: string, destinationKey: string, bucket?: string): Promise<void> {
  try {
    // First copy the object
    await copyR2Object(sourceKey, destinationKey, bucket, bucket)

    // Then delete the original
    await deleteFromR2(sourceKey, bucket)

    console.log(`Successfully moved ${sourceKey} to ${destinationKey}`)
  } catch (error) {
    console.error('R2 move error:', error)
    throw new Error(`Failed to move R2 object: ${error}`)
  }
}

/**
 * Move multiple objects with a common prefix (folder rename)
 */
export async function moveR2Folder(sourcePrefix: string, destinationPrefix: string, bucket?: string): Promise<{ moved: number; errors: string[] }> {
  try {
    const config = getR2Config()
    const bucketName = bucket || config.CLOUDFLARE_R2_BUCKET_NAME

    // List all objects with the source prefix
    const listResult = await listR2Files({
      prefix: sourcePrefix,
      maxKeys: 1000,
      bucket: bucketName
    })

    const results = {
      moved: 0,
      errors: [] as string[]
    }

    // Move each file
    for (const file of listResult.files) {
      try {
        // Calculate new key by replacing the prefix
        const newKey = file.key.replace(sourcePrefix, destinationPrefix)
        await moveR2Object(file.key, newKey, bucketName)
        results.moved++
      } catch (error) {
        const errorMsg = `Failed to move ${file.key}: ${error}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }
    }

    console.log(`Folder move completed: ${results.moved} files moved, ${results.errors.length} errors`)
    return results
  } catch (error) {
    console.error('R2 folder move error:', error)
    throw new Error(`Failed to move R2 folder: ${error}`)
  }
}

export default {
  upload: uploadToR2,
  delete: deleteFromR2,
  bulkDelete: bulkDeleteFromR2,
  getFileInfo: getR2FileInfo,
  getFileContent: getFileContent,
  getPublicUrl: getR2PublicUrl,
  extractKeyFromUrl: extractR2KeyFromUrl,
  listFiles: listR2Files,
  generateImagePath: generateImageStoragePath,
  generateDataPath: generateDataStoragePath,
  copyObject: copyR2Object,
  moveObject: moveR2Object,
  moveFolder: moveR2Folder
}
