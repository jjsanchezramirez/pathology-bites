import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    let apiKey, model, prompt, instructions, educationalContext

    // Handle both JSON and FormData
    const contentType = request.headers.get('content-type')
    if (contentType?.includes('multipart/form-data')) {
      // Handle FormData
      const formData = await request.formData()
      apiKey = formData.get('apiKey') as string
      model = formData.get('model') as string
      prompt = formData.get('prompt') as string
      instructions = formData.get('instructions') as string
      educationalContext = formData.get('educationalContext') as string
    } else {
      // Handle JSON
      const body = await request.json()
      apiKey = body.apiKey
      model = body.model
      prompt = body.prompt
      instructions = body.instructions
      educationalContext = body.educationalContext
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    // Make request to Google Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${instructions}\n\n${educationalContext ? `Educational Context:\n${educationalContext}\n\n` : ''}${prompt}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Google API error:', data)
      return NextResponse.json({ error: data.error || 'Failed to generate content' }, { status: response.status })
    }

    console.log('Google API response structure:', JSON.stringify(data, null, 2))
    return NextResponse.json(data)

  } catch (error) {
    console.error('Google API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}