import { NextRequest, NextResponse } from 'next/server'
import { getApiKey, getModelProvider } from '@/shared/config/ai-models'

// Simple AI API test functions
async function callMetaAPI(prompt: string, model: string, apiKey: string): Promise<{ content: string; tokenUsage?: any }> {
  console.log(`[AI Test] Calling Meta API with model: ${model}`)
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

  let response: Response
  try {
    response = await fetch('https://api.llama.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: 1000,
        temperature: 0.7
      })
    })
    clearTimeout(timeoutId)
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Meta LLAMA API timeout after 15 seconds')
    }
    throw error
  }

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[AI Test] Meta API Error Response: ${errorText}`)
    throw new Error(`Meta LLAMA API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  console.log(`[AI Test] Meta API Response keys:`, Object.keys(data))
  
  // Handle different response formats
  let content = ''
  if (data.completion_message?.content?.text) {
    content = data.completion_message.content.text
  } else if (data.choices?.[0]?.message?.content) {
    content = data.choices[0].message.content
  }

  return { content: content || '', tokenUsage: data.usage || null }
}

async function callGoogleAPI(prompt: string, model: string, apiKey: string): Promise<{ content: string; tokenUsage?: any }> {
  console.log(`[AI Test] Calling Google API with model: ${model}`)
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  console.log(`[AI Test] Google API URL: ${url.replace(apiKey, 'REDACTED')}`)
  
  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000
    }
  }
  console.log(`[AI Test] Google API Request body:`, JSON.stringify(requestBody, null, 2))
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  })

  console.log(`[AI Test] Google API Response status: ${response.status} ${response.statusText}`)

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[AI Test] Google API Error Response: ${errorText}`)
    throw new Error(`Google API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  console.log(`[AI Test] Google API Response keys:`, Object.keys(data))
  console.log(`[AI Test] Google API Full Response:`, JSON.stringify(data, null, 2))
  
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    tokenUsage: data.usageMetadata || null
  }
}

async function callMistralAPI(prompt: string, model: string, apiKey: string): Promise<{ content: string; tokenUsage?: any }> {
  console.log(`[AI Test] Calling Mistral API with model: ${model}`)
  
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1000
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[AI Test] Mistral API Error Response: ${errorText}`)
    throw new Error(`Mistral API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  console.log(`[AI Test] Mistral API Response keys:`, Object.keys(data))
  
  return {
    content: data.choices[0]?.message?.content || '',
    tokenUsage: data.usage || null
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[AI Test] Starting AI test request')
    
    const { model, prompt } = await request.json()

    if (!model || !prompt) {
      return NextResponse.json(
        { error: 'Model and prompt are required' },
        { status: 400 }
      )
    }

    console.log(`[AI Test] Testing model: ${model} with prompt: "${prompt.substring(0, 100)}..."`)

    // Get provider and API key
    const provider = getModelProvider(model)
    const apiKey = getApiKey(provider)
    
    console.log(`[AI Test] Provider: ${provider}, API Key exists: ${!!apiKey}`)

    if (!apiKey) {
      return NextResponse.json(
        { error: `No API key found for provider: ${provider}` },
        { status: 500 }
      )
    }

    // Call the appropriate AI service
    let response: { content: string; tokenUsage?: any }
    const startTime = Date.now()

    try {
      switch (provider) {
        case 'llama':
          response = await callMetaAPI(prompt, model, apiKey)
          break
        case 'google':
          response = await callGoogleAPI(prompt, model, apiKey)
          break
        case 'mistral':
          response = await callMistralAPI(prompt, model, apiKey)
          break
        default:
          throw new Error(`Unsupported provider: ${provider}`)
      }
    } catch (aiError) {
      console.error(`[AI Test] AI service error:`, aiError)
      return NextResponse.json(
        { 
          error: `AI service error: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`,
          provider: provider,
          model: model
        },
        { status: 500 }
      )
    }

    const responseTime = Date.now() - startTime
    console.log(`[AI Test] Response received in ${responseTime}ms`)

    return NextResponse.json({
      content: response.content,
      tokenCount: response.tokenUsage?.total_tokens || null,
      model: model,
      provider: provider,
      responseTime: responseTime,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('[AI Test] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}