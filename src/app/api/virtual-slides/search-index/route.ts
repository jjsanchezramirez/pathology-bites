/**
 * Static search index endpoint
 * Serves the lightweight search index with aggressive caching
 * This replaces the need to load the full 24MB dataset for search operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Serving virtual slides search index...')
    
    // Read the pre-generated search index
    const indexPath = path.join(process.cwd(), 'public', 'data', 'virtual-slides-index.json')
    
    try {
      const indexData = await fs.readFile(indexPath, 'utf8')
      const parsedIndex = JSON.parse(indexData)
      
      console.log(`✅ Search index served: ${parsedIndex.length} slides, ${(indexData.length / 1024).toFixed(2)} KB`)
      
      return new NextResponse(indexData, {
        headers: {
          'Content-Type': 'application/json',
          // Aggressive caching - search index changes infrequently
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800', // 24h cache, 7d stale
          'CDN-Cache-Control': 'public, max-age=86400',
          'Vercel-CDN-Cache-Control': 'public, max-age=86400',
          // Enable compression
          'Vary': 'Accept-Encoding'
        }
      })
      
    } catch (fileError) {
      console.error('❌ Search index file not found:', fileError)
      
      return NextResponse.json({
        error: 'Search index not found',
        message: 'Please run: node scripts/generate-search-index.js',
        details: 'The search index needs to be generated from virtual-slides.json'
      }, { 
        status: 404,
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
    }
    
  } catch (error) {
    console.error('❌ Search index API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to serve search index',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// HEAD request for cache validation
export async function HEAD(request: NextRequest) {
  try {
    const indexPath = path.join(process.cwd(), 'public', 'data', 'virtual-slides-index.json')
    const stats = await fs.stat(indexPath)
    
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': stats.size.toString(),
        'Last-Modified': stats.mtime.toUTCString(),
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        'CDN-Cache-Control': 'public, max-age=86400',
        'Vercel-CDN-Cache-Control': 'public, max-age=86400'
      }
    })
    
  } catch (error) {
    return new NextResponse(null, { status: 404 })
  }
}
