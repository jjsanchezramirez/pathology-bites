// src/app/api/debug/batch-model-test/route.ts
/**
 * Unified API endpoint for batch AI model testing
 * Handles multiple models simultaneously with proper error handling and rate limiting
 */

import { NextRequest, NextResponse } from 'next/server'
import { getModelProvider } from '@/shared/config/ai-models'

interface BatchTestRequest {
  models: string[]
  prompt: string
  instructions?: string
  educationalContext?: string
}

interface ModelTestResult {
  modelId: string
  status: 'success' | 'error'
  response?: string
  responseTime: number
  tokenUsage?: {
    input?: number
    output?: number
    total?: number
  }
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: BatchTestRequest = await request.json()
    const { models, prompt, instructions, educationalContext } = body

    // Validate required fields
    if (!models || !Array.isArray(models) || models.length === 0) {
      return NextResponse.json(
        { error: { message: 'Models array is required and must not be empty' } },
        { status: 400 }
      )
    }

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: { message: 'Prompt is required' } },
        { status: 400 }
      )
    }

    // Limit batch size to prevent abuse
    if (models.length > 10) {
      return NextResponse.json(
        { error: { message: 'Maximum 10 models allowed per batch request' } },
        { status: 400 }
      )
    }

    const results: ModelTestResult[] = []

    // Test each model
    for (const modelId of models) {
      const startTime = Date.now()
      
      try {
        const provider = getModelProvider(modelId)
        const result = await testSingleModel(modelId, provider, prompt, instructions, educationalContext)
        
        results.push({
          modelId,
          status: 'success',
          response: result.text,
          responseTime: Date.now() - startTime,
          tokenUsage: result.tokenUsage
        })
      } catch (error) {
        results.push({
          modelId,
          status: 'error',
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      results,
      totalModels: models.length,
      successCount: results.filter(r => r.status === 'success').length,
      errorCount: results.filter(r => r.status === 'error').length
    })

  } catch (error) {
    console.error('Batch model test error:', error)
    return NextResponse.json(
      { 
        error: { 
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error
        } 
      },
      { status: 500 }
    )
  }
}

async function testSingleModel(
  modelId: string, 
  provider: string, 
  prompt: string, 
  instructions?: string, 
  educationalContext?: string
) {
  // Get API key from environment
  const apiKeys = {
    llama: process.env.NEXT_PUBLIC_LLAMA_API_KEY || '',
    gemini: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '',
    claude: process.env.NEXT_PUBLIC_CLAUDE_API_KEY || '',
    chatgpt: process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
    mistral: process.env.NEXT_PUBLIC_MISTRAL_API_KEY || '',
    deepseek: process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || ''
  }

  const apiKey = apiKeys[provider as keyof typeof apiKeys]
  
  if (!apiKey) {
    throw new Error(`No API key configured for ${provider}`)
  }

  // Call the appropriate provider-specific endpoint
  const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/debug/${provider}-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      model: modelId,
      prompt,
      instructions: instructions || 'Provide a clear, concise response.',
      educationalContext: educationalContext || undefined
    })
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error.message || 'API error')
  }

  // Extract response text based on provider
  let responseText = ''
  let tokenUsage = undefined

  // Helper function to safely convert response to string
  const safeStringify = (content: any): string => {
    if (typeof content === 'string') {
      return content
    }
    if (typeof content === 'object' && content !== null) {
      // Handle structured responses that might have {type, thinking} format
      if (content.type && content.thinking) {
        return content.thinking || content.type || JSON.stringify(content)
      }
      // Handle other structured responses
      if (content.text) {
        return content.text
      }
      if (content.content) {
        return typeof content.content === 'string' ? content.content : JSON.stringify(content.content)
      }
      // Fallback to JSON string representation
      return JSON.stringify(content)
    }
    // Convert other types to string
    return String(content || '')
  }

  if (provider === 'gemini' && data.candidates?.[0]?.content?.parts?.[0]?.text) {
    responseText = safeStringify(data.candidates[0].content.parts[0].text)
    // Handle Gemini's token usage format - check enhanced usage first, then original usageMetadata
    if (data.usage) {
      // Enhanced format from gemini-test API
      tokenUsage = {
        input: data.usage.prompt_tokens || 0,
        output: data.usage.completion_tokens || 0,
        total: data.usage.total_tokens || 0
      }
    } else if (data.usageMetadata) {
      // Original Gemini API format
      tokenUsage = {
        input: data.usageMetadata.promptTokenCount || 0,
        output: data.usageMetadata.candidatesTokenCount || 0,
        total: data.usageMetadata.totalTokenCount ||
              (data.usageMetadata.promptTokenCount || 0) +
              (data.usageMetadata.candidatesTokenCount || 0)
      }
    } else {
      // Fallback if no usage data available
      tokenUsage = {
        input: 0,
        output: 0,
        total: 0
      }
    }
  } else if (['claude', 'chatgpt', 'mistral', 'deepseek', 'llama'].includes(provider) && data.choices?.[0]?.message?.content) {
    responseText = safeStringify(data.choices[0].message.content)
    // Normalize token usage format
    tokenUsage = data.usage ? {
      input: data.usage.prompt_tokens || data.usage.input_tokens,
      output: data.usage.completion_tokens || data.usage.output_tokens,
      total: data.usage.total_tokens
    } : undefined
  } else {
    throw new Error('Unexpected response format')
  }

  return { text: responseText, tokenUsage }
}

