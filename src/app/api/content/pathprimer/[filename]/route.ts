import { NextRequest, NextResponse } from 'next/server'
import { createOptimizedResponse } from '@/shared/utils/compression'

// Base R2 URL for PathPrimer data files
const PATHPRIMER_R2_BASE = 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/pathology-bites-data/pathprimer'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    // Validate filename to prevent directory traversal
    if (!filename || filename.includes('..') || !filename.endsWith('.json')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      )
    }

    // Construct R2 URL for the PathPrimer file
    const pathprimerFileUrl = `${PATHPRIMER_R2_BASE}/${filename}`

    // Fetch from R2 instead of local file system
    const response = await fetch(pathprimerFileUrl, {
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
      throw new Error(`Failed to fetch PathPrimer file: ${response.status}`)
    }

    const data = await response.json()

    // Return with compression for PathPrimer data
    return createOptimizedResponse(data, {
      compress: true,
      cache: {
        maxAge: 3600, // 1 hour
        staleWhileRevalidate: 600, // 10 minutes
        public: true
      }
    })

  } catch (error) {
    console.error('Error reading PathPrimer file:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
