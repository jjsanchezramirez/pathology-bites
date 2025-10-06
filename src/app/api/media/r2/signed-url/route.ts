// src/app/api/media/r2/signed-url/route.ts
/**
 * API route for generating single R2 signed URLs
 * Minimizes Vercel usage by providing direct R2 access
 */

import { NextRequest, NextResponse } from 'next/server'
import { signedUrlApi } from '@/shared/utils/r2-signed-urls'

export async function POST(request: NextRequest) {
  try {
    const { key, options = {} } = await request.json()

    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { error: 'Invalid key parameter' },
        { status: 400 }
      )
    }

    // Generate signed URL
    const result = await signedUrlApi.single(key, options)

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'private, max-age=300', // 5 minutes
        'X-R2-Direct-Access': 'true'
      }
    })

  } catch (error) {
    console.error('Signed URL generation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate signed URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET method for simple key-based requests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const expiresIn = parseInt(searchParams.get('expiresIn') || '3600')

    if (!key) {
      return NextResponse.json(
        { error: 'Missing key parameter' },
        { status: 400 }
      )
    }

    const result = await signedUrlApi.single(key, { expiresIn })

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'private, max-age=300',
        'X-R2-Direct-Access': 'true'
      }
    })

  } catch (error) {
    console.error('Signed URL generation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate signed URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
