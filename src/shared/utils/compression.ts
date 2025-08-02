// src/shared/utils/compression.ts
/**
 * Utility functions for API response compression and optimization
 */

import { NextResponse } from 'next/server'
import { gzip } from 'zlib'
import { promisify } from 'util'

const gzipAsync = promisify(gzip)

interface CompressionOptions {
  compress?: boolean
  cache?: {
    maxAge?: number
    staleWhileRevalidate?: number
    public?: boolean
  }
}

/**
 * Create an optimized API response with compression and caching
 */
export async function createOptimizedResponse(
  data: any,
  options: CompressionOptions = {}
): Promise<NextResponse> {
  const {
    compress = true,
    cache = {
      maxAge: 3600, // 1 hour default
      staleWhileRevalidate: 300, // 5 minutes
      public: true
    }
  } = options

  // Serialize data
  const jsonString = JSON.stringify(data)
  
  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // Add cache headers
  if (cache) {
    const cacheControl = [
      cache.public ? 'public' : 'private',
      `max-age=${cache.maxAge}`,
      cache.staleWhileRevalidate ? `stale-while-revalidate=${cache.staleWhileRevalidate}` : null
    ].filter(Boolean).join(', ')
    
    headers['Cache-Control'] = cacheControl
  }

  // Apply compression if enabled and data is large enough
  if (compress && jsonString.length > 1024) {
    try {
      const compressed = await gzipAsync(jsonString)
      headers['Content-Encoding'] = 'gzip'
      headers['Content-Length'] = compressed.length.toString()
      
      return new NextResponse(compressed, {
        status: 200,
        headers
      })
    } catch (error) {
      console.warn('Compression failed, serving uncompressed:', error)
    }
  }

  // Fallback to uncompressed response
  return NextResponse.json(data, {
    status: 200,
    headers
  })
}

/**
 * Calculate compression ratio for monitoring
 */
export function calculateCompressionRatio(original: string, compressed: Buffer): number {
  return Math.round((1 - compressed.length / original.length) * 100)
}

/**
 * Check if request accepts gzip compression
 */
export function acceptsGzip(request: Request): boolean {
  const acceptEncoding = request.headers.get('accept-encoding') || ''
  return acceptEncoding.includes('gzip')
}
