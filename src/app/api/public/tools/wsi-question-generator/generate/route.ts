import { NextRequest, NextResponse } from 'next/server'
import { getApiKey, getModelProvider } from '@/shared/config/ai-models'
import { VirtualSlide } from '@/shared/types/virtual-slides'

// WSI Question Generator fallback models - optimized for speed and quality
const WSI_FALLBACK_MODELS = [
  // Tier 1: FASTEST - Prioritize speed for better UX
  'Llama-3.3-8B-Instruct',                  // 394ms - FASTEST, excellent quality
  'ministral-8b-2410',                      // 596ms - Fast Mistral model
  'mistral-small-2501',                     // 790ms - Latest small Mistral
  'gemini-2.0-flash',                       // 829ms - Good balance

  // Tier 2: BALANCED - Good speed + capability
  'Llama-4-Scout-17B-16E-Instruct-FP8',     // 1063ms - Latest multimodal + medical reasoning
  'mistral-medium-2505',                    // 1311ms - Best balance of capability/volume

  // Tier 3: POWERFUL - Slower but high quality
  'Llama-3.3-70B-Instruct',                 // 1788ms - Proven large model performance
  'Llama-4-Maverick-17B-128E-Instruct-FP8', // 1917ms - Complex reasoning powerhouse

  // Tier 4: PREMIUM - Highest quality but slowest
  'gemini-2.5-flash',                       // 3765ms - Best quality (but slow)
  'gemini-2.5-pro'                          // Premium reasoning (slowest)
]

// Retry configuration for transient errors
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 8000,  // 8 seconds
  backoffMultiplier: 2
}

// Enhanced error classification for retry vs fallback decisions
function classifyError(error: any): 'retryable' | 'fallback' | 'fatal' {
  const errorStr = typeof error === 'string' ? error : (error instanceof Error ? error.message : String(error))
  const lowerError = errorStr.toLowerCase()

  // Retryable errors (same model): transient issues that might resolve quickly
  if (lowerError.includes('503') ||
      lowerError.includes('service unavailable') ||
      lowerError.includes('timeout') ||
      lowerError.includes('network') ||
      lowerError.includes('rate limit') ||
      lowerError.includes('too many requests') ||
      lowerError.includes('temporary') ||
      lowerError.includes('try again')) {
    return 'retryable'
  }

  // Fallback errors (next model): fundamental issues with current model
  if (lowerError.includes('401') ||
      lowerError.includes('unauthorized') ||
      lowerError.includes('invalid api key') ||
      lowerError.includes('token limit') ||
      lowerError.includes('context length') ||
      lowerError.includes('model not found') ||
      lowerError.includes('quota exceeded') ||
      lowerError.includes('billing')) {
    return 'fallback'
  }

  // Default to fallback for unknown errors (conservative approach)
  return 'fallback'
}

// Sleep utility for retry delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Calculate retry delay with exponential backoff
function getRetryDelay(attempt: number): number {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt)
  return Math.min(delay, RETRY_CONFIG.maxDelay)
}

// Shuffle answer options to randomize correct answer position
function shuffleOptions(options: QuestionOption[]): QuestionOption[] {
  const shuffled = [...options]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Types

interface QuestionOption {
  id: string
  text: string
  is_correct?: boolean
  isCorrect?: boolean
  explanation: string
  order_index?: number
}

interface QuestionData {
  title?: string
  stem?: string
  question?: string
  question_options: QuestionOption[]
  references?: string[]
  teaching_point?: string
  explanation?: string
  difficulty?: string
  learningObjectives?: string[]
  tags?: string[]
  suggested_tags?: string[]
  status?: string
}

// Normalize WSI object to handle both client-side and server-side formats
function normalizeWSI(wsi: VirtualSlide): VirtualSlide {
  return {
    ...wsi,
    // Ensure image_url is available (prefer slide_url, then case_url, then image_url)
    image_url: wsi.image_url || wsi.slide_url || wsi.case_url || ''
  }
}

// API call functions with token usage tracking
async function callMetaAPI(prompt: string, model: string, apiKey: string): Promise<{ content: string; tokenUsage?: any }> {
  // Add AbortController for timeout
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
            content: 'You are an expert pathologist and medical educator creating high-quality board-style multiple-choice questions for medical students and residents. Create clinically relevant questions that test diagnostic reasoning, not just memorization. Focus on clinical correlation, differential diagnosis, and educational value. Always provide detailed explanations that include both clinical and histopathological reasoning.'
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
  
  // Debug logging for Meta LLAMA API response
  console.log('[Meta API] Full response keys:', Object.keys(data))
  console.log('[Meta API] Usage data:', data.usage)
  console.log('[Meta API] Token usage data:', data.token_usage)
  console.log('[Meta API] Completion message:', data.completion_message)
  console.log('[Meta API] Looking for any field containing "token" or "usage":', 
    Object.keys(data).filter(key => 
      key.toLowerCase().includes('token') || 
      key.toLowerCase().includes('usage') ||
      key.toLowerCase().includes('count')
    )
  )
  
  // Handle Meta LLAMA API response format
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
  
  console.log('[Meta API] Extracted token usage:', tokenUsage)
  
  // If no token usage found, create estimated usage for testing
  if (!tokenUsage && content) {
    const systemPrompt = 'You are an expert pathologist and medical educator creating high-quality board-style multiple-choice questions for medical students and residents. Create clinically relevant questions that test diagnostic reasoning, not just memorization. Focus on clinical correlation, differential diagnosis, and educational value. Always provide detailed explanations that include both clinical and histopathological reasoning.'
    const totalPromptLength = systemPrompt.length + prompt.length
    const estimatedPromptTokens = Math.ceil(totalPromptLength / 4) // Rough estimate: 4 chars per token
    const estimatedCompletionTokens = Math.ceil(content.length / 4)
    tokenUsage = {
      prompt_tokens: estimatedPromptTokens,
      completion_tokens: estimatedCompletionTokens,
      total_tokens: estimatedPromptTokens + estimatedCompletionTokens
    }
    console.log('[Meta API] Created estimated token usage:', tokenUsage)
  }
  
  return {
    content: content || '',
    tokenUsage
  }
}

async function callGroqAPI(prompt: string, model: string, apiKey: string): Promise<{ content: string; tokenUsage?: any }> {
  // Add AbortController for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4000
      })
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status} ${response.statusText}`)
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
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Groq API timeout after 15 seconds')
    }
    throw error
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
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    tokenUsage: data.usageMetadata ? {
      prompt_tokens: data.usageMetadata.promptTokenCount || 0,
      completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata.totalTokenCount || 0
    } : undefined
  }
}

// Fast AI service dispatcher - eliminates switch statement overhead
async function callAIService(provider: string, prompt: string, modelId: string, apiKey: string): Promise<{ content: string; tokenUsage?: any }> {
  switch (provider) {
    case 'llama':
      return await callMetaAPI(prompt, modelId, apiKey)
    case 'groq':
      return await callGroqAPI(prompt, modelId, apiKey)
    case 'google':
      return await callGoogleAPI(prompt, modelId, apiKey)
    case 'mistral':
      return await callMistralAPI(prompt, modelId, apiKey)
    default:
      throw new Error(`Unsupported model provider: ${provider}`)
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
    content: data.choices[0]?.message?.content || '',
    tokenUsage: data.usage ? {
      prompt_tokens: data.usage.prompt_tokens,
      completion_tokens: data.usage.completion_tokens,
      total_tokens: data.usage.total_tokens
    } : undefined
  }
}

// Build streamlined prompt for pathology question generation
function buildQuestionPrompt(wsi: VirtualSlide, context: Record<string, unknown> | null): string {
  // Extract only key information from WSI data
  const keyInfo = {
    chapter: wsi.category || 'Not specified',
    organ: wsi.subcategory || 'Not specified',
    diagnosis: wsi.diagnosis || 'Not specified',
    // Note: WSI data typically doesn't have differential, immunoprofile, or molecular info
    // These would need to be added to WSI metadata if available
    differential: wsi.source_metadata?.differential || null,
    immunoprofile: wsi.source_metadata?.immunoprofile || null,
    molecular: wsi.source_metadata?.molecular || null
  }

  const contextInfo = context
    ? `Educational Context: ${context.topic}\nFrom: ${context.subject} > ${context.lesson}`
    : 'No specific educational context available.'

  return `Create a board-style pathology question using ONLY the following key information:

CASE INFORMATION:
Chapter: ${keyInfo.chapter}
Organ: ${keyInfo.organ}
Diagnosis: ${keyInfo.diagnosis}
Patient Age: ${wsi.age || 'Adult'}
Patient Gender: ${wsi.gender || 'Not specified'}

${contextInfo}

CRITICAL INSTRUCTIONS:
1. DO NOT include histologic/microscopic descriptions in the question stem (the WSI image will show this)
2. DO NOT make the diagnosis obvious in the question stem
3. Create a clinical scenario that requires the reader to examine the slide to answer
4. Focus on clinical presentation, demographics, and relevant clinical context
5. Use your knowledge of differential diagnoses to create plausible distractors
6. Make this a challenging but fair board-style question
7. End the question stem with "What is the most likely diagnosis?"

Requirements:
1. Create a clinically relevant scenario-based question
2. Include exactly 5 answer choices with one clearly correct answer
3. Provide detailed explanations for each choice that include BOTH clinical correlation AND histological features
4. Ensure the question tests understanding, not just memorization
5. Use appropriate medical terminology
6. Make the question challenging but fair
7. Suggest 2-4 relevant medical/pathology tags that categorize this question
8. Answer explanations must describe key histologic features and their clinical significance

Return the response in this exact JSON format:
{
  "title": "Brief descriptive title",
  "stem": "Clinical scenario and question ending with 'What is the most likely diagnosis?'",
  "difficulty": "easy|medium|hard",
  "teaching_point": "Concise 1-2 sentence key learning point about [specific concept being tested].",
  "suggested_tags": ["Tag1", "Tag2", "Tag3"],
  "question_references": "Relevant citations",
  "status": "draft",
  "question_options": [
    {
      "text": "Answer choice 1 text",
      "is_correct": false,
      "explanation": "Clinical and histological explanation - describe why this diagnosis is incorrect based on clinical presentation and microscopic features seen in the slide",
      "order_index": 0
    },
    {
      "text": "Answer choice 2 text",
      "is_correct": false,
      "explanation": "Clinical and histological explanation - describe why this diagnosis is incorrect, mentioning both clinical factors and the histological features that rule it out",
      "order_index": 1
    },
    {
      "text": "Answer choice 3 text (correct answer)",
      "is_correct": true,
      "explanation": "Clinical and histological explanation (correct answer) - explain why this is the correct diagnosis based on the clinical scenario AND the specific histologic features visible in the WSI slide",
      "order_index": 2
    },
    {
      "text": "Answer choice 4 text",
      "is_correct": false,
      "explanation": "Clinical and histological explanation - explain the clinical and microscopic differences that distinguish this from the correct diagnosis",
      "order_index": 3
    },
    {
      "text": "Answer choice 5 text",
      "is_correct": false,
      "explanation": "Clinical and histological explanation - describe the clinical presentation and histologic appearance that would be expected for this diagnosis and how it differs from what is shown",
      "order_index": 4
    }
  ]
}`
}



// Set timeout for WSI question generation to prevent 504 errors
export const maxDuration = 45 // 45 seconds timeout (longer than diagnostic search due to AI complexity)

// Fast WSI preprocessing - Extract and validate required data upfront
function preprocessWSI(wsi: VirtualSlide): { normalizedWSI: VirtualSlide; isValid: boolean; error?: string } {
  const normalizedWSI = normalizeWSI(wsi)
  
  if (!normalizedWSI.image_url) {
    return {
      normalizedWSI,
      isValid: false,
      error: 'No valid image URL found in WSI object (checked image_url, slide_url, case_url)'
    }
  }
  
  return { normalizedWSI, isValid: true }
}

// Fast prompt builder - Pre-compute prompt structure
function buildOptimizedPrompt(normalizedWSI: VirtualSlide, context: any | null = null, customPrompt?: string): string {
  if (customPrompt) return customPrompt
  return buildQuestionPrompt(normalizedWSI, context)
}

// Enhanced question generation with retry logic for each model
async function generateQuestionWithRetries(wsi: VirtualSlide, modelId: string, context: any | null = null, customPrompt?: string): Promise<{ questionData: QuestionData; debug: any; modelUsed: string; tokenUsage?: any; retryInfo?: any }> {
  let lastError: any = null
  let retryInfo = { attempts: 0, totalTime: 0, retries: 0 }
  const startTime = Date.now()

  // Fast preprocessing - do validation and normalization upfront
  const { normalizedWSI, isValid, error } = preprocessWSI(wsi)
  if (!isValid) {
    throw new Error(error)
  }

  // Fast prompt building - pre-compute once
  const prompt = buildOptimizedPrompt(normalizedWSI, context, customPrompt)

  // Try the specified model with retries for transient errors
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    retryInfo.attempts = attempt + 1

    try {
      if (attempt === 0) {
        console.log(`[Question Gen] Starting generation with model: ${modelId}`)
      } else {
        console.log(`[Question Gen] Retry ${attempt}/${RETRY_CONFIG.maxRetries} for model: ${modelId}`)
        retryInfo.retries = attempt
      }

      const result = await generateQuestionSingle(normalizedWSI, modelId, prompt)
      retryInfo.totalTime = Date.now() - startTime

      if (attempt === 0) {
        console.log(`[Question Gen] ✅ Success on first attempt with ${modelId} in ${retryInfo.totalTime}ms`)
      } else {
        console.log(`[Question Gen] ✅ Success after ${attempt} retries with ${modelId} in ${retryInfo.totalTime}ms`)
      }

      return { ...result, retryInfo }

    } catch (error) {
      lastError = error
      const errorType = classifyError(error)

      console.warn(`[Question Gen] Attempt ${attempt + 1} failed (${errorType}):`, error instanceof Error ? error.message : error)

      // If error is not retryable, stop trying this model
      if (errorType !== 'retryable') {
        console.log(`[Question Gen] ${errorType} error - stopping retries for ${modelId}`)
        break
      }

      // If retryable and not the last attempt, wait before retrying
      if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = getRetryDelay(attempt)
        console.log(`[Question Gen] Retrying ${modelId} in ${delay}ms...`)
        await sleep(delay)
      } else {
        console.log(`[Question Gen] Max retries reached for ${modelId}`)
      }
    }
  }

  // All retries exhausted for this model
  retryInfo.totalTime = Date.now() - startTime
  throw lastError || new Error(`Model ${modelId} failed after ${RETRY_CONFIG.maxRetries} retries`)
}

// Fast API configuration lookup
function getAPIConfig(modelId: string): { provider: string; apiKey: string } {
  const provider = getModelProvider(modelId)
  const apiKey = getApiKey(provider)
  
  if (!apiKey) {
    throw new Error(`No API key found for model: ${modelId}`)
  }
  
  return { provider, apiKey }
}

// Single question generation attempt (no retries) - optimized
async function generateQuestionSingle(wsi: VirtualSlide, modelId: string, prompt: string): Promise<{ questionData: QuestionData; debug: any; modelUsed: string; tokenUsage?: any }> {
  // Fast config lookup
  const { provider, apiKey } = getAPIConfig(modelId)

  console.log(`[Question Gen] Using model: ${modelId} (${provider})`)

  let apiResponse: { content: string; tokenUsage?: any }

  // Fast AI service dispatch - use computed provider directly
  apiResponse = await callAIService(provider, prompt, modelId, apiKey)

  console.log(`[Question Gen] AI service response received`)
  console.log(`[Question Gen] Token usage from AI service:`, apiResponse.tokenUsage)

  const tokenUsage = apiResponse.tokenUsage || null
  const generatedText = apiResponse.content

  if (!generatedText) {
    throw new Error('No content received from AI service')
  }

  console.log('[Question Gen] Parsing AI response...')

  // Fast parsing and validation
  const questionData = parseAndValidateQuestionFast(generatedText)

  return {
    questionData,
    debug: {
      prompt_length: prompt.length,
      response_length: generatedText.length,
      model_provider: provider,
      raw_response: generatedText.substring(0, 1000)
    },
    modelUsed: modelId,
    tokenUsage
  }
}

// Fast JSON extraction - optimized for performance
function extractJSONFast(response: string): string | null {
  // Strategy 1: Smart brace counting (most common case)
  const firstBrace = response.indexOf('{')
  if (firstBrace === -1) return null
  
  let braceCount = 0
  let i = firstBrace
  let inString = false
  let escapeNext = false
  
  while (i < response.length) {
    const char = response[i]
    
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
          return response.substring(firstBrace, i + 1)
        }
      }
    }
    i++
  }
  
  // Fallback strategies
  const match = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (match) return match[1]
  
  const greedy = response.match(/\{[\s\S]*\}/)
  return greedy ? greedy[0] : null
}

// Fast question parsing - optimized validation
function parseAndValidateQuestionFast(response: string): QuestionData {
  console.log(`[Question Gen] Fast parsing AI response (${response.length} chars)`)
  
  // Fast JSON extraction
  const jsonStr = extractJSONFast(response)
  if (!jsonStr) {
    throw new Error('No JSON found in AI response using fast extraction')
  }

  // Fast JSON cleanup
  const cleanedJson = jsonStr
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
    .trim()

  // Fast parsing with error handling
  let parsedQuestion: unknown
  try {
    parsedQuestion = JSON.parse(cleanedJson)
  } catch (jsonError) {
    // Quick fix for common issues
    const fixedJson = cleanedJson
      .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes to keys
      .replace(/:\s*'([^']*)'/g, ': "$1"') // Fix quotes
    
    try {
      parsedQuestion = JSON.parse(fixedJson)
    } catch {
      throw new Error(`JSON parsing failed: ${jsonError instanceof Error ? jsonError.message : 'Parse error'}`)
    }
  }

  // Fast validation and normalization
  return validateAndNormalizeQuestionFast(parsedQuestion as Record<string, unknown>)
}

// Fast question validation - streamlined checks
function validateAndNormalizeQuestionFast(questionObj: Record<string, unknown>): QuestionData {
  const normalizedQuestion: QuestionData = {
    question_options: []
  }

  // Fast field extraction
  normalizedQuestion.title = typeof questionObj.title === 'string' ? questionObj.title : undefined
  normalizedQuestion.stem = typeof questionObj.stem === 'string' ? questionObj.stem : ''
  normalizedQuestion.difficulty = typeof questionObj.difficulty === 'string' ? questionObj.difficulty : 'medium'
  normalizedQuestion.teaching_point = typeof questionObj.teaching_point === 'string' ? questionObj.teaching_point : undefined
  normalizedQuestion.suggested_tags = Array.isArray(questionObj.suggested_tags) ? questionObj.suggested_tags.map(String) : []
  normalizedQuestion.status = typeof questionObj.status === 'string' ? questionObj.status : 'draft'

  // Fast reference handling
  if (typeof questionObj.question_references === 'string') {
    normalizedQuestion.references = [questionObj.question_references]
  } else if (Array.isArray(questionObj.references)) {
    normalizedQuestion.references = questionObj.references.map(String)
  } else {
    normalizedQuestion.references = ['Robbins and Cotran Pathologic Basis of Disease, 10th ed']
  }

  // Fast validation checks
  if (!normalizedQuestion.stem) {
    throw new Error('No question stem found in AI response')
  }

  // Normalize options field - AI models sometimes use different field names despite our prompt
  // Accept question_options (preferred), answer_options, or options
  if (!questionObj.question_options && (questionObj.answer_options || questionObj.options)) {
    questionObj.question_options = questionObj.answer_options || questionObj.options
  }

  // Validate and process question options
  if (!Array.isArray(questionObj.question_options) || questionObj.question_options.length < 4) {
    throw new Error('Invalid or insufficient question options in AI response')
  }

  normalizedQuestion.question_options = questionObj.question_options.map((opt: unknown, index: number) => {
    if (typeof opt === 'object' && opt !== null) {
      const optObj = opt as Record<string, unknown>
      return {
        id: (typeof optObj.id === 'string' ? optObj.id : String.fromCharCode(65 + index)),
        text: String(optObj.text || ''),
        is_correct: Boolean(optObj.is_correct),
        explanation: String(optObj.explanation || ''),
        order_index: typeof optObj.order_index === 'number' ? optObj.order_index : index
      }
    }
    return {
      id: String.fromCharCode(65 + index),
      text: String(opt),
      is_correct: false,
      explanation: '',
      order_index: index
    }
  })

  // Fast correctness validation
  const correctCount = normalizedQuestion.question_options.filter(opt => opt.is_correct).length
  if (correctCount !== 1) {
    throw new Error(`Expected exactly 1 correct answer, found ${correctCount}`)
  }

  console.log(`[Question Gen] Fast validation completed: ${normalizedQuestion.question_options.length} options`)
  return normalizedQuestion
}

// Parse and validate the AI response (unified parsing logic) - LEGACY VERSION
function parseAndValidateQuestion(response: string): QuestionData {
  try {
    console.log(`[Question Gen] Raw AI response (first 500 chars): ${response.substring(0, 500)}`)

    // Enhanced JSON extraction and cleaning
    let jsonStr = ''

    // Try multiple JSON extraction strategies
    const strategies = [
      // Strategy 1: Smart brace counting (handles extra content after JSON)
      () => {
        const firstBrace = response.indexOf('{')
        if (firstBrace === -1) return null
        
        let braceCount = 0
        let i = firstBrace
        let inString = false
        let escapeNext = false
        
        while (i < response.length) {
          const char = response[i]
          
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
                return response.substring(firstBrace, i + 1)
              }
            }
          }
          i++
        }
        return null
      },
      // Strategy 2: Look for JSON between code blocks
      () => {
        const match = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
        return match ? match[1] : null
      },
      // Strategy 3: Look for complete JSON object (greedy match - fallback)
      () => {
        const match = response.match(/\{[\s\S]*\}/)
        return match ? match[0] : null
      }
    ]

    for (let i = 0; i < strategies.length; i++) {
      const extracted = strategies[i]()
      if (extracted) {
        jsonStr = extracted
        console.log(`[Question Gen] JSON extracted using strategy ${i + 1}`)
        break
      }
    }

    if (!jsonStr) {
      throw new Error('No JSON found in AI response using any extraction strategy')
    }

    // Clean the JSON string
    jsonStr = jsonStr
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .replace(/([}\]])([^,\s}\]]*)/g, '$1') // Remove any text after closing braces/brackets
      .replace(/}\s*[^}\s]+\s*$/g, '}') // Remove any trailing text after final closing brace
      .trim()

    console.log(`[Question Gen] Cleaned JSON (first 200 chars): ${jsonStr.substring(0, 200)}`)

    // Parse with enhanced error handling
    let parsedQuestion: unknown
    try {
      parsedQuestion = JSON.parse(jsonStr)
    } catch (jsonError) {
      // Try to fix common JSON issues
      const fixedJson = jsonStr
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes to unquoted keys
        .replace(/:\s*'([^']*)'/g, ': "$1"') // Replace single quotes with double quotes
        .replace(/\\'/g, "'") // Fix escaped single quotes

      try {
        parsedQuestion = JSON.parse(fixedJson)
        console.log('[Question Gen] Successfully parsed JSON after fixing common issues')
      } catch (fixError) {
        throw new Error(`JSON parsing failed: ${jsonError instanceof Error ? jsonError.message : 'Unknown parse error'}`)
      }
    }

    // Validate and normalize the structure for the new format
    if (parsedQuestion && typeof parsedQuestion === 'object') {
      const questionObj = parsedQuestion as Record<string, unknown>
      const normalizedQuestion: QuestionData = {
        question_options: []
      }

      // Extract all the new fields
      normalizedQuestion.title = typeof questionObj.title === 'string' ? questionObj.title : undefined
      normalizedQuestion.stem = typeof questionObj.stem === 'string' ? questionObj.stem : ''
      normalizedQuestion.difficulty = typeof questionObj.difficulty === 'string' ? questionObj.difficulty : 'medium'
      normalizedQuestion.teaching_point = typeof questionObj.teaching_point === 'string' ? questionObj.teaching_point : undefined
      normalizedQuestion.suggested_tags = Array.isArray(questionObj.suggested_tags) ? questionObj.suggested_tags.map(tag => String(tag)) : []
      normalizedQuestion.status = typeof questionObj.status === 'string' ? questionObj.status : 'draft'

      // Handle question_references
      if (typeof questionObj.question_references === 'string') {
        normalizedQuestion.references = [questionObj.question_references]
      } else if (Array.isArray(questionObj.references)) {
        normalizedQuestion.references = questionObj.references.map(ref => String(ref))
      } else {
        normalizedQuestion.references = ['Robbins and Cotran Pathologic Basis of Disease, 10th ed']
      }

      // Validate stem exists
      if (!normalizedQuestion.stem) {
        throw new Error('No question stem found in AI response')
      }

      // Handle question_options array - support multiple field names for backward compatibility
      const optionsArray = questionObj.question_options || questionObj.answer_options || questionObj.options
      if (Array.isArray(optionsArray) && optionsArray.length >= 4) {
        normalizedQuestion.question_options = optionsArray.map((opt: unknown, index: number) => {
          if (typeof opt === 'object' && opt !== null) {
            const optObj = opt as Record<string, unknown>
            return {
              id: (typeof optObj.id === 'string' ? optObj.id : String.fromCharCode(65 + index)), // A, B, C, D, E
              text: String(optObj.text || ''),
              is_correct: Boolean(optObj.is_correct),
              explanation: String(optObj.explanation || ''),
              order_index: typeof optObj.order_index === 'number' ? optObj.order_index : index
            }
          }
          return {
            id: String.fromCharCode(65 + index),
            text: String(opt),
            is_correct: false,
            explanation: '',
            order_index: index
          }
        })
      } else {
        throw new Error('Invalid or insufficient answer options in AI response')
      }

      // Validate that we have exactly one correct answer
      const correctAnswers = normalizedQuestion.question_options.filter(opt => opt.is_correct)
      if (correctAnswers.length !== 1) {
        throw new Error(`Expected exactly 1 correct answer, found ${correctAnswers.length}`)
      }

      console.log(`[Question Gen] Successfully parsed question with ${normalizedQuestion.question_options.length} options`)
      return normalizedQuestion

    } else {
      throw new Error('AI response is not a valid object')
    }

  } catch (parseError) {
    console.error('[Question Gen] Failed to parse AI response:', parseError)
    console.error(`[Question Gen] Full response text: ${response.substring(0, 1000)}`)
    throw new Error(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`)
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log('[Question Gen] Starting unified question generation request')

    // Parse request body
    const body = await request.json()
    const { wsi, context, modelIndex = 0, customPrompt } = body

    if (!wsi) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: wsi'
        },
        { status: 400 }
      )
    }

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
    console.log(`[Question Gen] Generating question for: ${wsi.diagnosis} using model ${modelIndex + 1}/${WSI_FALLBACK_MODELS.length}: ${selectedModel}`)

    try {
      // Generate question using AI with enhanced retry logic
      const questionResult = await generateQuestionWithRetries(wsi, selectedModel, context, customPrompt)

      const generationTime = Date.now() - startTime
      console.log(`[Question Gen] Question generation completed in ${generationTime}ms`)

      // Shuffle answer options to randomize correct answer position
      const shuffledOptions = shuffleOptions(questionResult.questionData.question_options)

      const result = {
        success: true,
        question: {
          ...questionResult.questionData,
          question_options: shuffledOptions
        },
        metadata: {
          generated_at: new Date().toISOString(),
          generation_time_ms: generationTime,
          model: questionResult.modelUsed,
          modelIndex: modelIndex,
          diagnosis: wsi.diagnosis,
          token_usage: questionResult.tokenUsage,
          retry_info: questionResult.retryInfo
        },
        debug: questionResult.debug
      }

      console.log('[Question Gen] Final API response token_usage:', result.metadata.token_usage)

      return NextResponse.json(result, {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })

    } catch (modelError) {
      const errorType = classifyError(modelError)
      console.error(`[Question Gen] Model ${selectedModel} failed (${errorType}):`, modelError)

      // Determine next action based on error type
      const nextModelIndex = modelIndex + 1
      const hasMoreModels = nextModelIndex < WSI_FALLBACK_MODELS.length

      // Provide more informative error messages
      let errorMessage = `Model ${selectedModel} failed`
      if (errorType === 'retryable') {
        errorMessage += ' (transient error - retries exhausted)'
      } else if (errorType === 'fallback') {
        errorMessage += ' (fundamental error - trying next model)'
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          details: modelError instanceof Error ? modelError.message : 'Unknown error',
          errorType: errorType,
          nextModelIndex: hasMoreModels ? nextModelIndex : null,
          nextModel: hasMoreModels ? WSI_FALLBACK_MODELS[nextModelIndex] : null,
          currentModelIndex: modelIndex,
          availableModels: WSI_FALLBACK_MODELS.length,
          retryExhausted: errorType === 'retryable'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('[Question Gen] Unexpected error:', error)

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