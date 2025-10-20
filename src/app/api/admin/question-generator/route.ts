import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { getApiKey, getModelProvider } from '@/shared/config/ai-models'

// Question generation schema for structured output
const QUESTION_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Brief descriptive title for the question"
    },
    stem: {
      type: "string", 
      description: "The question text with clinical scenario"
    },
    difficulty: {
      type: "string",
      enum: ["easy", "medium", "hard"],
      description: "Question difficulty level"
    },
    teaching_point: {
      type: "string",
      description: "Key learning objective or clinical pearl"
    },
    question_references: {
      type: "string",
      description: "Relevant medical references"
    },
    answer_options: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string", description: "Option text" },
          is_correct: { type: "boolean", description: "Whether this is the correct answer" },
          explanation: { type: "string", description: "Detailed explanation for this option" }
        },
        required: ["text", "is_correct", "explanation"]
      },
      minItems: 4,
      maxItems: 4,
      description: "Exactly 4 answer options"
    }
  },
  required: ["title", "stem", "difficulty", "teaching_point", "answer_options"]
}

// AI Service integrations with structured output support
async function callGroqAPI(model: string, prompt: string, apiKey: string) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are a medical education expert specializing in pathology. Generate high-quality multiple-choice questions following the exact JSON schema provided.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
      // Remove structured output - use proven prompt-based approach
    }),
  })

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content || 'No response generated'
  const tokenCount = data.usage?.total_tokens || 0
  
  return { content, tokenCount, usage: data.usage }
}

async function callGoogleAPI(model: string, prompt: string, apiKey: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
        // Remove structured output - use proven prompt-based approach
      }
    }),
  })

  if (!response.ok) {
    throw new Error(`Google API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated'
  const tokenCount = data.usageMetadata?.totalTokenCount || 0

  return { content, tokenCount, usage: data.usageMetadata }
}

async function callMistralAPI(model: string, prompt: string, apiKey: string) {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are a medical education expert. Generate pathology questions in valid JSON format only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
      // Remove structured output - use proven prompt-based approach
    }),
  })

  if (!response.ok) {
    throw new Error(`Mistral API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content || 'No response generated'
  const tokenCount = data.usage?.total_tokens || 0
  
  return { content, tokenCount, usage: data.usage }
}

async function callMetaAPI(model: string, prompt: string, apiKey: string) {
  const response = await fetch('https://api.llama.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are a medical education expert specializing in pathology. Generate high-quality multiple-choice questions following the exact JSON schema provided.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_completion_tokens: 1000,
      temperature: 0.7
      // Remove structured output - use proven prompt-based approach
    }),
  })

  if (!response.ok) {
    throw new Error(`Meta LLAMA API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  
  // Handle Meta LLAMA API response format
  let content = 'No response generated'
  
  if (data.completion_message?.content?.text) {
    content = data.completion_message.content.text
  } else if (data.choices?.[0]?.message?.content) {
    content = data.choices[0].message.content
  }
  
  const tokenCount = data.usage?.total_tokens || 0
  
  return { content, tokenCount, usage: data.usage }
}

// Robust JSON parser with multiple fallback strategies (from proven old system)
function parseQuestionJSON(content: string): any {
  console.log(`[JSON Parser] Raw content length: ${content.length}`)
  console.log(`[JSON Parser] Raw content (first 200 chars): ${content.substring(0, 200)}`)

  // Enhanced JSON extraction and cleaning (from old system)
  let jsonStr = ''

  // Try multiple JSON extraction strategies (proven from old system)
  const strategies = [
    // Strategy 1: Look for complete JSON object
    () => {
      const match = content.match(/\{[\s\S]*\}/)
      return match ? match[0] : null
    },
    // Strategy 2: Look for JSON between code blocks
    () => {
      const match = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
      return match ? match[1] : null
    },
    // Strategy 3: Look for JSON after specific markers
    () => {
      const match = content.match(/(?:json|JSON|response):\s*(\{[\s\S]*\})/)
      return match ? match[1] : null
    },
    // Strategy 4: Extract everything between first { and last }
    () => {
      const firstBrace = content.indexOf('{')
      const lastBrace = content.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return content.substring(firstBrace, lastBrace + 1)
      }
      return null
    }
  ]

  for (let i = 0; i < strategies.length; i++) {
    const extracted = strategies[i]()
    if (extracted) {
      jsonStr = extracted
      console.log(`[JSON Parser] JSON extracted using strategy ${i + 1}`)
      break
    }
  }

  if (!jsonStr) {
    throw new Error('No JSON found in AI response using any extraction strategy')
  }

  // Clean the JSON string (from old system)
  jsonStr = jsonStr
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
    .trim()

  console.log(`[JSON Parser] Cleaned JSON (first 200 chars): ${jsonStr.substring(0, 200)}`)

  // Parse with enhanced error handling (from old system)
  try {
    return JSON.parse(jsonStr)
  } catch (jsonError) {
    const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError)
    console.error(`[JSON Parser] JSON parse error: ${errorMessage}`)
    console.error(`[JSON Parser] Problematic JSON: ${jsonStr}`)

    // Try to fix common JSON issues (from old system)
    const fixedJson = jsonStr
      .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes to unquoted keys
      .replace(/:\s*'([^']*)'/g, ': "$1"') // Replace single quotes with double quotes
      .replace(/\\'/g, "'") // Fix escaped single quotes

    try {
      const result = JSON.parse(fixedJson)
      console.log('[JSON Parser] Successfully parsed JSON after fixing common issues')
      return result
    } catch (fixError) {
      const fixErrorMessage = fixError instanceof Error ? fixError.message : String(fixError)
      throw new Error(`JSON parsing failed even after attempted fixes: ${fixErrorMessage}`)
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin permissions
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || !userData || !['admin', 'creator'].includes(userData.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { model, context, instructions } = await request.json()

    if (!model || !context) {
      return NextResponse.json({ error: 'Model and context are required' }, { status: 400 })
    }

    // Get model provider and API key
    const provider = getModelProvider(model)
    const apiKey = getApiKey(provider)
    
    if (!apiKey) {
      return NextResponse.json({ error: `No API key available for ${provider}` }, { status: 500 })
    }

    // Build comprehensive prompt
    const prompt = `Create a high-quality medical/pathology multiple-choice question based on the following educational content:

**Educational Context:**
Category: ${context.category}
Subject: ${context.subject}
Lesson: ${context.lesson}
Topic: ${context.topic}

**Content:**
${JSON.stringify(context.content, null, 2)}

**Instructions:**
${instructions || 'Create a multiple-choice question with 4 options. Focus on key concepts and include detailed explanations for each option.'}

Generate a question following this exact JSON schema:
${JSON.stringify(QUESTION_SCHEMA, null, 2)}`

    const startTime = Date.now()
    
    // Call appropriate AI service
    let result
    switch (provider) {
      case 'llama':
        result = await callMetaAPI(model, prompt, apiKey)
        break
      case 'groq':
        result = await callGroqAPI(model, prompt, apiKey)
        break
      case 'google':
        result = await callGoogleAPI(model, prompt, apiKey)
        break
      case 'mistral':
        result = await callMistralAPI(model, prompt, apiKey)
        break
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }

    const responseTime = Date.now() - startTime

    // Parse the JSON response
    const questionData = parseQuestionJSON(result.content)

    // Validate required fields
    if (!questionData.title || !questionData.stem || !questionData.answer_options) {
      throw new Error('Generated question is missing required fields')
    }

    if (!Array.isArray(questionData.answer_options) || questionData.answer_options.length !== 4) {
      throw new Error('Question must have exactly 4 answer options')
    }

    const correctOptions = questionData.answer_options.filter((opt: any) => opt.is_correct)
    if (correctOptions.length !== 1) {
      throw new Error('Question must have exactly 1 correct answer')
    }

    // Add metadata and format for admin form
    const completeQuestion = {
      ...questionData,
      status: 'draft',
      question_set_id: '',
      category_id: '',
      answer_options: questionData.answer_options.map((option: any, index: number) => ({
        ...option,
        order_index: index
      })),
      question_images: [],
      tag_ids: [],
      metadata: {
        exported_at: new Date().toISOString(),
        exported_by: user.id,
        source_content: {
          category: context.category,
          subject: context.subject,
          lesson: context.lesson,
          topic: context.topic
        },
        generated_by: {
          provider: provider,
          model: model,
          response_time: responseTime,
          token_usage: result.usage
        }
      }
    }

    return NextResponse.json({
      success: true,
      question: completeQuestion,
      metadata: {
        model: model,
        provider: provider,
        response_time: responseTime,
        token_usage: result.usage
      }
    })

  } catch (error) {
    console.error('Question generation error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Question generation failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
