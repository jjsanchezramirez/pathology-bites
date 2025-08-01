// src/app/api/debug/gemini-test/route.ts
import { NextRequest, NextResponse } from 'next/server'

interface GeminiRequest {
  apiKey: string
  model: string
  prompt: string
  instructions?: string
  assumeHistologicImages?: boolean
}

export async function POST(request: NextRequest) {
  try {
    // Handle both JSON and FormData
    let apiKey: string, model: string, prompt: string, instructions: string = ''
    let assumeHistologicImages: boolean = false
    const attachments: File[] = []

    const contentType = request.headers.get('content-type')

    if (contentType?.includes('multipart/form-data')) {
      // Handle FormData (with file uploads)
      const formData = await request.formData()
      apiKey = formData.get('apiKey') as string
      model = formData.get('model') as string
      prompt = formData.get('prompt') as string
      instructions = formData.get('instructions') as string || ''
      assumeHistologicImages = formData.get('assumeHistologicImages') === 'true'

      // Extract attachments
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('attachment_') && value instanceof File) {
          attachments.push(value)
        }
      }
    } else {
      // Handle JSON
      const body: GeminiRequest = await request.json()
      apiKey = body.apiKey
      model = body.model
      prompt = body.prompt
      instructions = body.instructions || ''
      assumeHistologicImages = body.assumeHistologicImages || false
    }

    // Validate required fields
    if (!apiKey || !model || !prompt) {
      return NextResponse.json(
        { error: { message: 'Missing required fields: apiKey, model, or prompt' } },
        { status: 400 }
      )
    }

    // Construct the Gemini API URL
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

    // Prepare the content parts
    const parts: any[] = []

    // Add text prompt
    parts.push({ text: prompt })

    // TODO: Handle file attachments (would require uploading to Gemini File API first)
    // For now, just note if attachments were provided
    if (attachments.length > 0) {
      parts.push({
        text: `\n\n[Note: ${attachments.length} file(s) were uploaded but file processing is not yet implemented in this demo]`
      })
    }

    // Prepare the request body for Gemini API
    const requestBody: any = {
      contents: [
        {
          parts: parts
        }
      ]
    }

    // Add system instructions if provided
    if (instructions.trim()) {
      let modifiedInstructions = instructions

      // Modify instructions for histologic images based on setting
      if (assumeHistologicImages) {
        modifiedInstructions += '\n\nCRITICAL INSTRUCTION: Histologic images are provided with this question. You MUST reference them as "the histologic images shown" or "the images below" and NEVER describe their microscopic appearance, cellular morphology, staining patterns, or histologic features in detail. Do NOT write phrases like "histologic examination reveals" or describe what would be visible under the microscope. Instead, focus on clinical correlation, diagnostic reasoning, and differential diagnosis. Assume the reader can see the images and interpret the histologic findings themselves.'
      } else {
        modifiedInstructions += '\n\nCRITICAL INSTRUCTION: No histologic images are provided. You SHOULD describe relevant histologic or microscopic findings as part of the clinical scenario when appropriate. Include specific cellular features, tissue architecture, microscopic appearance, and histologic examination results as needed to create a complete pathology question.'
      }

      requestBody.systemInstruction = {
        parts: [{ text: modifiedInstructions }]
      }
    } else {
      // Add histologic image instructions even if no other instructions provided
      const histologicInstruction = assumeHistologicImages
        ? 'CRITICAL INSTRUCTION: Histologic images are provided with this question. You MUST reference them as "the histologic images shown" or "the images below" and NEVER describe their microscopic appearance, cellular morphology, staining patterns, or histologic features in detail. Do NOT write phrases like "histologic examination reveals" or describe what would be visible under the microscope. Instead, focus on clinical correlation, diagnostic reasoning, and differential diagnosis. Assume the reader can see the images and interpret the histologic findings themselves.'
        : 'CRITICAL INSTRUCTION: No histologic images are provided. You SHOULD describe relevant histologic or microscopic findings as part of the clinical scenario when appropriate. Include specific cellular features, tissue architecture, microscopic appearance, and histologic examination results as needed to create a complete pathology question.'

      requestBody.systemInstruction = {
        parts: [{ text: histologicInstruction }]
      }
    }

    // Make the request to Gemini API
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    })

    // Get the response data
    const data = await response.json()

    // Add consistent token usage format for Gemini
    if (data && !data.error) {
      // Gemini returns usage metadata differently than other providers
      const enhancedData = {
        ...data,
        usage: data.usageMetadata ? {
          prompt_tokens: data.usageMetadata.promptTokenCount || 0,
          completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
          total_tokens: data.usageMetadata.totalTokenCount || 
                       (data.usageMetadata.promptTokenCount || 0) + 
                       (data.usageMetadata.candidatesTokenCount || 0)
        } : {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      }
      return NextResponse.json(enhancedData, { status: response.status })
    }

    // Return the response with the same status code
    return NextResponse.json(data, { status: response.status })

  } catch (error) {
    console.error('Gemini API proxy error:', error)
    
    return NextResponse.json(
      { 
        error: { 
          message: 'Internal server error while calling Gemini API',
          details: error instanceof Error ? error.message : 'Unknown error'
        } 
      },
      { status: 500 }
    )
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: { message: 'Method not allowed. Use POST.' } },
    { status: 405 }
  )
}
