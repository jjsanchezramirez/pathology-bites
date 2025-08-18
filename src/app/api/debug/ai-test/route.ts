// src/app/api/debug/ai-test/route.ts
/**
 * AI Testing API - Test different AI models with custom prompts
 * Enhanced to use actual AI model APIs for real testing
 */

import { NextRequest, NextResponse } from 'next/server'
import { getApiKey, getModelProvider, isModelAvailable } from '@/shared/config/ai-models'

// Token counting utility
function estimateTokenCount(text: string): number {
  // Rough estimation: ~4 characters per token for most models
  return Math.ceil(text.length / 4)
}

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
  const content = data.choices[0]?.message?.content || 'No response generated'
  const tokenCount = data.usage?.total_tokens || estimateTokenCount(content)
  
  return { content, tokenCount, usage: data.usage }
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
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated'
  const tokenCount = data.usageMetadata?.totalTokenCount || estimateTokenCount(content)
  
  return { content, tokenCount, usage: data.usageMetadata }
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
  const content = data.choices[0]?.message?.content || 'No response generated'
  const tokenCount = data.usage?.total_tokens || estimateTokenCount(content)
  
  return { content, tokenCount, usage: data.usage }
}

// Meta (LLAMA) API integration using official Meta developer API
async function callMetaAPI(model: string, prompt: string, apiKey: string) {
  const response = await fetch('https://api.llama.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant specialized in pathology and medical education. Create detailed pathology questions following the ABP format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 1024,
      temperature: 0.1,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "PathologyResponse",
          schema: {
            properties: {
              response: {
                type: "object",
                properties: {
                  content: {
                    type: "string", 
                    description: "The response content"
                  }
                },
                required: ["content"]
              }
            },
            required: ["response"],
            type: "object"
          }
        }
      }
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = `Meta LLAMA API error: ${response.status} ${response.statusText}`
    
    // Parse specific Meta API errors
    try {
      const errorData = JSON.parse(errorText)
      if (errorData.error?.message) {
        errorMessage = errorData.error.message
      }
    } catch {
      // Use default error message if JSON parsing fails
    }
    
    throw new Error(errorMessage)
  }

  const data = await response.json()
  
  // Handle Meta LLAMA API response format
  let content = 'No response generated'
  
  if (data.completion_message?.content?.text) {
    // Direct text response
    content = data.completion_message.content.text
  } else if (data.choices?.[0]?.message?.content) {
    // OpenAI-compatible format
    try {
      const parsed = JSON.parse(data.choices[0].message.content)
      content = parsed.response?.content || data.choices[0].message.content
    } catch {
      content = data.choices[0].message.content
    }
  }
  
  const tokenCount = data.usage?.total_tokens || estimateTokenCount(content)
  
  return { content, tokenCount, usage: data.usage }
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

    let result: { content: string; tokenCount?: number; usage?: any }
    const metadata: { provider?: string; [key: string]: unknown } = {}

    try {
      // Call the appropriate AI service based on provider
      switch (provider) {
        case 'llama':
          // Use Meta's direct API for LLAMA models ONLY
          result = await callMetaAPI(model, prompt, apiKey)
          metadata.provider = 'Meta LLAMA (Direct API)'
          break
        case 'groq':
          result = await callGroqAPI(model, prompt, apiKey)
          metadata.provider = 'Groq'
          break
        case 'google':
          result = await callGoogleAPI(model, prompt, apiKey)
          metadata.provider = 'Google Gemini'
          break
        case 'mistral':
          result = await callMistralAPI(model, prompt, apiKey)
          metadata.provider = 'Mistral AI'
          break
        default:
          throw new Error(`Unsupported provider: ${provider}`)
      }
    } catch (apiError) {
      console.error(`AI API error for ${provider}:`, apiError)
      
      // Enhanced error handling with specific error types
      let errorType = 'unknown'
      let statusCode = 500
      let errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error'
      
      if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('unauthorized')) {
        errorType = 'unauthorized'
        statusCode = 401
      } else if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
        errorType = 'rate_limit'
        statusCode = 429
      } else if (errorMessage.includes('402') || errorMessage.toLowerCase().includes('quota')) {
        errorType = 'quota_exceeded'
        statusCode = 402
      } else if (errorMessage.includes('403') || errorMessage.toLowerCase().includes('forbidden')) {
        errorType = 'forbidden'
        statusCode = 403
      } else if (errorMessage.toLowerCase().includes('timeout')) {
        errorType = 'timeout'
        statusCode = 408
      }
      
      return NextResponse.json(
        {
          error: `AI API call failed: ${errorMessage}`,
          errorType,
          provider,
          model,
          timestamp: new Date().toISOString(),
        },
        { status: statusCode }
      )
    }

    const endTime = Date.now()

    return NextResponse.json({
      success: true,
      model,
      provider,
      prompt: prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt,
      content: result.content,
      tokenCount: result.tokenCount,
      usage: result.usage,
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
