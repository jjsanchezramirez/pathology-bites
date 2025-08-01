// src/app/api/debug/claude-test/route.ts
import { NextRequest, NextResponse } from 'next/server'

interface ClaudeRequest {
  apiKey: string
  model: string
  prompt: string
  instructions?: string
  assumeHistologicImages?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body: ClaudeRequest = await request.json()
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
        role: 'user',
        content: `System instructions: ${systemInstructions}\n\nUser request: ${prompt}`
      })
    } else {
      messages.push({
        role: 'user',
        content: prompt
      })
    }

    // Prepare the request body for Claude API
    const requestBody = {
      model: model,
      max_tokens: 4000,
      messages: messages
    }

    // Make the API call to Claude
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { 
          error: { 
            message: data.error?.message || 'Claude API request failed',
            type: data.error?.type || 'api_error',
            code: response.status
          } 
        },
        { status: response.status }
      )
    }

    // Return the successful response with consistent token usage format
    return NextResponse.json({
      ...data,
      // Ensure usage field is present for token tracking (Claude provides usage in the response)
      usage: data.usage || {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0
      }
    })

  } catch (error) {
    console.error('Claude API test error:', error)
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
