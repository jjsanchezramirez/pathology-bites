import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Use fetch to get the file from our existing API
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/r2/files?bucket=pathology-bites-data&key=cell-quiz-images.json&download=true`)
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch cell-quiz-images.json' },
        { status: 404 }
      )
    }

    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      data: data
    })

  } catch (error) {
    console.error('Error fetching cell-quiz-images.json:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}