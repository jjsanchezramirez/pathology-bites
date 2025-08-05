import { NextRequest, NextResponse } from 'next/server'
import { getApiKey, getModelProvider } from '@/shared/config/ai-models'

// WSI Question Generator fallback model sequence
const WSI_FALLBACK_MODELS = [
  'Llama-4-Maverick-17B-128E-Instruct-FP8', // LLAMA 4 Maverick
  'Llama-3.3-8B-Instruct',                  // LLAMA 3.3 8B
  'gemini-2.0-flash',                       // Gemini 2.0 Flash
  'gemini-2.5-flash-lite',                  // Gemini 2.5 Flash Lite
  'gemini-2.0-flash-lite',                  // Gemini 2.0 Flash Lite
  'gemini-1.5-flash-8b',                    // Gemini 1.5 Flash 8B
  'mistral-small-2506',                     // Mistral Small 3.2
  'mistral-small-2503',                     // Mistral Small 3.1
  'ministral-8b-2410',                      // Ministral 8B
  'ministral-3b-2410'                       // Ministral 3B
]

// Types
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
  image_url: string
  thumbnail_url: string
  magnification: string
  organ_system: string
  difficulty_level: string
  keywords: string[]
  created_at: string
  updated_at: string
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
  is_correct: boolean
  explanation: string
}

interface QuestionData {
  stem: string
  options: QuestionOption[]
  references: string[]
}

// Retry utility function
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)
      if (response.ok) {
        return response
      }

      // If it's a client error (4xx), don't retry
      if (response.status >= 400 && response.status < 500) {
        return response
      }

      // For server errors (5xx), retry
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown fetch error')
    }

    // Wait before retrying (exponential backoff)
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt - 1) * 1000 // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError || new Error('Max retries exceeded')
}

// Removed hard-coded fallback question generation to keep system simple



// Generate question using AI
async function generateQuestion(wsi: VirtualSlide, context: EducationalContent | null, modelId?: string): Promise<{ questionData: QuestionData; debug: any; modelUsed: string; tokenUsage?: any }> {
  try {
    console.log('[Question Gen] Starting AI question generation')

    // Get AI configuration - use provided model or first fallback model
    const selectedModel = modelId || WSI_FALLBACK_MODELS[0]
    const provider = getModelProvider(selectedModel)
    const apiKey = getApiKey(provider)

    if (!apiKey) {
      throw new Error(`No API key found for model: ${selectedModel}`)
    }

    console.log(`[Question Gen] Using model: ${selectedModel} (${provider})`)

    // Use enhanced instructions matching admin quality standards
    const instructions = `You are an expert pathology educator creating board-style multiple-choice questions for medical students and residents. Generate a high-quality pathology question based on the provided content that matches the standards of professional medical examinations.

QUALITY REQUIREMENTS (CRITICAL):
1. Create a clinically realistic scenario with specific patient demographics, symptoms, and relevant history
2. Include exactly 5 answer choices with one clearly correct answer and 4 plausible distractors
3. Test differential diagnosis skills and pathophysiological understanding, not just memorization
4. Use precise medical terminology and appropriate clinical context
5. Make the question challenging but fair - suitable for board examinations
6. Assume microscopic images are provided via WSI viewer (do NOT describe histologic findings in the stem)

STEM REQUIREMENTS:
- Begin with realistic patient presentation (age, gender, symptoms, duration, relevant history)
- Include pertinent clinical findings, laboratory results, or imaging when relevant
- End with a clear question asking for the most likely diagnosis
- DO NOT state the diagnosis directly or use phrases like "findings consistent with [diagnosis]"
- DO NOT describe microscopic features - the WSI images provide this information
- DO NOT mention specific biopsy types (punch, core, needle, shave, excisional, etc.) unless explicitly provided in the case information - use generic terms like "biopsy" or "tissue sample"

ANSWER CHOICE REQUIREMENTS:
- Provide 5 specific diagnostic entities as options
- Include the correct diagnosis and 4 clinically relevant differential diagnoses
- Ensure distractors are plausible given the clinical scenario
- Use proper diagnostic terminology and classification

EXPLANATION REQUIREMENTS:
- Provide detailed explanations for each choice explaining why it's correct or incorrect
- For the correct answer: Include at least one sentence describing the characteristic histologic features that confirm this diagnosis
- For incorrect answers: Include at least one sentence explaining the histologic differences that distinguish them from the correct diagnosis
- Reference key distinguishing histologic features, cellular morphology, tissue architecture, and staining patterns
- Include epidemiology and clinical context when relevant
- Demonstrate expert-level pathology knowledge with focus on morphological differentiation

CRITICAL: You must return ONLY valid JSON in the exact format below. Do not include any text before or after the JSON. Do not use markdown formatting.

{
  "stem": "Clinical scenario ending with diagnostic question",
  "options": [
    {"id": "A", "text": "Specific diagnosis", "is_correct": false, "explanation": "Detailed explanation for why this diagnosis is incorrect in this context"},
    {"id": "B", "text": "Specific diagnosis", "is_correct": true, "explanation": "Detailed explanation for why this is the correct diagnosis, including key features"},
    {"id": "C", "text": "Specific diagnosis", "is_correct": false, "explanation": "Detailed explanation for why this diagnosis is incorrect"},
    {"id": "D", "text": "Specific diagnosis", "is_correct": false, "explanation": "Detailed explanation for why this diagnosis is incorrect"},
    {"id": "E", "text": "Specific diagnosis", "is_correct": false, "explanation": "Detailed explanation for why this diagnosis is incorrect"}
  ],
  "references": ["Relevant pathology textbook or journal citation", "Additional authoritative reference"]
}`

    // Prepare comprehensive prompt with WSI and educational content (matching admin quality)
    const prompt = `Create a board-style pathology multiple-choice question based on the following comprehensive content:

**VIRTUAL SLIDE CASE INFORMATION:**
Repository: ${wsi.repository}
Pathological Category: ${wsi.category}
Subcategory: ${wsi.subcategory}
Confirmed Diagnosis: ${wsi.diagnosis}
Clinical History: ${wsi.clinical_history || 'Not provided'}
Patient Information: ${wsi.patient_info || 'Not specified'}
Patient Age: ${wsi.age || 'Not specified'}
Patient Gender: ${wsi.gender || 'Not specified'}
Staining: ${wsi.stain_type || 'H&E'}

${context ? `**EDUCATIONAL REFERENCE CONTENT:**
Medical Category: ${context.category}
Subject Area: ${context.subject}
Lesson Module: ${context.lesson}
Specific Topic: ${context.topic}

DETAILED CONTENT:
${JSON.stringify(context.content, null, 2)}
` : ''}

**TASK:** Generate a high-quality, board-examination-style pathology question that:
1. Creates a realistic clinical scenario without revealing the diagnosis
2. Tests differential diagnosis skills using the provided WSI images
3. Includes 5 specific diagnostic options with detailed explanations
4. Matches the quality standards of professional medical examinations

The virtual slide images will be displayed to the user, so do not describe microscopic findings in your question stem.`

    // Determine API endpoint based on model provider
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    let apiEndpoint: string

    switch (provider) {
      case 'llama':
        apiEndpoint = `${baseUrl}/api/debug/llama-test`
        break
      case 'gemini':
        apiEndpoint = `${baseUrl}/api/debug/gemini-test`
        break
      case 'mistral':
        apiEndpoint = `${baseUrl}/api/debug/mistral-test`
        break
      case 'claude':
        apiEndpoint = `${baseUrl}/api/debug/claude-test`
        break
      case 'chatgpt':
        apiEndpoint = `${baseUrl}/api/debug/chatgpt-test`
        break
      case 'deepseek':
        apiEndpoint = `${baseUrl}/api/debug/deepseek-test`
        break
      default:
        console.warn(`[Question Gen] Unknown provider: ${provider}, defaulting to Gemini`)
        apiEndpoint = `${baseUrl}/api/debug/gemini-test`
        break
    }

    console.log(`[Question Gen] Using model: ${selectedModel} (${provider})`)
    console.log(`[Question Gen] Calling AI API: ${apiEndpoint}`)

    // Use retry logic like admin system for better reliability
    const response = await fetchWithRetry(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: apiKey,
        model: selectedModel,
        prompt: prompt,
        instructions: instructions,
        assumeHistologicImages: true, // Images are provided via WSI viewer
        temperature: 0.7,
        maxTokens: 2000 // Increased for more detailed responses
      })
    })

    if (!response.ok) {
      throw new Error(`AI API request failed: ${response.status} ${response.statusText}`)
    }

    const aiResponse = await response.json()
    console.log('[Question Gen] AI response received')

    // Extract token usage information
    let tokenUsage = null
    if (aiResponse.usage) {
      tokenUsage = {
        prompt_tokens: aiResponse.usage.prompt_tokens || 0,
        completion_tokens: aiResponse.usage.completion_tokens || 0,
        total_tokens: aiResponse.usage.total_tokens || 0
      }
    }

    // Handle different response formats from Gemini API
    let generatedText: string
    if (aiResponse.response) {
      // Format from our debug endpoint wrapper
      generatedText = aiResponse.response
    } else if (aiResponse.choices?.[0]?.message?.content) {
      // LLAMA API format (OpenAI-compatible)
      generatedText = aiResponse.choices[0].message.content
      console.log('[Question Gen] Using LLAMA response format')
    } else if (aiResponse.candidates && aiResponse.candidates[0]?.content?.parts?.[0]?.text) {
      // Direct Gemini API format
      generatedText = aiResponse.candidates[0].content.parts[0].text
      console.log('[Question Gen] Using Gemini response format')
    } else {
      console.error('[Question Gen] Unexpected AI response format:', JSON.stringify(aiResponse, null, 2))
      throw new Error('No response content found in AI API response')
    }
    console.log('[Question Gen] Parsing AI response...')

    // Try to parse JSON response
    try {
      console.log(`[Question Gen] Raw AI response (first 500 chars): ${generatedText.substring(0, 500)}`)

      // Enhanced JSON extraction and cleaning
      let jsonStr = ''

      // Try multiple JSON extraction strategies
      const strategies = [
        // Strategy 1: Smart brace counting (handles extra content after JSON)
        () => {
          const firstBrace = generatedText.indexOf('{')
          if (firstBrace === -1) return null
          
          let braceCount = 0
          let i = firstBrace
          let inString = false
          let escapeNext = false
          
          while (i < generatedText.length) {
            const char = generatedText[i]
            
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
                  return generatedText.substring(firstBrace, i + 1)
                }
              }
            }
            i++
          }
          return null
        },
        // Strategy 2: Look for JSON between code blocks
        () => {
          const match = generatedText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
          return match ? match[1] : null
        },
        // Strategy 3: Look for JSON after specific markers with proper ending
        () => {
          const afterMatch = generatedText.match(/(?:json|JSON|response|answer):\s*([\s\S]*)/)
          if (afterMatch) {
            const content = afterMatch[1]
            const firstBrace = content.indexOf('{')
            if (firstBrace === -1) return null
            
            let braceCount = 0
            let i = firstBrace
            let inString = false
            let escapeNext = false
            
            while (i < content.length) {
              const char = content[i]
              
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
                    return content.substring(firstBrace, i + 1)
                  }
                }
              }
              i++
            }
          }
          return null
        },
        // Strategy 4: Look for complete JSON object (greedy match - fallback)
        () => {
          const match = generatedText.match(/\{[\s\S]*\}/)
          return match ? match[0] : null
        },
        // Strategy 5: Extract everything between first { and last } (last resort)
        () => {
          const firstBrace = generatedText.indexOf('{')
          const lastBrace = generatedText.lastIndexOf('}')
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            return generatedText.substring(firstBrace, lastBrace + 1)
          }
          return null
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

      // Clean the JSON string more aggressively
      jsonStr = jsonStr
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .replace(/([}\]])([^,\s}\]]*)/g, '$1') // Remove any text after closing braces/brackets
        .replace(/}\s*[^}\s]+\s*$/g, '}') // Remove any trailing text after final closing brace
        .trim()

      console.log(`[Question Gen] Cleaned JSON (first 200 chars): ${jsonStr.substring(0, 200)}`)

      // Parse with enhanced error handling
      let parsedQuestion
      try {
        parsedQuestion = JSON.parse(jsonStr)
      } catch (jsonError) {
        const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError)
        console.error(`[Question Gen] JSON parse error: ${errorMessage}`)
        console.error(`[Question Gen] Problematic JSON: ${jsonStr}`)

        // Try to fix common JSON issues
        const fixedJson = jsonStr
          .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes to unquoted keys
          .replace(/:\s*'([^']*)'/g, ': "$1"') // Replace single quotes with double quotes
          .replace(/\\'/g, "'") // Fix escaped single quotes

        try {
          parsedQuestion = JSON.parse(fixedJson)
          console.log('[Question Gen] Successfully parsed JSON after fixing common issues')
        } catch (fixError) {
          const fixErrorMessage = fixError instanceof Error ? fixError.message : String(fixError)
          throw new Error(`JSON parsing failed even after attempted fixes: ${fixErrorMessage}`)
        }
      }

      // Validate the structure
      if (parsedQuestion && parsedQuestion.stem && parsedQuestion.options && Array.isArray(parsedQuestion.options)) {
        console.log('[Question Gen] Successfully parsed and validated AI response')
        return {
          questionData: parsedQuestion,
          debug: {
            prompt: prompt,
            instructions: instructions,
            rawResponse: generatedText.substring(0, 1000), // Include raw response for debugging
            extractedJson: jsonStr.substring(0, 500)
          },
          modelUsed: selectedModel,
          tokenUsage: tokenUsage
        }
      } else {
        throw new Error(`Invalid question structure in AI response. Got: ${JSON.stringify(parsedQuestion, null, 2)}`)
      }

    } catch (parseError) {
      console.error('[Question Gen] Failed to parse AI response:', parseError)
      console.error(`[Question Gen] Full response text: ${generatedText}`)

      // Throw error instead of using hard-coded fallback
      throw new Error(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`)
    }

  } catch (error) {
    console.error('[Question Gen] Error generating question:', error)
    throw new Error('Failed to generate question using AI')
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log('[Question Gen] Starting question generation request')

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
      // Generate question using AI with specific model
      const questionResult = await generateQuestion(wsi, context, selectedModel)

      const generationTime = Date.now() - startTime
      console.log(`[Question Gen] Question generation completed in ${generationTime}ms`)

      const result = {
        success: true,
        question: questionResult.questionData,
        metadata: {
          generated_at: new Date().toISOString(),
          generation_time_ms: generationTime,
          model: questionResult.modelUsed,
          modelIndex: modelIndex,
          diagnosis: wsi.diagnosis,
          token_usage: questionResult.tokenUsage
        },
        debug: questionResult.debug
      }

      return NextResponse.json(result, {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })

    } catch (modelError) {
      console.error(`[Question Gen] Model ${selectedModel} failed:`, modelError)

      // Return error with next model index for fallback
      const nextModelIndex = modelIndex + 1
      const hasMoreModels = nextModelIndex < WSI_FALLBACK_MODELS.length

      return NextResponse.json(
        {
          success: false,
          error: `Model ${selectedModel} failed`,
          details: modelError instanceof Error ? modelError.message : 'Unknown error',
          nextModelIndex: hasMoreModels ? nextModelIndex : null,
          nextModel: hasMoreModels ? WSI_FALLBACK_MODELS[nextModelIndex] : null,
          currentModelIndex: modelIndex,
          availableModels: WSI_FALLBACK_MODELS.length
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
