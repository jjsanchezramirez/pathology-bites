// src/app/api/debug/llama-test/route.ts
import { NextRequest, NextResponse } from 'next/server'

interface LlamaRequest {
  apiKey: string
  model: string
  prompt: string
  instructions?: string
  assumeHistologicImages?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body: LlamaRequest = await request.json()
    const { apiKey, model, prompt, instructions, assumeHistologicImages = false } = body

    // Validate required fields
    if (!apiKey || !model || !prompt) {
      return NextResponse.json(
        { error: { message: 'Missing required fields: apiKey, model, or prompt' } },
        { status: 400 }
      )
    }

    // Validate API key format and provide helpful error messages
    if (apiKey.trim() === '') {
      return NextResponse.json(
        {
          error: {
            message: 'LLAMA API key is empty. Please set NEXT_PUBLIC_LLAMA_API_KEY in your .env.local file.',
            code: 'EMPTY_API_KEY'
          }
        },
        { status: 400 }
      )
    }

    if (apiKey.includes('your_') || apiKey.includes('placeholder')) {
      return NextResponse.json(
        {
          error: {
            message: 'LLAMA API key appears to be a placeholder. Please replace it with your actual Meta LLAMA API key.',
            code: 'PLACEHOLDER_API_KEY'
          }
        },
        { status: 400 }
      )
    }

    // Prepare the messages array
    const messages: any[] = []

    // Build comprehensive instructions
    let fullInstructions = instructions || ''

    // Add histologic image instructions based on setting
    if (assumeHistologicImages) {
      fullInstructions += '\n\n🚨 ABSOLUTELY CRITICAL - READ CAREFULLY: Histologic images are provided with this question. You are STRICTLY FORBIDDEN from describing microscopic findings, cellular features, tissue architecture, staining patterns, or any histologic details. DO NOT use phrases like "histologic examination reveals", "microscopic findings show", "the biopsy demonstrates", or any similar descriptions of what would be seen under the microscope. Instead, you MUST reference the images as "the histologic images shown" or "the images below" and focus ONLY on clinical correlation, diagnostic reasoning, and differential diagnosis. The reader can see the images themselves.'
    } else {
      fullInstructions += '\n\n🚨 CRITICAL INSTRUCTION: No histologic images are provided. You SHOULD describe relevant histologic or microscopic findings as part of the clinical scenario when appropriate. Include specific cellular features, tissue architecture, microscopic appearance, and histologic examination results as needed to create a complete pathology question.'
    }

    // For LLAMA API, combine system instructions with user prompt for better adherence
    let combinedPrompt = prompt
    if (fullInstructions.trim()) {
      combinedPrompt = `${fullInstructions.trim()}\n\n---\n\nUser Request: ${prompt}`
    }

    // Add user message with combined instructions
    messages.push({
      role: 'user',
      content: combinedPrompt
    })

    // Prepare the request body for official Meta LLAMA API
    const requestBody = {
      model: model,
      messages: messages,
      max_completion_tokens: 4096,
      temperature: 0.6,
      top_p: 0.9,
      stream: false
    }

    // Make the API call to official Meta LLAMA API
    const response = await fetch('https://api.llama.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    const data = await response.json()

    // Log the response for debugging
    console.log('LLAMA API Response Status:', response.status)
    console.log('LLAMA API Response Data:', JSON.stringify(data, null, 2))

    if (!response.ok) {
      console.error('LLAMA API Error:', data)

      // Provide specific error messages for common issues
      let errorMessage = data.error?.message || `LLAMA API returned ${response.status}`
      let helpfulMessage = ''

      if (response.status === 401) {
        helpfulMessage = 'Authentication failed. Please check your LLAMA API key:\n' +
          '1. Verify the API key is correct in your .env.local file\n' +
          '2. Check if the API key has expired\n' +
          '3. Ensure you have proper permissions for the Meta LLAMA API'
      } else if (response.status === 403) {
        helpfulMessage = 'Access forbidden. Your API key may not have permission to access this model or endpoint.'
      } else if (response.status === 429) {
        helpfulMessage = 'Rate limit exceeded. Please wait before making another request.'
      } else if (response.status === 404) {
        helpfulMessage = 'Model or endpoint not found. Please check if the model name is correct.'
      }

      return NextResponse.json(
        {
          error: {
            message: errorMessage,
            helpfulMessage: helpfulMessage,
            status: response.status,
            details: data
          }
        },
        { status: response.status }
      )
    }

    // Extract content from response with multiple fallback methods
    let responseContent = null

    // Check for LLAMA API format first
    if (data.completion_message?.content?.text) {
      responseContent = data.completion_message.content.text
    } else if (data.choices?.[0]?.message?.content) {
      // OpenAI-compatible format
      responseContent = data.choices[0].message.content
    } else if (data.response) {
      responseContent = data.response
    } else if (data.text) {
      responseContent = data.text
    } else if (data.content) {
      responseContent = data.content
    } else if (data.output) {
      responseContent = data.output
    }

    // If we couldn't extract content, return an error instead of pretending success
    if (!responseContent) {
      console.error('LLAMA API: Could not extract content from response')
      return NextResponse.json(
        {
          error: {
            message: 'Could not extract content from LLAMA API response',
            helpfulMessage: 'The LLAMA API returned a response but the content could not be parsed. This may indicate an API format change or an unexpected response structure.',
            details: data
          }
        },
        { status: 502 }
      )
    }

    // Extract usage information from LLAMA API metrics
    let usage = {}
    if (data.metrics) {
      const metrics = data.metrics.reduce((acc: any, metric: any) => {
        if (metric.metric === 'num_prompt_tokens') acc.prompt_tokens = metric.value
        if (metric.metric === 'num_completion_tokens') acc.completion_tokens = metric.value
        if (metric.metric === 'num_total_tokens') acc.total_tokens = metric.value
        return acc
      }, {})
      usage = metrics
    } else if (data.usage) {
      usage = data.usage
    }

    // Return the response in a consistent format (OpenAI-compatible)
    return NextResponse.json({
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: responseContent
          },
          finish_reason: data.completion_message?.stop_reason || data.choices?.[0]?.finish_reason || 'stop'
        }
      ],
      usage: usage,
      model: model,
      // Also include the original format for debugging
      _debug: {
        success: true,
        provider: 'llama',
        originalResponse: data
      }
    })

  } catch (error) {
    console.error('LLAMA Test Error:', error)
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
