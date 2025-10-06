// src/shared/utils/r2-signed-urls.ts
/**
 * R2 Signed URL generation for private content access
 * Minimizes Vercel API usage by generating direct R2 access URLs
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// R2 configuration
const R2_CONFIG = {
  accountId: process.env.R2_ACCOUNT_ID!,
  accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  bucketName: process.env.R2_BUCKET_NAME!,
}

// Initialize R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_CONFIG.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey,
  },
})

interface SignedUrlOptions {
  expiresIn?: number // Seconds (default: 1 hour)
  responseContentType?: string
  responseContentDisposition?: string
}

/**
 * Generate signed URL for direct R2 access
 * This allows clients to download directly from R2 without going through Vercel
 */
export async function generateSignedUrl(
  key: string,
  options: SignedUrlOptions = {}
): Promise<string> {
  const {
    expiresIn = 3600, // 1 hour default
    responseContentType,
    responseContentDisposition
  } = options

  try {
    const command = new GetObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
      ResponseContentType: responseContentType,
      ResponseContentDisposition: responseContentDisposition,
    })

    const signedUrl = await getSignedUrl(r2Client, command, {
      expiresIn
    })

    return signedUrl
  } catch (error) {
    console.error('Failed to generate signed URL:', error)
    throw new Error(`Failed to generate signed URL for ${key}`)
  }
}

/**
 * Generate multiple signed URLs in batch
 */
export async function generateBatchSignedUrls(
  keys: string[],
  options: SignedUrlOptions = {}
): Promise<Record<string, string>> {
  try {
    const urlPromises = keys.map(async (key) => {
      const url = await generateSignedUrl(key, options)
      return [key, url] as const
    })

    const results = await Promise.all(urlPromises)
    return Object.fromEntries(results)
  } catch (error) {
    console.error('Failed to generate batch signed URLs:', error)
    throw error
  }
}

/**
 * API route helper for generating signed URLs
 * Use this in your API routes to minimize Vercel function usage
 */
export const signedUrlApi = {
  /**
   * Generate signed URL for single file
   */
  async single(key: string, options: SignedUrlOptions = {}) {
    return {
      url: await generateSignedUrl(key, options),
      expiresAt: new Date(Date.now() + (options.expiresIn || 3600) * 1000).toISOString()
    }
  },

  /**
   * Generate signed URLs for multiple files
   */
  async batch(keys: string[], options: SignedUrlOptions = {}) {
    const urls = await generateBatchSignedUrls(keys, options)
    const expiresAt = new Date(Date.now() + (options.expiresIn || 3600) * 1000).toISOString()
    
    return {
      urls,
      expiresAt,
      count: keys.length
    }
  },

  /**
   * Generate signed URL for image with optimization parameters
   */
  async image(key: string, options: {
    width?: number
    height?: number
    quality?: number
    format?: 'webp' | 'avif' | 'jpeg' | 'png'
    expiresIn?: number
  } = {}) {
    const { width, height, quality, format, expiresIn = 3600 } = options
    
    // For images, we can use Cloudflare Image Resizing with signed URLs
    let contentType = 'image/jpeg'
    if (format === 'webp') contentType = 'image/webp'
    else if (format === 'avif') contentType = 'image/avif'
    else if (format === 'png') contentType = 'image/png'

    const signedUrl = await generateSignedUrl(key, {
      expiresIn,
      responseContentType: contentType
    })

    // Add Cloudflare Image Resizing parameters if specified
    if (width || height || quality || format) {
      const url = new URL(signedUrl)
      if (width) url.searchParams.set('width', width.toString())
      if (height) url.searchParams.set('height', height.toString())
      if (quality) url.searchParams.set('quality', quality.toString())
      if (format) url.searchParams.set('format', format)
      
      return {
        url: url.toString(),
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
        optimized: true
      }
    }

    return {
      url: signedUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      optimized: false
    }
  }
}

/**
 * Client-side signed URL cache
 * Prevents regenerating URLs that haven't expired
 */
class SignedUrlCache {
  private cache = new Map<string, { url: string; expiresAt: number }>()

  set(key: string, url: string, expiresIn: number) {
    this.cache.set(key, {
      url,
      expiresAt: Date.now() + (expiresIn * 1000) - 60000 // 1 minute buffer
    })
  }

  get(key: string): string | null {
    const cached = this.cache.get(key)
    if (!cached) return null
    
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key)
      return null
    }
    
    return cached.url
  }

  clear() {
    this.cache.clear()
  }
}

export const signedUrlCache = new SignedUrlCache()

/**
 * Client-side helper for requesting signed URLs
 */
export const clientSignedUrls = {
  /**
   * Get signed URL with caching
   */
  async get(key: string, options: SignedUrlOptions = {}): Promise<string> {
    // Check cache first
    const cached = signedUrlCache.get(key)
    if (cached) return cached

    // Request new signed URL from your API
    const response = await fetch('/api/media/r2/signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, options })
    })

    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.statusText}`)
    }

    const { url, expiresAt } = await response.json()
    const expiresIn = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
    
    // Cache the URL
    signedUrlCache.set(key, url, expiresIn)
    
    return url
  },

  /**
   * Get multiple signed URLs with caching
   */
  async getBatch(keys: string[], options: SignedUrlOptions = {}): Promise<Record<string, string>> {
    // Check cache for each key
    const cached: Record<string, string> = {}
    const uncached: string[] = []

    for (const key of keys) {
      const cachedUrl = signedUrlCache.get(key)
      if (cachedUrl) {
        cached[key] = cachedUrl
      } else {
        uncached.push(key)
      }
    }

    // Request uncached URLs
    if (uncached.length > 0) {
      const response = await fetch('/api/media/r2/signed-urls/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: uncached, options })
      })

      if (!response.ok) {
        throw new Error(`Failed to get batch signed URLs: ${response.statusText}`)
      }

      const { urls, expiresAt } = await response.json()
      const expiresIn = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)

      // Cache the new URLs
      for (const [key, url] of Object.entries(urls)) {
        signedUrlCache.set(key, url as string, expiresIn)
        cached[key] = url as string
      }
    }

    return cached
  }
}
