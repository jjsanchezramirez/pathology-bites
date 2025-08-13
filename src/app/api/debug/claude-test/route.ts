import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiKey, model, prompt, instructions } = body

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    // Make request to Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: `${instructions}\n\n${prompt}`
          }
        ],
        temperature: 0.7,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: data.error || 'Failed to generate content' }, { status: response.status })
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Claude API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}