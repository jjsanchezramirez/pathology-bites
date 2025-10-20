import { NextRequest, NextResponse } from 'next/server'
import { getApiKey, getModelProvider, ACTIVE_AI_MODELS } from '@/shared/config/ai-models'

// Accept all available models for admin question generation
const ADMIN_AI_MODELS = ACTIVE_AI_MODELS.filter(model => model.available).map(model => model.id)

interface QuestionGenerationRequest {
  mode?: 'educational_content' | 'refinement' | 'metadata_suggestion'
  content?: {
    category: string
    subject: string
    lesson: string
    topic: string
    content?: any
    // For metadata suggestion mode
    title?: string
    stem?: string
    teaching_point?: string
    available_categories?: Array<{ id: string; name: string }>
    available_question_sets?: Array<{ id: string; name: string }>
    available_tags?: Array<{ id: string; name: string }>
  }
  currentQuestion?: {
    title: string
    stem: string
    answer_options: any[]
    teaching_point: string
    question_references: string
  }
  instructions: string
  additionalContext?: string
  model?: string
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

function buildAdminQuestionPrompt(content: any, instructions: string, additionalContext: string, mode: string = 'educational_content'): string {
  if (mode === 'educational_content') {
    return `Create a high-quality medical/pathology question based on the following educational content:

EDUCATIONAL CONTENT:
Category: ${content.category}
Subject: ${content.subject}
Lesson: ${content.lesson}
Topic: ${content.topic}

INSTRUCTIONS:
${instructions}

ADDITIONAL CONTEXT:
${additionalContext || 'None provided'}

CRITICAL REQUIREMENTS:
1. Create a clinically relevant multiple-choice question
2. Include exactly 5 answer options (A, B, C, D, E) with one clearly correct answer
3. Provide detailed explanations for ALL 5 answer options (not just the correct one)
4. Include a meaningful teaching point that summarizes the key learning objective
5. Use appropriate medical terminology and pathology concepts
6. Make the question challenging but fair for medical students/residents
7. Base the question on the provided educational content
8. Focus on clinical correlation and diagnostic reasoning
9. Include relevant references if applicable

Return your response in this EXACT JSON format (no markdown, no code blocks, just pure JSON):

{
  "title": "Brief descriptive title for the question",
  "stem": "The question text ending with a clear question mark",
  "question_options": [
    {
      "text": "First answer option",
      "is_correct": false,
      "explanation": "Detailed explanation why this is incorrect, including clinical and pathological reasoning",
      "order_index": 0
    },
    {
      "text": "Second answer option",
      "is_correct": true,
      "explanation": "Detailed explanation why this is correct, including clinical correlation and key diagnostic features",
      "order_index": 1
    },
    {
      "text": "Third answer option",
      "is_correct": false,
      "explanation": "Detailed explanation why this is incorrect, including differential diagnosis considerations",
      "order_index": 2
    },
    {
      "text": "Fourth answer option",
      "is_correct": false,
      "explanation": "Detailed explanation why this is incorrect, mentioning distinguishing features",
      "order_index": 3
    },
    {
      "text": "Fifth answer option",
      "is_correct": false,
      "explanation": "Detailed explanation why this is incorrect, including clinical and histological differences",
      "order_index": 4
    }
  ],
  "teaching_point": "Concise 1-2 sentence key learning point about the specific concept being tested",
  "question_references": "Relevant medical/pathology references or citations",
  "suggested_tags": ["Tag1", "Tag2", "Tag3"],
  "difficulty": "medium",
  "status": "draft"
}

IMPORTANT: For suggested_tags, provide 3-5 relevant medical/pathology tags that describe the key concepts, diseases, or techniques in this question. Tags should be:
- Specific medical terms (e.g., "Cervical Neoplasia", "HPV", "Adenocarcinoma In Situ")
- Relevant to the question content
- Useful for categorizing and searching questions
- Concise (1-3 words each)`;
  }

  if (mode === 'metadata_suggestion') {
    return `Analyze the following question content and suggest appropriate metadata:

QUESTION CONTENT:
Title: ${content.title}
Stem: ${content.stem}
Teaching Point: ${content.teaching_point || 'Not provided'}

AVAILABLE OPTIONS:

Categories:
${content.available_categories?.map((cat: any) => `- ${cat.name} (ID: ${cat.id})`).join('\n') || 'None available'}

Question Sets:
${content.available_question_sets?.map((qs: any) => `- ${qs.name} (ID: ${qs.id})`).join('\n') || 'None available'}

Available Tags:
${content.available_tags?.map((tag: any) => `- ${tag.name} (ID: ${tag.id})`).join('\n') || 'None available'}

INSTRUCTIONS:
Based on the question content, suggest the most appropriate:
1. Category ID (from the available categories)
2. Question Set ID (from the available question sets)
3. Difficulty level (easy, medium, or hard)
4. Tag IDs (select 3-5 most relevant tags from available tags)

Return your response in this EXACT JSON format:
{
  "category_id": "most_appropriate_category_id_or_null",
  "question_set_id": "most_appropriate_question_set_id_or_null",
  "difficulty": "easy_medium_or_hard",
  "suggested_tag_ids": ["tag_id_1", "tag_id_2", "tag_id_3"]
}

IMPORTANT: Only use IDs that exist in the available options above. If no appropriate option exists, use null for that field.`;
  }

  // For refinement mode
  return `Refine the following medical/pathology question based on the provided instructions:

CURRENT QUESTION:
Title: ${content.title}
Stem: ${content.stem}
Teaching Point: ${content.teaching_point}
References: ${content.question_references}

CURRENT ANSWER OPTIONS:
${content.answer_options.map((opt: any, i: number) =>
  `${String.fromCharCode(65 + i)}. ${opt.text} ${opt.is_correct ? '(CORRECT)' : '(INCORRECT)'}\n   Explanation: ${opt.explanation}`
).join('\n')}

REFINEMENT INSTRUCTIONS:
${instructions}

CRITICAL REQUIREMENTS:
1. Maintain exactly 5 answer options (A, B, C, D, E) with one clearly correct answer
2. Provide detailed explanations for ALL 5 answer options
3. Keep the same clinical relevance and educational value
4. Apply the refinement instructions while preserving the question structure

Return your response in this EXACT JSON format:
{
  "title": "Question title here",
  "stem": "Question stem/body here",
  "question_options": [
    {
      "text": "Option A text",
      "is_correct": false,
      "explanation": "Detailed explanation for option A"
    },
    {
      "text": "Option B text",
      "is_correct": true,
      "explanation": "Detailed explanation for option B"
    },
    {
      "text": "Option C text",
      "is_correct": false,
      "explanation": "Detailed explanation for option C"
    },
    {
      "text": "Option D text",
      "is_correct": false,
      "explanation": "Detailed explanation for option D"
    },
    {
      "text": "Option E text",
      "is_correct": false,
      "explanation": "Detailed explanation for option E"
    }
  ],
  "teaching_point": "Key learning objective or teaching point",
  "question_references": "Relevant citations or references",
  "difficulty": "medium",
  "status": "draft"
}`;
}

// Helper function to sanitize JSON string by removing/escaping control characters
function sanitizeJSONString(jsonStr: string): string {
  return jsonStr
    // Replace unescaped newlines, tabs, and carriage returns with escaped versions
    .replace(/(?<!\\)\n/g, '\\n')
    .replace(/(?<!\\)\t/g, '\\t')
    .replace(/(?<!\\)\r/g, '\\r')
    // Remove other control characters that might break JSON parsing
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Fix common issues with quotes - be more careful here
    .replace(/\\"/g, '___ESCAPED_QUOTE___') // Temporarily replace escaped quotes
    .replace(/"/g, '\\"') // Escape all remaining quotes
    .replace(/___ESCAPED_QUOTE___/g, '\\"') // Restore escaped quotes
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
  } catch {
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
              return JSON.parse(sanitizeJSONString(jsonStr))
            } catch {
              // Try without sanitization as fallback
              try {
                return JSON.parse(jsonStr)
              } catch {
                console.log('[Admin AI] JSON parsing failed, trying next strategy')
                break
              }
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
      return JSON.parse(sanitizeJSONString(codeBlockMatch[1]))
    } catch {
      try {
        return JSON.parse(codeBlockMatch[1])
      } catch {
        console.log('[Admin AI] Code block JSON parsing failed')
      }
    }
  }

  // Strategy 3: Greedy match (fallback)
  const greedyMatch = cleanedText.match(/\{[\s\S]*\}/)
  if (greedyMatch) {
    try {
      return JSON.parse(sanitizeJSONString(greedyMatch[0]))
    } catch {
      try {
        return JSON.parse(greedyMatch[0])
      } catch {
        // Try to fix common JSON issues
        const fixedJson = greedyMatch[0]
          .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes to unquoted keys
          .replace(/:\s*'([^']*)'/g, ': "$1"') // Replace single quotes with double quotes
          .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
          .trim()

        try {
          return JSON.parse(sanitizeJSONString(fixedJson))
        } catch {
          try {
            return JSON.parse(fixedJson)
          } catch {
            console.error('[Admin AI] All JSON parsing strategies failed. Original response:', text.substring(0, 500))
            throw new Error('JSON parsing failed: Parse error')
          }
        }
      }
    }
  }

  console.error('[Admin AI] Failed to extract JSON. Response preview:', text.substring(0, 1000))
  throw new Error('No JSON found in AI response')
}

export async function POST(request: NextRequest) {
  try {
    const body: QuestionGenerationRequest = await request.json()
    const { mode = 'educational_content', content, currentQuestion, instructions, additionalContext = '', model } = body

    // Validate inputs based on mode
    if (mode === 'educational_content') {
      if (!content || !instructions) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields for educational_content mode: content, instructions' },
          { status: 400 }
        )
      }
    } else if (mode === 'refinement') {
      if (!currentQuestion || !instructions || !model) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields for refinement mode: currentQuestion, instructions, model' },
          { status: 400 }
        )
      }
    } else if (mode === 'metadata_suggestion') {
      if (!content || !content.title || !content.stem) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields for metadata_suggestion mode: content.title, content.stem' },
          { status: 400 }
        )
      }
    }

    // Use default model for educational content mode if not specified
    const selectedModel = model || 'Llama-3.3-8B-Instruct'

    // Validate model
    if (!ADMIN_AI_MODELS.includes(selectedModel)) {
      return NextResponse.json(
        { success: false, error: `Unsupported model: ${selectedModel}. Supported: ${ADMIN_AI_MODELS.join(', ')}` },
        { status: 400 }
      )
    }

    // Get API configuration
    const provider = getModelProvider(selectedModel)
    const apiKey = getApiKey(provider)

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: `No API key found for provider: ${provider}` },
        { status: 500 }
      )
    }

    console.log(`[Admin AI] Generating question using ${selectedModel} (${provider}) in ${mode} mode`)

    // Build the prompt based on mode
    const promptData = mode === 'refinement' ? currentQuestion : content
    const prompt = buildAdminQuestionPrompt(promptData, instructions, additionalContext, mode)

    // Call AI service
    const startTime = Date.now()
    const aiResponse = await callAIService(provider, prompt, selectedModel, apiKey)
    const generationTime = Date.now() - startTime

    console.log(`[Admin AI] Generated response in ${generationTime}ms`)
    console.log(`[Admin AI] Raw AI response (${mode} mode):`, aiResponse.content.substring(0, 500) + '...')

    // Parse the AI response
    const questionData = extractJSON(aiResponse.content)
    console.log(`[Admin AI] Extracted JSON (${mode} mode):`, JSON.stringify(questionData, null, 2))

    // Normalize options field - AI models sometimes use different field names despite our prompt
    // Accept question_options (preferred), answer_options, or options, then normalize to question_options
    if (!questionData.question_options && (questionData.answer_options || questionData.options)) {
      console.log('[Admin AI] Normalizing options field from:', questionData.answer_options ? 'answer_options' : 'options')
      questionData.question_options = questionData.answer_options || questionData.options
      // Clean up the old field
      delete questionData.answer_options
      delete questionData.options
    }

    // Validate the response structure based on mode
    if (mode === 'metadata_suggestion') {
      // For metadata suggestion, we expect different fields
      const hasMetadataFields = questionData.category_id || questionData.question_set_id || questionData.difficulty || questionData.suggested_tag_ids

      if (!hasMetadataFields) {
        console.error('[Admin AI] Metadata suggestion validation failed. Response structure:', {
          hasCategoryId: !!questionData.category_id,
          hasQuestionSetId: !!questionData.question_set_id,
          hasDifficulty: !!questionData.difficulty,
          hasSuggestedTagIds: !!questionData.suggested_tag_ids,
          actualKeys: Object.keys(questionData),
          mode: mode
        })
        throw new Error('AI response missing metadata fields. Expected at least one of: category_id, question_set_id, difficulty, suggested_tag_ids')
      }
    } else {
      // For question generation modes, validate question structure
      const hasRequiredFields = questionData.stem && questionData.question_options && Array.isArray(questionData.question_options)

      if (!hasRequiredFields) {
        console.error('[Admin AI] Validation failed. Response structure:', {
          hasTitle: !!questionData.title,
          hasStem: !!questionData.stem,
          hasQuestionOptions: !!questionData.question_options,
          hasAnswerOptions: !!questionData.answer_options,
          hasOptions: !!questionData.options,
          isQuestionOptionsArray: Array.isArray(questionData.question_options),
          actualKeys: Object.keys(questionData),
          mode: mode
        })
        throw new Error(`AI response missing required fields for ${mode} mode. Required: stem, question_options (array)`)
      }

      // For refinement mode, title is optional (can keep existing)
      if (mode === 'educational_content' && !questionData.title) {
        throw new Error('AI response missing title field (required for educational_content mode)')
      }

      if (questionData.question_options.length !== 5) {
        throw new Error('AI response must contain exactly 5 options')
      }

      const correctCount = questionData.question_options.filter((opt: any) => opt.is_correct).length
      if (correctCount !== 1) {
        throw new Error(`AI response must have exactly 1 correct answer, found ${correctCount}`)
      }
    }

    // Return the data in the format expected by the frontend
    let responseData: any

    if (mode === 'metadata_suggestion') {
      responseData = {
        category_id: questionData.category_id || null,
        question_set_id: questionData.question_set_id || null,
        difficulty: questionData.difficulty || null,
        suggested_tag_ids: questionData.suggested_tag_ids || []
      }
    } else {
      responseData = {
        title: questionData.title || (mode === 'refinement' ? 'Refined Question' : 'Generated Question'),
        stem: questionData.stem,
        answer_options: questionData.question_options || questionData.answer_options,
        teaching_point: questionData.teaching_point || '',
        question_references: questionData.question_references || questionData.references || '',
        difficulty: questionData.difficulty || 'medium',
        status: questionData.status || 'draft',
        suggested_tags: questionData.suggested_tags || []
      }
    }

    return NextResponse.json({
      success: true,
      ...responseData,
      metadata: {
        generated_at: new Date().toISOString(),
        generation_time_ms: generationTime,
        model: selectedModel,
        provider: provider,
        token_usage: aiResponse.tokenUsage,
        mode: mode
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