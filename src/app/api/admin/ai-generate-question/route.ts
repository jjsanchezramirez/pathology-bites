import { NextRequest, NextResponse } from 'next/server'
import { getApiKey, getModelProvider, ACTIVE_AI_MODELS } from '@/shared/config/ai-models'

// Accept all available models for admin question generation
const ADMIN_AI_MODELS = ACTIVE_AI_MODELS.filter(model => model.available).map(model => model.id)

interface QuestionGenerationRequest {
  content: {
    category: string
    subject: string
    lesson: string
    topic: string
    text: string
  }
  instructions: string
  additionalContext?: string
  model: string
}

// AI API call functions
async function callAIService(provider: string, prompt: string, modelId: string, apiKey: string): Promise<{ content: string; tokenUsage?: any }> {
  switch (provider) {
    case 'llama':
      return await callMetaAPI(prompt, modelId, apiKey)
    case 'google':
      return await callGoogleAPI(prompt, modelId, apiKey)
    case 'mistral':
      return await callMistralAPI(prompt, modelId, apiKey)
    default:
      throw new Error(`Unsupported model provider: ${provider}`)
  }
}

async function callMetaAPI(prompt: string, model: string, apiKey: string): Promise<{ content: string; tokenUsage?: any }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20000) // 20 second timeout

  let response: Response
  try {
    response = await fetch('https://api.llama.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert pathologist and medical educator creating high-quality board-style multiple-choice questions for medical students and residents. Create clinically relevant questions that test diagnostic reasoning, not just memorization. Focus on clinical correlation, differential diagnosis, and educational value. Always provide detailed explanations that include both clinical and histopathological reasoning. Always respond with properly formatted JSON and follow the exact format requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: 4000,
        temperature: 0.7
      })
    })
    clearTimeout(timeoutId)
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Meta LLAMA API timeout after 20 seconds')
    }
    throw error
  }

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = `Meta LLAMA API error: ${response.status} ${response.statusText}`
    
    try {
      const errorData = JSON.parse(errorText)
      if (errorData.error?.message) {
        errorMessage = errorData.error.message
      }
    } catch {
      // Use default error message if JSON parsing fails
    }
    
    throw new Error(errorMessage)
  }

  const data = await response.json()
  
  // Handle Meta LLAMA API response format (match WSI implementation)
  let content = ''
  if (data.completion_message?.content?.text) {
    content = data.completion_message.content.text
  } else if (data.choices?.[0]?.message?.content) {
    content = data.choices[0].message.content
  }
  
  // Check for token usage in various possible locations
  let tokenUsage = undefined
  if (data.usage) {
    tokenUsage = {
      prompt_tokens: data.usage.prompt_tokens || 0,
      completion_tokens: data.usage.completion_tokens || 0,
      total_tokens: data.usage.total_tokens || 0
    }
  } else if (data.token_usage) {
    tokenUsage = {
      prompt_tokens: data.token_usage.prompt_tokens || 0,
      completion_tokens: data.token_usage.completion_tokens || 0,
      total_tokens: data.token_usage.total_tokens || 0
    }
  } else if (data.completion_message?.usage) {
    tokenUsage = {
      prompt_tokens: data.completion_message.usage.prompt_tokens || 0,
      completion_tokens: data.completion_message.usage.completion_tokens || 0,
      total_tokens: data.completion_message.usage.total_tokens || 0
    }
  }

  return { content: content || '', tokenUsage }
}

async function callGoogleAPI(prompt: string, model: string, apiKey: string): Promise<{ content: string; tokenUsage?: any }> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4000
      }
    })
  })

  if (!response.ok) {
    throw new Error(`Google API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    tokenUsage: data.usageMetadata ? {
      prompt_tokens: data.usageMetadata.promptTokenCount || 0,
      completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata.totalTokenCount || 0
    } : undefined
  }
}

async function callMistralAPI(prompt: string, model: string, apiKey: string): Promise<{ content: string; tokenUsage?: any }> {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert pathologist and medical educator creating high-quality board-style multiple-choice questions for medical students and residents. Create clinically relevant questions that test diagnostic reasoning, not just memorization. Focus on clinical correlation, differential diagnosis, and educational value. Always provide detailed explanations that include both clinical and histopathological reasoning. Always respond with properly formatted JSON and follow the exact format requested.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 4000,
      temperature: 0.7
    })
  })

  if (!response.ok) {
    throw new Error(`Mistral API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return {
    content: data.choices[0]?.message?.content || '',
    tokenUsage: data.usage ? {
      prompt_tokens: data.usage.prompt_tokens,
      completion_tokens: data.usage.completion_tokens,
      total_tokens: data.usage.total_tokens
    } : undefined
  }
}

function buildAdminQuestionPrompt(content: any, instructions: string, additionalContext: string): string {
  return `Create a high-quality medical/pathology question based on the following educational content:

EDUCATIONAL CONTENT:
Subject: ${content.subject}
Lesson: ${content.lesson}  
Topic: ${content.topic}
Content: ${content.text}

INSTRUCTIONS:
${instructions}

ADDITIONAL CONTEXT:
${additionalContext || 'None provided'}

REQUIREMENTS:
1. Create a clinically relevant multiple-choice question
2. Include exactly 5 answer options (A, B, C, D, E)
3. Only ONE option should be correct
4. Provide detailed explanations for each option
5. Include a meaningful teaching point
6. Use appropriate medical terminology
7. Make the question challenging but fair
8. Base the question on the provided content and follow the given instructions

Return your response in this EXACT JSON format (no markdown, no code blocks, just pure JSON):

{
  "title": "Brief descriptive title for the question",
  "stem": "The question text ending with a clear question mark",
  "question_options": [
    {
      "id": "A",
      "text": "First answer option",
      "is_correct": false,
      "explanation": "Detailed explanation why this is incorrect"
    },
    {
      "id": "B",
      "text": "Second answer option",
      "is_correct": true,
      "explanation": "Detailed explanation why this is correct"
    },
    {
      "id": "C",
      "text": "Third answer option",
      "is_correct": false,
      "explanation": "Detailed explanation why this is incorrect"
    },
    {
      "id": "D",
      "text": "Fourth answer option",
      "is_correct": false,
      "explanation": "Detailed explanation why this is incorrect"
    },
    {
      "id": "E",
      "text": "Fifth answer option",
      "is_correct": false,
      "explanation": "Detailed explanation why this is incorrect"
    }
  ],
  "teaching_point": "Key learning objective or clinical pearl from this question",
  "references": ["Relevant medical references if applicable"],
  "suggested_tags": ["Tag1", "Tag2", "Tag3"]
}

IMPORTANT: For suggested_tags, provide 3-5 relevant medical/pathology tags that describe the key concepts, diseases, or techniques in this question. Tags should be:
- Specific medical terms (e.g., "Cervical Neoplasia", "HPV", "Adenocarcinoma In Situ")
- Relevant to the question content
- Useful for categorizing and searching questions
- Concise (1-3 words each)`;
}

function extractJSON(text: string): any {
  console.log(`[Admin AI] Extracting JSON from response (${text.length} chars)`)

  // Handle Mistral thinking format first
  let cleanedText = text
  try {
    // Check if it's a Mistral thinking format (array with thinking objects)
    if (text.trim().startsWith('[')) {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        // Find the actual text response (not thinking)
        const textResponse = parsed.find(item =>
          item.type === 'text' && !item.thinking
        )
        if (textResponse?.text) {
          cleanedText = textResponse.text
          console.log('[Admin AI] Extracted content from Mistral thinking format')
        }
      }
    }
  } catch (e) {
    // Continue with original text if parsing fails
  }

  // Strategy 1: Smart brace counting (handles extra content after JSON)
  const firstBrace = cleanedText.indexOf('{')
  if (firstBrace !== -1) {
    let braceCount = 0
    let i = firstBrace
    let inString = false
    let escapeNext = false

    while (i < cleanedText.length) {
      const char = cleanedText[i]

      if (escapeNext) {
        escapeNext = false
      } else if (char === '\\' && inString) {
        escapeNext = true
      } else if (char === '"' && !escapeNext) {
        inString = !inString
      } else if (!inString) {
        if (char === '{') {
          braceCount++
        } else if (char === '}') {
          braceCount--
          if (braceCount === 0) {
            const jsonStr = cleanedText.substring(firstBrace, i + 1)
            try {
              return JSON.parse(jsonStr)
            } catch (e) {
              // Continue to other strategies
              break
            }
          }
        }
      }
      i++
    }
  }

  // Strategy 2: Look for JSON between code blocks
  const codeBlockMatch = cleanedText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1])
    } catch (e) {
      // Continue to next strategy
    }
  }

  // Strategy 3: Greedy match (fallback)
  const greedyMatch = cleanedText.match(/\{[\s\S]*\}/)
  if (greedyMatch) {
    try {
      return JSON.parse(greedyMatch[0])
    } catch (e) {
      // Try to fix common JSON issues
      const fixedJson = greedyMatch[0]
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes to unquoted keys
        .replace(/:\s*'([^']*)'/g, ': "$1"') // Replace single quotes with double quotes
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .trim()

      try {
        return JSON.parse(fixedJson)
      } catch (fixError) {
        throw new Error(`JSON parsing failed: ${e instanceof Error ? e.message : 'Parse error'}`)
      }
    }
  }

  console.error('[Admin AI] Failed to extract JSON. Response preview:', text.substring(0, 1000))
  throw new Error('No JSON found in AI response')
}

export async function POST(request: NextRequest) {
  try {
    const body: QuestionGenerationRequest = await request.json()
    const { content, instructions, additionalContext = '', model } = body

    // Validate inputs
    if (!content || !instructions || !model) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: content, instructions, model' },
        { status: 400 }
      )
    }

    // Validate model
    if (!ADMIN_AI_MODELS.includes(model)) {
      return NextResponse.json(
        { success: false, error: `Unsupported model: ${model}. Supported: ${ADMIN_AI_MODELS.join(', ')}` },
        { status: 400 }
      )
    }

    // Get API configuration
    const provider = getModelProvider(model)
    const apiKey = getApiKey(provider)
    
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: `No API key found for provider: ${provider}` },
        { status: 500 }
      )
    }

    console.log(`[Admin AI] Generating question using ${model} (${provider})`)

    // Build the prompt
    const prompt = buildAdminQuestionPrompt(content, instructions, additionalContext)
    
    // Call AI service
    const startTime = Date.now()
    const aiResponse = await callAIService(provider, prompt, model, apiKey)
    const generationTime = Date.now() - startTime

    console.log(`[Admin AI] Generated response in ${generationTime}ms`)

    // Parse the AI response
    const questionData = extractJSON(aiResponse.content)

    // Normalize options field - AI models sometimes use different field names despite our prompt
    // Accept question_options (preferred), answer_options, or options, then normalize to question_options
    if (!questionData.question_options && (questionData.answer_options || questionData.options)) {
      console.log('[Admin AI] Normalizing options field from:', questionData.answer_options ? 'answer_options' : 'options')
      questionData.question_options = questionData.answer_options || questionData.options
      // Clean up the old field
      delete questionData.answer_options
      delete questionData.options
    }

    // Validate the response structure
    if (!questionData.title || !questionData.stem || !questionData.question_options || !Array.isArray(questionData.question_options)) {
      console.error('[Admin AI] Validation failed. Response structure:', {
        hasTitle: !!questionData.title,
        hasStem: !!questionData.stem,
        hasQuestionOptions: !!questionData.question_options,
        hasAnswerOptions: !!questionData.answer_options,
        hasOptions: !!questionData.options,
        isQuestionOptionsArray: Array.isArray(questionData.question_options),
        actualKeys: Object.keys(questionData)
      })
      throw new Error('AI response missing required fields')
    }

    if (questionData.question_options.length !== 5) {
      throw new Error('AI response must contain exactly 5 options')
    }

    const correctCount = questionData.question_options.filter((opt: any) => opt.is_correct).length
    if (correctCount !== 1) {
      throw new Error(`AI response must have exactly 1 correct answer, found ${correctCount}`)
    }

    return NextResponse.json({
      success: true,
      question: questionData,
      metadata: {
        generated_at: new Date().toISOString(),
        generation_time_ms: generationTime,
        model: model,
        provider: provider,
        token_usage: aiResponse.tokenUsage
      }
    })

  } catch (error) {
    console.error('[Admin AI] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    )
  }
}