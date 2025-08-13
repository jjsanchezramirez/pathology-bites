import { NextRequest, NextResponse } from 'next/server'
import { getModelProvider, getApiKey } from '@/shared/config/ai-models'
import { parseAIResponse, extractTokenUsage } from '@/shared/utils/ai-response-parser'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { models, prompt, instructions } = body

    if (!models || !Array.isArray(models) || models.length === 0) {
      return NextResponse.json({ error: 'Models array is required' }, { status: 400 })
    }

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    console.log(`🔄 Starting batch test for ${models.length} models`)

    // Test all models in parallel
    const testPromises = models.map(async (modelId: string) => {
      const startTime = Date.now()
      
      try {
        const provider = getModelProvider(modelId)
        const apiKey = getApiKey(provider)

        if (!apiKey) {
          return {
            modelId,
            status: 'error',
            error: `No API key configured for ${provider}`
          }
        }

        // Call the appropriate debug endpoint for each provider
        let apiEndpoint: string
        let requestBody: any

        if (provider === 'google' || provider === 'gemini') {
          apiEndpoint = '/api/debug/google-test'
          requestBody = {
            apiKey,
            model: modelId,
            prompt,
            instructions: instructions || 'Provide a clear, concise response.'
          }
        } else if (provider === 'mistral') {
          apiEndpoint = '/api/debug/mistral-test'
          requestBody = {
            apiKey,
            model: modelId,
            prompt,
            instructions: instructions || 'Provide a clear, concise response.'
          }
        } else if (provider === 'claude') {
          apiEndpoint = '/api/debug/claude-test'
          requestBody = {
            apiKey,
            model: modelId,
            prompt,
            instructions: instructions || 'Provide a clear, concise response.'
          }
        } else if (provider === 'chatgpt') {
          apiEndpoint = '/api/debug/chatgpt-test'
          requestBody = {
            apiKey,
            model: modelId,
            prompt,
            instructions: instructions || 'Provide a clear, concise response.'
          }
        } else if (provider === 'deepseek') {
          apiEndpoint = '/api/debug/deepseek-test'
          requestBody = {
            apiKey,
            model: modelId,
            prompt,
            instructions: instructions || 'Provide a clear, concise response.'
          }
        } else if (provider === 'llama') {
          apiEndpoint = '/api/debug/llama-test'
          requestBody = {
            apiKey,
            model: modelId,
            prompt,
            instructions: instructions || 'Provide a clear, concise response.'
          }
        } else if (provider === 'groq') {
          // Groq models are disabled - return error immediately
          return {
            modelId,
            status: 'error',
            error: 'Groq models are currently disabled'
          }
        } else {
          return {
            modelId,
            status: 'error',
            error: `Unsupported provider: ${provider}`
          }
        }

        // Make the API call
        const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${apiEndpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })

        const data = await response.json()
        const responseTime = Date.now() - startTime

        console.log(`📊 Model ${modelId} response:`, {
          status: response.status,
          ok: response.ok,
          dataType: typeof data,
          hasError: !!data.error,
          errorType: typeof data.error
        })

        if (!response.ok) {
          // Ensure error is always a string
          let errorMessage = `HTTP ${response.status}`
          if (data.error) {
            if (typeof data.error === 'string') {
              errorMessage = data.error
            } else if (typeof data.error === 'object') {
              // Handle error objects with various structures
              errorMessage = data.error.message ||
                           data.error.details ||
                           JSON.stringify(data.error)
            }
          }

          return {
            modelId,
            status: 'error',
            responseTime,
            error: errorMessage
          }
        }

        // Extract response text using the unified parser
        const parsedResponse = parseAIResponse(data, provider)
        const responseText = parsedResponse.content

        // Log if thinking content was detected and separated
        if (parsedResponse.hasThinking) {
          console.log(`🧠 Thinking content detected for ${modelId}:`)
          console.log(`   Original length: ${parsedResponse.originalLength}`)
          console.log(`   Cleaned length: ${parsedResponse.cleanedLength}`)
          console.log(`   Thinking content: ${parsedResponse.thinkingContent?.substring(0, 100)}...`)
        }

        // Extract token usage using the unified parser
        const tokenUsage = extractTokenUsage(data, provider)

        return {
          modelId,
          status: 'success',
          response: responseText,
          responseTime,
          tokenUsage,
          // Include thinking content if present
          ...(parsedResponse.hasThinking && {
            thinkingContent: parsedResponse.thinkingContent,
            hasThinking: true
          })
        }

      } catch (error) {
        const responseTime = Date.now() - startTime
        console.error(`❌ Error testing model ${modelId}:`, error)

        // Ensure error is always a string
        let errorMessage = 'Unknown error'
        if (error instanceof Error) {
          errorMessage = error.message
        } else if (typeof error === 'string') {
          errorMessage = error
        } else if (typeof error === 'object' && error !== null) {
          errorMessage = JSON.stringify(error)
        }

        return {
          modelId,
          status: 'error',
          responseTime,
          error: errorMessage
        }
      }
    })

    // Wait for all tests to complete
    const results = await Promise.all(testPromises)

    const successCount = results.filter(r => r.status === 'success').length
    const errorCount = results.filter(r => r.status === 'error').length

    console.log(`✅ Batch test completed: ${successCount} successful, ${errorCount} errors`)

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: models.length,
        successful: successCount,
        errors: errorCount
      }
    })

  } catch (error) {
    console.error('Batch model test error:', error)

    // Ensure error response is always a string
    let errorMessage = 'Internal server error'
    if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === 'string') {
      errorMessage = error
    }

    return NextResponse.json({
      error: errorMessage
    }, { status: 500 })
  }
}