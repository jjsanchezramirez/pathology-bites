// src/shared/utils/dev-cache-disable.ts
import { NextResponse } from 'next/server'

/**
 * Utility to disable caching in development mode
 * In production, this function has no effect
 */
export function addDevCacheHeaders(response: NextResponse): NextResponse {
  if (process.env.NODE_ENV === 'development') {
    const timestamp = Date.now().toString()
    
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate, private')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('Surrogate-Control', 'no-store')
    response.headers.set('Vary', '*')
    response.headers.set('Last-Modified', new Date().toUTCString())
    response.headers.set('ETag', `"dev-${timestamp}"`)
    response.headers.set('X-Development-Cache-Disabled', 'true')
    response.headers.set('X-Development-Timestamp', timestamp)
    response.headers.set('X-Development-No-Cache', timestamp)
  }
  
  return response
}

/**
 * Create a NextResponse with development-friendly cache headers
 */
export function createDevFriendlyResponse(data: any, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(data, init)
  return addDevCacheHeaders(response)
}

/**
 * Wrapper to disable caching in development for API route handlers
 */
export function withDevCacheDisabled<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    const response = await handler(...args)
    return addDevCacheHeaders(response)
  }
}