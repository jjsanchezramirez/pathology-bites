// src/app/api/health/route.ts
import { NextResponse } from 'next/server'

// Ultra-aggressive caching for health checks - 30 minutes
// Health check is static and doesn't need frequent updates
const CACHE_DURATION = 1800 // 30 minutes in seconds

export async function GET() {
  const response = NextResponse.json({
    status: 'ok'
    // ✅ Removed timestamp to enable proper caching
  })

  // Set aggressive caching headers
  response.headers.set('Cache-Control', `public, max-age=${CACHE_DURATION}, s-maxage=${CACHE_DURATION}, stale-while-revalidate=600`)
  response.headers.set('CDN-Cache-Control', `public, max-age=${CACHE_DURATION}`)
  response.headers.set('Vercel-CDN-Cache-Control', `public, max-age=${CACHE_DURATION}`)

  return response
}

export async function HEAD() {
  const response = new NextResponse(null, { status: 200 })
  
  // Set same caching for HEAD requests
  response.headers.set('Cache-Control', `public, max-age=${CACHE_DURATION}, s-maxage=${CACHE_DURATION}, stale-while-revalidate=600`)
  response.headers.set('CDN-Cache-Control', `public, max-age=${CACHE_DURATION}`)
  response.headers.set('Vercel-CDN-Cache-Control', `public, max-age=${CACHE_DURATION}`)
  
  return response
}
