// src/app/api/debug/clear-build-cache/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'

export async function POST(request: NextRequest) {
  try {
    // Clear specific page cache
    revalidatePath('/tools/wsi-question-generator')
    revalidatePath('/')
    
    // Clear any tagged caches
    revalidateTag('wsi-questions')
    revalidateTag('public-pages')
    
    return NextResponse.json({
      success: true,
      message: 'Build cache cleared successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error clearing build cache:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to clear build cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}