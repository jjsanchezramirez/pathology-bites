import { NextRequest, NextResponse } from 'next/server'
import { getApiKey, getModelProvider } from '@/shared/config/ai-models'

// WSI Question Generator fallback model sequence - Gemini and Mistral preferred
const WSI_FALLBACK_MODELS = [
  'gemini-2.0-flash',                       // Gemini 2.0 Flash (preferred)
  'mistral-small-2506',                     // Mistral Small 3.2 (preferred)
  'gemini-1.5-flash-8b',                    // Gemini 1.5 Flash 8B
  'mistral-small-2503',                     // Mistral Small 3.1
  'ministral-8b-2410',                      // Ministral 8B
  'Llama-3.3-8B-Instruct',                  // LLAMA 3.3 8B
  'gemini-2.5-flash-lite',                  // Gemini 2.5 Flash Lite
  'gemini-2.0-flash-lite',                  // Gemini 2.0 Flash Lite
  'ministral-3b-2410',                      // Ministral 3B
  'Llama-4-Maverick-17B-128E-Instruct-FP8'  // LLAMA 4 Maverick
]

// Types - Updated to handle both client-side and server-side WSI formats
interface VirtualSlide {
  id: string
  repository: string
  category: string
  subcategory: string
  diagnosis: string
  patient_info: string
  age: string | null
  gender: string | null
  clinical_history: string
  stain_type: string
  // Support both naming conventions for image URLs
  image_url?: string
  slide_url?: string
  case_url?: string
  thumbnail_url?: string
  preview_image_url?: string
  magnification?: string
  organ_system?: string
  difficulty_level?: string
  keywords?: string[]
  created_at?: string
  updated_at?: string
}

interface EducationalContent {
  category: string
  subject: string
  lesson: string
  topic: string
  content: any
}

interface QuestionOption {
  id: string
  text: string
  isCorrect: boolean
  explanation: string
}

interface QuestionData {
  id: string
  text: string
  type: 'multiple-choice'
  difficulty: 'easy' | 'medium' | 'hard'
  options: QuestionOption[]
  correctAnswer: string
  explanation: string
  imageUrl: string
  category: string
  subcategory: string
  learningObjectives: string[]
  tags: string[]
  estimatedTime: number
  metadata: {
    wsi_id: string
    diagnosis: string
    stain_type: string
    magnification: string
    patient_info: string
    clinical_history: string
    hasContext: boolean
    contextSource?: string
  }
}

// Normalize WSI object to handle both client-side and server-side formats
function normalizeWSI(wsi: VirtualSlide): VirtualSlide {
  return {
    ...wsi,
    // Ensure image_url is available (prefer slide_url, then case_url, then image_url)
    image_url: wsi.image_url || wsi.slide_url || wsi.case_url || '',
    // Ensure thumbnail_url is available (prefer preview_image_url, then thumbnail_url)
    thumbnail_url: wsi.thumbnail_url || wsi.preview_image_url || '',
    // Ensure other optional fields have defaults
    magnification: wsi.magnification || 'Not specified',
    organ_system: wsi.organ_system || 'Not specified',
    difficulty_level: wsi.difficulty_level || 'medium',
    keywords: wsi.keywords || [],
    created_at: wsi.created_at || new Date().toISOString(),
    updated_at: wsi.updated_at || new Date().toISOString()
  }
}

// SEPARATED LLM QUESTION GENERATION FUNCTION
async function generateQuestionWithLLM(wsi: VirtualSlide, context: EducationalContent | null, modelId?: string): Promise<{ questionData: QuestionData; debug: any; modelUsed: string; tokenUsage?: any }> {
  const startTime = Date.now()

  // Normalize WSI object to handle field name differences
  const normalizedWSI = normalizeWSI(wsi)

  console.log(`[LLM Question Gen] Starting LLM generation for: ${normalizedWSI.diagnosis}`)
  console.log(`[LLM Question Gen] Image URL: ${normalizedWSI.image_url}`)
  console.log(`[LLM Question Gen] Repository: ${normalizedWSI.repository}`)

  // Validate required fields
  if (!normalizedWSI.image_url) {
    throw new Error('No valid image URL found in WSI object (checked image_url, slide_url, case_url)')
  }

  // Build comprehensive prompt
  const prompt = buildQuestionPrompt(normalizedWSI, context)
  console.log(`[LLM Question Gen] Prompt length: ${prompt.length} characters`)

  try {
    // Get model provider and API key
    const modelProvider = getModelProvider(modelId || WSI_FALLBACK_MODELS[0])
    const apiKey = getApiKey(modelProvider)

    if (!apiKey) {
      throw new Error(`No API key found for provider: ${modelProvider}`)
    }

    let response
    let modelUsed = modelId || WSI_FALLBACK_MODELS[0]
    let tokenUsage = null

    // Call appropriate AI service based on provider
    let apiResponse: { content: string; tokenUsage?: any }
    switch (modelProvider) {
      case 'groq':
        apiResponse = await callGroqAPI(prompt, modelUsed, apiKey)
        break
      case 'google':
        apiResponse = await callGoogleAPI(prompt, modelUsed, apiKey)
        break
      case 'mistral':
        apiResponse = await callMistralAPI(prompt, modelUsed, apiKey)
        break
      default:
        throw new Error(`Unsupported model provider: ${modelProvider}`)
    }
    
    response = apiResponse.content
    tokenUsage = apiResponse.tokenUsage

    // Parse and validate response using normalized WSI
    const questionData = parseAndValidateQuestion(response, normalizedWSI)
    
    const generationTime = Date.now() - startTime
    console.log(`[LLM Question Gen] Question generated successfully in ${generationTime}ms`)

    return {
      questionData,
      debug: {
        prompt_length: prompt.length,
        response_length: response.length,
        model_provider: modelProvider,
        generation_time_ms: generationTime
      },
      modelUsed,
      tokenUsage
    }

  } catch (error) {
    const generationTime = Date.now() - startTime
    console.error(`[LLM Question Gen] Error generating question (${generationTime}ms):`, error)
    throw error
  }
}

// Build the comprehensive prompt for question generation
function buildQuestionPrompt(wsi: VirtualSlide, context: EducationalContent | null): string {
  const contextInfo = context
    ? `Educational Context: ${context.topic}\nFrom: ${context.subject} > ${context.lesson}\nContent: ${JSON.stringify(context.content, null, 2)}`
    : 'No specific educational context available.'

  return `You are an expert pathologist creating educational multiple-choice questions for medical students and residents.

WSI Information:
- Diagnosis: ${wsi.diagnosis}
- Category: ${wsi.category}
- Subcategory: ${wsi.subcategory}
- Patient: ${wsi.patient_info}
- Age: ${wsi.age || 'Not specified'}
- Gender: ${wsi.gender || 'Not specified'}
- Clinical History: ${wsi.clinical_history}
- Stain: ${wsi.stain_type}
- Magnification: ${wsi.magnification || 'Not specified'}
- Organ System: ${wsi.organ_system || 'Not specified'}
- Repository: ${wsi.repository}

${contextInfo}

🚨 ABSOLUTELY CRITICAL - READ CAREFULLY: Histologic images are provided with this question. You are STRICTLY FORBIDDEN from describing microscopic findings, cellular features, tissue architecture, staining patterns, or any histologic details. DO NOT use phrases like "histologic examination reveals", "microscopic findings show", "the biopsy demonstrates", "cells are arranged", "tissue shows", or any similar descriptions of what would be seen under the microscope. Instead, you MUST reference the images as "the histologic images shown" or "the images below" and focus ONLY on clinical correlation, diagnostic reasoning, and differential diagnosis. The reader can see the images themselves.

Create a high-quality multiple-choice question based on this WSI. The question should:
1. STRICTLY AVOID describing any microscopic or histologic appearance
2. Focus on clinical correlation, diagnosis, management, prognosis, or significance
3. Remember this is likely H&E staining only (no immunohistochemistry or special stains available)
4. Be clinically relevant and educationally valuable
5. Test understanding of the diagnosis, differential diagnosis, clinical significance, or management
6. Have exactly 5 options (A, B, C, D, E)
7. Include explanations that reference what can be observed in the provided images without describing it
8. Be appropriate for medical students/residents
9. Ensure the question stem, answer choices, explanations, and teaching point all coherently relate to each other
10. If additional clinical information beyond the histology is necessary for the question, provide it in the stem

Return your response as a valid JSON object with this exact structure:
{
  "question": "Clinical scenario or question stem that assumes the user can analyze the provided histologic image. Include relevant clinical context if needed.",
  "options": [
    {"id": "A", "text": "Diagnostic or management option A", "isCorrect": false, "explanation": "Why this is incorrect, referencing what they should observe in the histology"},
    {"id": "B", "text": "Diagnostic or management option B", "isCorrect": true, "explanation": "Why this is correct, explaining the key histologic features that support this diagnosis"},
    {"id": "C", "text": "Diagnostic or management option C", "isCorrect": false, "explanation": "Why this is incorrect, explaining how the histology differs from this option"},
    {"id": "D", "text": "Diagnostic or management option D", "isCorrect": false, "explanation": "Why this is incorrect, referencing distinguishing histologic features"},
    {"id": "E", "text": "Diagnostic or management option E", "isCorrect": false, "explanation": "Why this is incorrect, explaining the histologic differences"}
  ],
  "explanation": "Comprehensive teaching point that ties together the clinical scenario, histologic findings, and diagnosis",
  "difficulty": "medium",
  "learningObjectives": ["Key learning point 1", "Key learning point 2", "Key learning point 3"],
  "tags": ["relevant-tag1", "relevant-tag2", "relevant-tag3"]
}`
}

// API call functions with token usage tracking
async function callGroqAPI(prompt: string, model: string, apiKey: string): Promise<{ content: string; tokenUsage?: any }> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4000
    })
  })

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return {
    content: data.choices[0].message.content,
    tokenUsage: data.usage ? {
      prompt_tokens: data.usage.prompt_tokens,
      completion_tokens: data.usage.completion_tokens,
      total_tokens: data.usage.total_tokens
    } : undefined
  }
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
    content: data.candidates[0].content.parts[0].text,
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
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4000
    })
  })

  if (!response.ok) {
    throw new Error(`Mistral API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return {
    content: data.choices[0].message.content,
    tokenUsage: data.usage ? {
      prompt_tokens: data.usage.prompt_tokens,
      completion_tokens: data.usage.completion_tokens,
      total_tokens: data.usage.total_tokens
    } : undefined
  }
}

// Parse and validate the AI response
function parseAndValidateQuestion(response: string, wsi: VirtualSlide): QuestionData {
  try {
    // Clean response - remove any markdown code blocks if present
    let cleanResponse = response.trim()
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    const parsed = JSON.parse(cleanResponse)

    // Validate required fields (now expecting 5 options)
    if (!parsed.question || !parsed.options || !Array.isArray(parsed.options) || parsed.options.length !== 5) {
      console.error('[LLM Question Gen] Invalid question format:', {
        hasQuestion: !!parsed.question,
        hasOptions: !!parsed.options,
        isOptionsArray: Array.isArray(parsed.options),
        optionsLength: parsed.options?.length
      })
      throw new Error('Invalid question format from AI - missing required fields or incorrect structure (expected 5 options)')
    }

    // Find correct answer
    const correctOption = parsed.options.find((opt: any) => opt.isCorrect)
    if (!correctOption) {
      console.error('[LLM Question Gen] No correct answer found in options:', parsed.options)
      throw new Error('No correct answer found in options')
    }

    // Validate image URL is available
    const imageUrl = wsi.image_url || wsi.slide_url || wsi.case_url
    if (!imageUrl) {
      console.error('[LLM Question Gen] No valid image URL found in WSI:', {
        image_url: wsi.image_url,
        slide_url: wsi.slide_url,
        case_url: wsi.case_url
      })
      throw new Error('No valid image URL found in WSI object')
    }

    // Build final question data
    const questionData: QuestionData = {
      id: `wsi-${wsi.id}-${Date.now()}`,
      text: parsed.question,
      type: 'multiple-choice',
      difficulty: parsed.difficulty || 'medium',
      options: parsed.options,
      correctAnswer: correctOption.id,
      explanation: parsed.explanation || 'Explanation not provided.',
      imageUrl: imageUrl,
      category: wsi.category,
      subcategory: wsi.subcategory,
      learningObjectives: parsed.learningObjectives || [],
      tags: parsed.tags || [],
      estimatedTime: 2,
      metadata: {
        wsi_id: wsi.id,
        diagnosis: wsi.diagnosis,
        stain_type: wsi.stain_type,
        magnification: wsi.magnification || 'Not specified',
        patient_info: wsi.patient_info,
        clinical_history: wsi.clinical_history,
        hasContext: !!wsi,
        contextSource: wsi.repository
      }
    }

    console.log('[LLM Question Gen] Successfully parsed and validated question')
    return questionData

  } catch (error) {
    console.error('[LLM Question Gen] Error parsing AI response:', error)
    console.error('[LLM Question Gen] Raw response:', response.substring(0, 500) + '...')
    throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// MAIN ENDPOINT - SEPARATED LLM GENERATION ONLY
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log('[LLM Question Gen] Starting separated LLM question generation')

    // Parse request body
    const body = await request.json()
    const { wsi, context, modelIndex = 0 } = body

    if (!wsi) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: wsi'
        },
        { status: 400 }
      )
    }

    // Log incoming WSI structure for debugging
    console.log('[LLM Question Gen] Received WSI structure:', {
      id: wsi.id,
      diagnosis: wsi.diagnosis,
      repository: wsi.repository,
      hasImageUrl: !!wsi.image_url,
      hasSlideUrl: !!wsi.slide_url,
      hasCaseUrl: !!wsi.case_url,
      hasThumbnailUrl: !!wsi.thumbnail_url,
      hasPreviewImageUrl: !!wsi.preview_image_url
    })

    // Log context structure for debugging
    console.log('[LLM Question Gen] Received context:', {
      hasContext: !!context,
      contextType: context ? typeof context : 'null',
      contextKeys: context ? Object.keys(context) : []
    })

    // Validate modelIndex
    if (modelIndex >= WSI_FALLBACK_MODELS.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'All fallback models have been exhausted',
          nextModelIndex: null,
          availableModels: WSI_FALLBACK_MODELS.length
        },
        { status: 400 }
      )
    }

    const selectedModel = WSI_FALLBACK_MODELS[modelIndex]
    console.log(`[LLM Question Gen] Generating question using model ${modelIndex + 1}/${WSI_FALLBACK_MODELS.length}: ${selectedModel}`)

    try {
      // Generate question using AI with specific model (SEPARATED LLM CALL)
      const questionResult = await generateQuestionWithLLM(wsi, context, selectedModel)

      const generationTime = Date.now() - startTime
      console.log(`[LLM Question Gen] LLM question generation completed in ${generationTime}ms`)

      const result = {
        success: true,
        question: questionResult.questionData,
        metadata: {
          generated_at: new Date().toISOString(),
          generation_time_ms: generationTime,
          model: questionResult.modelUsed,
          model_index: modelIndex,
          debug: questionResult.debug,
          token_usage: questionResult.tokenUsage
        }
      }

      return NextResponse.json(result, { 
        status: 200,
        headers: {
          'Cache-Control': 'no-cache', // Don't cache LLM generations
          'X-Generation-Time': generationTime.toString()
        }
      })

    } catch (modelError) {
      console.error(`[LLM Question Gen] Model ${selectedModel} failed:`, modelError)

      // Log detailed error information for debugging
      console.error(`[LLM Question Gen] Error details:`, {
        modelIndex,
        selectedModel,
        errorMessage: modelError instanceof Error ? modelError.message : 'Unknown error',
        errorStack: modelError instanceof Error ? modelError.stack : undefined,
        wsiId: wsi.id,
        wsiDiagnosis: wsi.diagnosis,
        hasContext: !!context
      })

      // Return error with next model suggestion
      const nextModelIndex = modelIndex + 1
      const hasNextModel = nextModelIndex < WSI_FALLBACK_MODELS.length

      return NextResponse.json(
        {
          success: false,
          error: `Model ${selectedModel} failed: ${modelError instanceof Error ? modelError.message : 'Unknown error'}`,
          nextModelIndex: hasNextModel ? nextModelIndex : null,
          nextModel: hasNextModel ? WSI_FALLBACK_MODELS[nextModelIndex] : null,
          modelError: true,
          debug: {
            originalError: modelError instanceof Error ? modelError.message : 'Unknown error',
            modelIndex,
            selectedModel,
            wsiId: wsi.id
          }
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('[LLM Question Gen] Error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate question',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}