import { NextRequest, NextResponse } from 'next/server'
import { createOptimizedResponse } from '@/shared/utils/compression'

// Base R2 URL for educational content context files
const CONTENT_CONTEXT_R2_BASE = 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/pathology-bites-data/context'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filename = searchParams.get('file')

    if (!filename) {
      return NextResponse.json(
        { error: 'File parameter is required' },
        { status: 400 }
      )
    }

    // Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      )
    }

    // Ensure it's a JSON file
    if (!filename.endsWith('.json')) {
      return NextResponse.json(
        { error: 'Only JSON files are supported' },
        { status: 400 }
      )
    }

    // Construct R2 URL for the context file
    const contextFileUrl = `${CONTENT_CONTEXT_R2_BASE}/${filename}`

    // Fetch from R2 instead of local file system
    const response = await fetch(contextFileUrl, {
      headers: {
        'Cache-Control': 'public, max-age=3600' // 1 hour cache
      }
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        )
      }
      throw new Error(`Failed to fetch context file: ${response.status}`)
    }

    const jsonData = await response.json()

    // Return with compression for context data
    return createOptimizedResponse(jsonData, {
      compress: true,
      cache: {
        maxAge: 3600, // 1 hour
        staleWhileRevalidate: 600, // 10 minutes
        public: false // Debug/context data should not be public
      }
    })

  } catch (error) {
    console.error('Error loading educational content context:', error)
    return NextResponse.json(
      { error: 'Failed to load educational content context' },
      { status: 500 }
    )
  }
}