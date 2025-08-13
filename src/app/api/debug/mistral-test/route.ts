import { NextRequest, NextResponse } from 'next/server'
import { extractMistralResponse } from '@/shared/utils/ai-response-parser'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiKey, model, prompt, instructions } = body

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    // Make request to Mistral API
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: instructions
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: data.error || 'Failed to generate content' }, { status: response.status })
    }

    // Process Mistral response to extract thinking content
    if (data.choices?.[0]?.message?.content) {
      const parsedResponse = extractMistralResponse(data.choices[0].message.content)

      // Update the response with cleaned content
      data.choices[0].message.content = parsedResponse.content

      // Log if thinking content was found and removed
      if (parsedResponse.hasThinking) {
        console.log('🧠 Mistral thinking content detected and separated')
        console.log('📝 Original length:', parsedResponse.originalLength)
        console.log('📝 Cleaned length:', parsedResponse.cleanedLength)
        console.log('🧠 Thinking preview:', parsedResponse.thinkingContent?.substring(0, 100) + '...')
      }
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Mistral API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}