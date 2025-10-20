// src/shared/utils/compression.ts
/**
 * Utility functions for API response compression and optimization
 */

import { NextResponse } from 'next/server'
// REMOVED: gzip imports - using Next.js built-in Brotli/gzip compression instead

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
 * IMPORTANT: Disable manual compression to avoid conflicts with Next.js built-in compression
 */
export async function createOptimizedResponse(
  data: any,
  options: CompressionOptions = {}
): Promise<NextResponse> {
  const {
    cache = {
      maxAge: 3600, // 1 hour default
      staleWhileRevalidate: 300, // 5 minutes
      public: true
    }
  } = options

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

  // REMOVED: Manual compression to avoid ERR_CONTENT_DECODING_FAILED
  // Next.js automatically handles compression when appropriate
  
  // Always return JSON response - let Next.js handle compression
  return NextResponse.json(data, {
    status: 200,
    headers
  })
}

/**
 * Calculate compression ratio for monitoring (kept for potential future use)
 */
export function calculateCompressionRatio(original: string, compressed: Buffer): number {
  return Math.round((1 - compressed.length / original.length) * 100)
}

/**
 * Check if request accepts Brotli or gzip compression
 * Next.js automatically handles this, but kept for compatibility
 */
export function acceptsCompression(request: Request): boolean {
  const acceptEncoding = request.headers.get('accept-encoding') || ''
  return acceptEncoding.includes('brotli') || acceptEncoding.includes('gzip')
}

