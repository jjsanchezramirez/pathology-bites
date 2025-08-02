// src/app/api/tools/cell-quiz/references/route.ts
/**
 * API endpoint for cell quiz references data
 * Serves data from R2 with compression and caching
 */

import { NextResponse } from 'next/server'
import { createOptimizedResponse } from '@/shared/utils/compression'

// R2 URL for cell quiz references data
const CELL_QUIZ_REFERENCES_R2_URL = 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/pathology-bites-data/cell-quiz-references.json'

export async function GET() {
  try {
    // Fetch from R2 instead of local file system
    const response = await fetch(CELL_QUIZ_REFERENCES_R2_URL, {
      headers: {
        'Cache-Control': 'public, max-age=3600' // 1 hour cache
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch cell quiz references: ${response.status}`)
    }

    const data = await response.json()
    
    // Return with compression and caching
    return createOptimizedResponse(data, {
      compress: true,
      cache: {
        maxAge: 3600, // 1 hour
        staleWhileRevalidate: 300, // 5 minutes
        public: true
      }
    })
    
  } catch (error) {
    console.error('Error loading cell quiz references:', error)
    
    return NextResponse.json(
      { error: 'Failed to load cell quiz references' },
      { status: 500 }
    )
  }
}
