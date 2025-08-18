import { NextRequest, NextResponse } from 'next/server'

// Set timeout for AI generation step
export const maxDuration = 15 // 15 seconds timeout for single AI call

// Available models for WSI question generation (ordered by preference)
const WSI_MODELS = [
  'gemini-1.5-flash',
  'llama-3.3-70b-versatile', 
  'mistral-large-latest',
  'llama-3.1-70b-versatile'
]

// Get model provider from model ID
function getModelProvider(modelId: string): string {
  if (modelId.includes('gemini')) return 'google'
  if (modelId.includes('llama')) return 'groq'
  if (modelId.includes('mistral')) return 'mistral'
  return 'unknown'
}

// Get API key for provider
function getApiKey(provider: string): string | null {
  switch (provider) {
    case 'google':
      return process.env.GOOGLE_AI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || null
    case 'groq':
      return process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || null
    case 'mistral':
      return process.env.MISTRAL_API_KEY || process.env.NEXT_PUBLIC_MISTRAL_API_KEY || null
    default:
      return null
  }
}

// Google AI API call with timeout
async function callGoogleAPI(prompt: string, model: string, apiKey: string): Promise<{ content: string; tokenUsage?: any }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12000) // 12 second timeout

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4000
        }
      })
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Google API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const tokenUsage = data.usageMetadata || null

    return { content, tokenUsage }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Google API timeout after 12 seconds')
    }
    throw error
  }
}

// Groq API call with timeout
async function callGroqAPI(prompt: string, model: string, apiKey: string): Promise<{ content: string; tokenUsage?: any }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12000) // 12 second timeout

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4000
      })
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    const tokenUsage = data.usage || null

    return { content, tokenUsage }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Groq API timeout after 12 seconds')
    }
    throw error
  }
}

// Mistral API call with timeout
async function callMistralAPI(prompt: string, model: string, apiKey: string): Promise<{ content: string; tokenUsage?: any }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12000) // 12 second timeout

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4000
      })
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    const tokenUsage = data.usage || null

    return { content, tokenUsage }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Mistral API timeout after 12 seconds')
    }
    throw error
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log('[WSI AI Generate] Starting AI generation request')

    // Parse request body
    const body = await request.json()
    const { prompt, modelIndex = 0 } = body

    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: prompt'
        },
        { status: 400 }
      )
    }

    // Validate modelIndex
    if (modelIndex >= WSI_MODELS.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'All models have been exhausted',
          nextModelIndex: null,
          availableModels: WSI_MODELS.length
        },
        { status: 400 }
      )
    }

    const selectedModel = WSI_MODELS[modelIndex]
    const provider = getModelProvider(selectedModel)
    const apiKey = getApiKey(provider)

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: `No API key found for model: ${selectedModel}`,
          nextModelIndex: modelIndex + 1 < WSI_MODELS.length ? modelIndex + 1 : null,
          nextModel: modelIndex + 1 < WSI_MODELS.length ? WSI_MODELS[modelIndex + 1] : null
        },
        { status: 500 }
      )
    }

    console.log(`[WSI AI Generate] Using model: ${selectedModel} (${provider})`)

    let apiResponse: { content: string; tokenUsage?: any }

    // Call appropriate AI service based on provider
    try {
      switch (provider) {
        case 'groq':
          apiResponse = await callGroqAPI(prompt, selectedModel, apiKey)
          break
        case 'google':
          apiResponse = await callGoogleAPI(prompt, selectedModel, apiKey)
          break
        case 'mistral':
          apiResponse = await callMistralAPI(prompt, selectedModel, apiKey)
          break
        default:
          throw new Error(`Unsupported model provider: ${provider}`)
      }
    } catch (aiError) {
      console.error(`[WSI AI Generate] AI API error with ${selectedModel}:`, aiError)
      
      const hasMoreModels = modelIndex + 1 < WSI_MODELS.length
      const nextModelIndex = hasMoreModels ? modelIndex + 1 : null
      
      return NextResponse.json(
        {
          success: false,
          error: `AI generation failed with ${selectedModel}`,
          details: aiError instanceof Error ? aiError.message : 'Unknown AI error',
          nextModelIndex: nextModelIndex,
          nextModel: hasMoreModels ? WSI_MODELS[nextModelIndex!] : null,
          currentModelIndex: modelIndex,
          availableModels: WSI_MODELS.length
        },
        { status: 500 }
      )
    }

    const generationTime = Date.now() - startTime
    console.log(`[WSI AI Generate] AI generation completed in ${generationTime}ms`)

    if (!apiResponse.content) {
      return NextResponse.json(
        {
          success: false,
          error: 'No content received from AI service',
          nextModelIndex: modelIndex + 1 < WSI_MODELS.length ? modelIndex + 1 : null,
          nextModel: modelIndex + 1 < WSI_MODELS.length ? WSI_MODELS[modelIndex + 1] : null
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      content: apiResponse.content,
      metadata: {
        generated_at: new Date().toISOString(),
        generation_time_ms: generationTime,
        model: selectedModel,
        modelIndex: modelIndex,
        token_usage: apiResponse.tokenUsage,
        response_length: apiResponse.content.length
      }
    })

  } catch (error) {
    console.error('[WSI AI Generate] Unexpected error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate AI content',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
