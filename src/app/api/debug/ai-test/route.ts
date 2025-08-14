// src/app/api/debug/ai-test/route.ts
/**
 * AI Testing API - Test different AI models with custom prompts
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // Block in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  try {
    const { model, prompt } = await request.json()

    if (!model || !prompt) {
      return NextResponse.json(
        { error: 'Model and prompt are required' },
        { status: 400 }
      )
    }

    // Test the AI model (placeholder implementation)
    const startTime = Date.now()
    const response = `This is a test response for model ${model} with prompt: "${prompt.substring(0, 50)}..."`
    const endTime = Date.now()

    return NextResponse.json({
      success: true,
      model,
      prompt,
      content: response,
      responseTime: endTime - startTime,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('AI test error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
