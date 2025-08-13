import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiKey, model } = body

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    const llamaApiUrl = process.env.LLAMA_API_ENDPOINT || process.env.NEXT_PUBLIC_LLAMA_API_ENDPOINT || 'https://api.llama.com/v1/chat/completions'
    
    console.log(`🔍 LLAMA Diagnostic Test:`, {
      url: llamaApiUrl,
      model: model,
      apiKeyPresent: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      apiKeyPrefix: apiKey?.substring(0, 8) + '...',
      environment: {
        LLAMA_API_ENDPOINT: !!process.env.LLAMA_API_ENDPOINT,
        NEXT_PUBLIC_LLAMA_API_ENDPOINT: !!process.env.NEXT_PUBLIC_LLAMA_API_ENDPOINT,
        LLAMA_USE_JSON_FORMAT: process.env.LLAMA_USE_JSON_FORMAT
      }
    })

    // Test with minimal request first (without JSON schema to see raw format)
    const minimalRequestBody = {
      model: model,
      messages: [
        {
          role: 'user',
          content: 'Hello, please respond with just the word "success"'
        }
      ],
      max_tokens: 50,
      temperature: 0.1,
      stream: false
    }

    console.log(`🦙 Minimal Request:`, JSON.stringify(minimalRequestBody, null, 2))

    const response = await fetch(llamaApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'User-Agent': 'PathologyBites-Diagnostic/1.0'
      },
      body: JSON.stringify(minimalRequestBody),
    })

    const responseText = await response.text()
    console.log(`🦙 Raw Response Text:`, responseText)

    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error(`🦙 JSON Parse Error:`, parseError)
      return NextResponse.json({
        error: 'Invalid JSON response from LLAMA API',
        details: {
          status: response.status,
          statusText: response.statusText,
          rawResponse: responseText.substring(0, 500),
          parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error'
        }
      }, { status: 502 })
    }

    const diagnosticInfo = {
      request: {
        url: llamaApiUrl,
        model: model,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.substring(0, 8)}...`,
          'Accept': 'application/json',
          'User-Agent': 'PathologyBites-Diagnostic/1.0'
        },
        body: minimalRequestBody
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        data: data
      },
      analysis: {
        hasChoices: !!(data?.choices),
        choicesLength: data?.choices?.length || 0,
        hasError: !!(data?.error),
        errorType: typeof data?.error,
        hasUsage: !!(data?.usage),
        responseStructure: Object.keys(data || {}),
        // Additional analysis for different response formats
        hasResponse: !!(data?.response),
        hasContent: !!(data?.content),
        hasText: !!(data?.text),
        hasMessage: !!(data?.message),
        dataType: typeof data,
        isArray: Array.isArray(data),
        responseFormats: {
          openaiCompatible: !!(data?.choices),
          directResponse: !!(data?.response || data?.content),
          textResponse: !!(data?.text),
          messageResponse: !!(data?.message)
        }
      }
    }

    console.log(`🦙 Diagnostic Complete:`, diagnosticInfo)

    if (!response.ok) {
      let errorMessage = `LLAMA API Error (${response.status})`
      
      if (data?.error) {
        if (typeof data.error === 'string') {
          errorMessage = data.error
        } else if (typeof data.error === 'object') {
          errorMessage = data.error.message || data.error.details || JSON.stringify(data.error)
        }
      }

      return NextResponse.json({
        error: errorMessage,
        diagnostic: diagnosticInfo
      }, { status: response.status })
    }

    return NextResponse.json({
      success: true,
      message: 'LLAMA API diagnostic completed successfully',
      diagnostic: diagnosticInfo,
      llamaResponse: data
    })

  } catch (error) {
    console.error('🦙 LLAMA Diagnostic Error:', error)
    
    let errorMessage = 'LLAMA diagnostic failed'
    if (error instanceof Error) {
      errorMessage = error.message
    }

    return NextResponse.json({
      error: errorMessage,
      details: {
        type: error instanceof Error ? error.constructor.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 })
  }
}
