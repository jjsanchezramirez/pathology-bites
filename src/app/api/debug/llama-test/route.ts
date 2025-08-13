import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiKey, model, prompt, instructions, educationalContext } = body

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    // Direct LLAMA API endpoint - using the correct endpoint
    const llamaApiUrl = process.env.LLAMA_API_ENDPOINT || process.env.NEXT_PUBLIC_LLAMA_API_ENDPOINT || 'https://api.llama.com/v1/chat/completions'

    console.log(`🦙 LLAMA API Request:`, {
      url: llamaApiUrl,
      model: model,
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0
    })
    
    const messages = [
      {
        role: 'system',
        content: instructions
      }
    ]

    // Add educational context if provided
    if (educationalContext) {
      messages.push({
        role: 'user',
        content: `Educational Context:\n${educationalContext}\n\nTask: ${prompt}`
      })
    } else {
      messages.push({
        role: 'user',
        content: prompt
      })
    }

    // Prepare request body with proper LLAMA API format
    const requestBody: any = {
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 2048,
      // LLAMA API specific parameters
      stream: false,
      top_p: 0.9
    }

    // Only add JSON schema format if specifically enabled (to test raw format first)
    if (process.env.LLAMA_USE_JSON_FORMAT === 'true') {
      requestBody.response_format = {
        type: "json_schema",
        json_schema: {
          name: "Response",
          schema: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: "The response content"
              }
            },
            required: ["content"]
          }
        }
      }
    }

    console.log(`🦙 LLAMA Request Body:`, JSON.stringify(requestBody, null, 2))

    // Make request to direct LLAMA API
    const response = await fetch(llamaApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        // Add additional headers that might be required by LLAMA API
        'Accept': 'application/json',
        'User-Agent': 'PathologyBites/1.0'
      },
      body: JSON.stringify(requestBody),
    })

    const data = await response.json()

    console.log(`🦙 LLAMA Response:`, {
      status: response.status,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      dataKeys: Object.keys(data || {}),
      hasChoices: !!(data?.choices),
      hasError: !!(data?.error)
    })

    if (!response.ok) {
      console.error('🦙 LLAMA API error:', {
        status: response.status,
        statusText: response.statusText,
        data: data,
        url: llamaApiUrl,
        model: model
      })

      // Ensure error is always a string with more detailed error information
      let errorMessage = `Failed to generate content (HTTP ${response.status})`

      if (data?.error) {
        if (typeof data.error === 'string') {
          errorMessage = data.error
        } else if (typeof data.error === 'object') {
          errorMessage = data.error.message ||
                        data.error.details ||
                        data.error.code ||
                        JSON.stringify(data.error)
        }
      } else if (data?.message) {
        errorMessage = data.message
      } else if (response.status === 401) {
        errorMessage = 'Invalid API key or authentication failed'
      } else if (response.status === 403) {
        errorMessage = 'Access forbidden - check API key permissions'
      } else if (response.status === 404) {
        errorMessage = 'LLAMA API endpoint not found - check LLAMA_API_ENDPOINT configuration'
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded - too many requests'
      } else if (response.status >= 500) {
        errorMessage = 'LLAMA API server error - service temporarily unavailable'
      }

      return NextResponse.json({ error: errorMessage }, { status: response.status })
    }

    console.log('🦙 LLAMA API response structure:', JSON.stringify(data, null, 2))

    // Handle LLAMA API specific response format
    let responseContent = ''
    let tokenUsage = null

    console.log('🦙 Parsing LLAMA response with keys:', Object.keys(data || {}))

    // LLAMA API format: { id, completion_message: { content: { text: "..." } }, metrics }
    if (data.completion_message?.content?.text) {
      responseContent = data.completion_message.content.text
      console.log('🦙 Extracted content from completion_message.content.text')

      // Extract token usage from metrics if available
      if (data.metrics) {
        tokenUsage = {
          prompt_tokens: data.metrics.input_tokens || 0,
          completion_tokens: data.metrics.output_tokens || 0,
          total_tokens: data.metrics.total_tokens ||
                       (data.metrics.input_tokens || 0) + (data.metrics.output_tokens || 0)
        }
        console.log('🦙 Extracted token usage from metrics:', tokenUsage)
      }
    }
    // Fallback: Check for OpenAI-compatible format
    else if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
      responseContent = data.choices[0]?.message?.content || ''
      tokenUsage = data.usage
      console.log('🦙 Using OpenAI-compatible format')
    }
    // Fallback: Check for other common formats
    else if (data.response || data.content) {
      responseContent = data.response || data.content
      tokenUsage = data.usage || data.token_usage
      console.log('🦙 Using direct response/content format')
    }
    // Fallback: Check for text field
    else if (data.text) {
      responseContent = data.text
      tokenUsage = data.usage || data.token_usage
      console.log('🦙 Using text format')
    }
    else {
      console.error('🦙 Unrecognized LLAMA response structure:', {
        keys: Object.keys(data || {}),
        dataType: typeof data,
        data: data
      })

      // Try to extract any text content from the response
      const dataStr = JSON.stringify(data, null, 2)
      return NextResponse.json({
        error: `Unrecognized LLAMA API response format. Response keys: ${Object.keys(data || {}).join(', ')}. Full response: ${dataStr.substring(0, 500)}...`
      }, { status: 502 })
    }

    // Create OpenAI-compatible response format
    const compatibleResponse = {
      choices: [
        {
          message: {
            content: responseContent,
            role: 'assistant'
          },
          finish_reason: data.completion_message?.stop_reason || 'stop'
        }
      ],
      usage: tokenUsage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      },
      model: model,
      object: 'chat.completion',
      id: data.id || `llama-${Date.now()}`
    }

    console.log('🦙 Successfully converted LLAMA response to compatible format')
    console.log('🦙 Response content length:', responseContent.length)
    console.log('🦙 Token usage:', tokenUsage)

    return NextResponse.json(compatibleResponse)

  } catch (error) {
    console.error('LLAMA API error:', error)

    // Ensure error is always a string
    let errorMessage = 'Internal server error'
    if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === 'string') {
      errorMessage = error
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}