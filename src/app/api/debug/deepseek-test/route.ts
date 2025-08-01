// src/app/api/debug/deepseek-test/route.ts
import { NextRequest, NextResponse } from 'next/server'

interface DeepSeekRequest {
  apiKey: string
  model: string
  prompt: string
  instructions?: string
  assumeHistologicImages?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body: DeepSeekRequest = await request.json()
    const { apiKey, model, prompt, instructions, assumeHistologicImages = false } = body

    // Validate required fields
    if (!apiKey || !model || !prompt) {
      return NextResponse.json(
        { error: { message: 'Missing required fields: apiKey, model, or prompt' } },
        { status: 400 }
      )
    }

    // Prepare the messages array
    const messages: any[] = []
    
    // Add system message if instructions provided
    let systemInstructions = instructions || ''

    // Modify instructions for histologic images based on setting
    if (assumeHistologicImages) {
      const histologicInstruction = '\n\nCRITICAL INSTRUCTION: Histologic images are provided with this question. You MUST reference them as "the histologic images shown" or "the images below" and NEVER describe their microscopic appearance, cellular morphology, staining patterns, or histologic features. Do NOT write phrases like "histologic examination reveals" or describe what would be visible under the microscope. Instead, focus on clinical correlation, diagnostic reasoning, and differential diagnosis. Assume the reader can see the images and interpret the histologic findings themselves.'
      systemInstructions += histologicInstruction
    } else {
      const noHistologicInstruction = '\n\nCRITICAL INSTRUCTION: No histologic images are provided. You SHOULD describe relevant histologic or microscopic findings as part of the clinical scenario when appropriate. Include specific cellular features, tissue architecture, microscopic appearance, and histologic examination results as needed to create a complete pathology question.'
      systemInstructions += noHistologicInstruction
    }

    if (systemInstructions.trim()) {
      messages.push({
        role: 'system',
        content: systemInstructions
      })
    }
    
    // Add user message
    messages.push({
      role: 'user',
      content: prompt
    })

    // Prepare the request body for DeepSeek API
    const requestBody = {
      model: model,
      messages: messages,
      max_tokens: 4000,
      temperature: 0.7,
      stream: false
    }

    // Make the API call to DeepSeek
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { 
          error: { 
            message: data.error?.message || 'DeepSeek API request failed',
            type: data.error?.type || 'api_error',
            code: data.error?.code || response.status
          } 
        },
        { status: response.status }
      )
    }

    // Return the successful response with consistent format
    return NextResponse.json({
      ...data,
      // Ensure usage field is present for token tracking
      usage: data.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    })

  } catch (error) {
    console.error('DeepSeek API test error:', error)
    return NextResponse.json(
      { 
        error: { 
          message: error instanceof Error ? error.message : 'Internal server error',
          type: 'internal_error'
        } 
      },
      { status: 500 }
    )
  }
}
