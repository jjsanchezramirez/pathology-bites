// src/app/api/health/route.ts
import { NextResponse } from 'next/server'

// Cache the response for 5 minutes to reduce function invocations
const CACHE_DURATION = 300 // 5 minutes in seconds

export async function GET() {
  const response = NextResponse.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    cached: true 
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
