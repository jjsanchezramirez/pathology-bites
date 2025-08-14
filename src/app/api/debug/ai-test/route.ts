// src/app/api/debug/ai-test/route.ts
/**
 * AI Testing API - Test different AI models with custom prompts
 * Enhanced to use actual AI model APIs for real testing
 */

import { NextRequest, NextResponse } from 'next/server'
import { getApiKey, getModelProvider, isModelAvailable } from '@/shared/config/ai-models'

// AI Service integrations
async function callGroqAPI(model: string, prompt: string, apiKey: string) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || 'No response generated'
}

async function callGoogleAPI(model: string, prompt: string, apiKey: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      }
    }),
  })

  if (!response.ok) {
    throw new Error(`Google API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated'
}

async function callMistralAPI(model: string, prompt: string, apiKey: string) {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    throw new Error(`Mistral API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || 'No response generated'
}

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

    // Check if model is available
    if (!isModelAvailable(model)) {
      return NextResponse.json(
        { error: `Model ${model} is not available` },
        { status: 400 }
      )
    }

    const startTime = Date.now()
    const provider = getModelProvider(model)
    const apiKey = getApiKey(provider)

    if (!apiKey) {
      return NextResponse.json(
        { error: `No API key configured for provider: ${provider}` },
        { status: 400 }
      )
    }

    let content: string
    const metadata: { provider?: string; [key: string]: unknown } = {}

    try {
      // Call the appropriate AI service based on provider
      switch (provider) {
        case 'llama':
        case 'groq':
          content = await callGroqAPI(model, prompt, apiKey)
          metadata.provider = 'Groq/LLAMA'
          break
        case 'google':
          content = await callGoogleAPI(model, prompt, apiKey)
          metadata.provider = 'Google Gemini'
          break
        case 'mistral':
          content = await callMistralAPI(model, prompt, apiKey)
          metadata.provider = 'Mistral AI'
          break
        default:
          throw new Error(`Unsupported provider: ${provider}`)
      }
    } catch (apiError) {
      console.error(`AI API error for ${provider}:`, apiError)
      return NextResponse.json(
        {
          error: `AI API call failed: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`,
          provider,
          model,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      )
    }

    const endTime = Date.now()

    return NextResponse.json({
      success: true,
      model,
      provider,
      prompt: prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt,
      content,
      responseTime: endTime - startTime,
      timestamp: new Date().toISOString(),
      metadata,
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
