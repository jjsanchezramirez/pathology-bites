import { NextRequest, NextResponse } from 'next/server'
import { createOptimizedResponse } from '@/shared/utils/compression'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { 
  extractMedicalTerms, 
  calculateUnifiedMatchScore, 
  assessSearchQuality, 
  shouldRejectResult,
  SEARCH_PRESETS,
  type MedicalSearchOptions 
} from '@/shared/utils/unified-medical-search'
import { getApiKey, getModelProvider } from '@/shared/config/ai-models'

// Diagnostic Search AI fallback model sequence - similar to WSI Question Generator
const DIAGNOSTIC_AI_FALLBACK_MODELS = [
  'gemini-1.5-flash',                       // Gemini 1.5 Flash (preferred for organization)
  'mistral-small-2506',                     // Mistral Small 3.2
  'gemini-1.5-flash-8b',                    // Gemini 1.5 Flash 8B
  'mistral-small-2503',                     // Mistral Small 3.1
  'ministral-8b-2410',                      // Ministral 8B
  'Llama-3.3-8B-Instruct',                  // LLAMA 3.3 8B
  'gemini-2.0-flash-lite',                  // Gemini 2.0 Flash Lite
  'ministral-3b-2410'                       // Ministral 3B
]

// R2 configuration for educational content data bucket
const r2Client = new S3Client({
  region: 'auto',
  endpoint: 'https://1faba3419ce733a22d081e271ae7a750.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

// Types
interface EducationalContent {
  category: string
  subject: string
  lesson: string
  topic: string
  content: any
}

interface DiagnosticSearchResult {
  success: boolean
  entity?: string
  results?: {
    differential_diagnosis: string[]
    immunohistochemistry: {
      positive: string[]
      negative: string[]
    }
    histologic_clues: string[]
    clinical_features: string[]
    molecular_findings: string[]
    additional_info: string[]
  }
  metadata: {
    searched_at: string
    search_time_ms: number
    entity: string
    context_found: boolean
    context_quality: string
    files_searched: number
    ai_organized?: boolean
    ai_model?: string
    ai_generation_time_ms?: number
    ai_fallback_attempts?: number
    search_algorithm?: string
    search_quality?: string
    medical_terms_extracted?: number
    token_usage?: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
    }
    best_match?: {
      filename: string
      lesson: string
      topic: string
      score: number
      match_details?: any
    }
  }
}

// Available educational content files with category mapping for smart loading
const CONTENT_FILES = [
  'ap-bone.json', 'ap-breast.json', 'ap-cardiovascular-and-thoracic.json',
  'ap-cytopathology.json', 'ap-dermatopathology.json', 'ap-forensics-and-autopsy.json',
  'ap-gastrointestinal.json', 'ap-general-topics.json', 'ap-genitourinary.json',
  'ap-gynecological.json', 'ap-head-and-neck---endocrine.json', 'ap-hematopathology.json',
  'ap-molecular.json', 'ap-neuropathology.json', 'ap-pancreas-biliary-liver.json',
  'ap-pediatrics.json', 'ap-soft-tissue.json', 'cp-clinical-chemistry.json',
  'cp-hematology-hemostasis-and-thrombosis.json', 'cp-hematopathology.json', 'cp-immunology.json',
  'cp-laboratory-management-and-clinical-laboratory-informatics.json',
  'cp-medical-microbiology.json', 'cp-molecular-pathology.json', 'cp-transfusion-medicine.json'
]

// Smart file prioritization based on entity keywords
const FILE_PRIORITY_MAP: Record<string, string[]> = {
  'bone': ['ap-bone.json', 'ap-soft-tissue.json'],
  'breast': ['ap-breast.json', 'ap-gynecological.json'],
  'cardiac': ['ap-cardiovascular-and-thoracic.json'],
  'heart': ['ap-cardiovascular-and-thoracic.json'],
  'lung': ['ap-cardiovascular-and-thoracic.json'],
  'cytology': ['ap-cytopathology.json'],
  'skin': ['ap-dermatopathology.json'],
  'derma': ['ap-dermatopathology.json'],
  'eczema': ['ap-dermatopathology.json'],
  'gi': ['ap-gastrointestinal.json', 'ap-pancreas-biliary-liver.json'],
  'gastro': ['ap-gastrointestinal.json', 'ap-pancreas-biliary-liver.json'],
  'colon': ['ap-gastrointestinal.json'],
  'kidney': ['ap-genitourinary.json'],
  'renal': ['ap-genitourinary.json'],
  'bladder': ['ap-genitourinary.json'],
  'prostate': ['ap-genitourinary.json'],
  'ovary': ['ap-gynecological.json'],
  'cervix': ['ap-gynecological.json'],
  'uterus': ['ap-gynecological.json'],
  'thyroid': ['ap-head-and-neck---endocrine.json'],
  'lymphoma': ['ap-hematopathology.json', 'cp-hematopathology.json'],
  'leukemia': ['ap-hematopathology.json', 'cp-hematopathology.json'],
  'brain': ['ap-neuropathology.json'],
  'neuro': ['ap-neuropathology.json'],
  'liver': ['ap-pancreas-biliary-liver.json'],
  'pancreas': ['ap-pancreas-biliary-liver.json'],
  'pediatric': ['ap-pediatrics.json'],
  'child': ['ap-pediatrics.json'],
  'sarcoma': ['ap-soft-tissue.json']
}

/**
 * Get prioritized file list based on search entity to reduce API calls
 */
function getPrioritizedFiles(entity: string): string[] {
  const entityLower = entity.toLowerCase()
  const priorityFiles = new Set<string>()
  
  // Add high-priority files based on keywords
  for (const [keyword, files] of Object.entries(FILE_PRIORITY_MAP)) {
    if (entityLower.includes(keyword)) {
      files.forEach(file => priorityFiles.add(file))
    }
  }
  
  // Always include general topics as backup
  priorityFiles.add('ap-general-topics.json')
  
  // Add remaining files in original order
  const result = Array.from(priorityFiles)
  const remainingFiles = CONTENT_FILES.filter(file => !priorityFiles.has(file))
  
  return [...result, ...remainingFiles]
}

// Cache for educational content files
const contentCache = new Map<string, any>()
const cacheTimestamps = new Map<string, number>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

// Cache for search results (common diagnostic entities)
const searchResultsCache = new Map<string, DiagnosticSearchResult>()
const searchCacheTimestamps = new Map<string, number>()
const SEARCH_CACHE_TTL = 2 * 60 * 60 * 1000 // 2 hours for search results

/**
 * Load educational content file from R2 with caching
 */
async function loadContentFile(filename: string): Promise<any> {
  const now = Date.now()
  const cacheKey = filename

  // Check cache first
  if (contentCache.has(cacheKey)) {
    const timestamp = cacheTimestamps.get(cacheKey) || 0
    if (now - timestamp < CACHE_TTL) {
      console.log(`[Diagnostic Search] Using cached ${filename}`)
      return contentCache.get(cacheKey)
    }
  }

  try {
    // Generate signed URL for private educational content file
    const contentKey = `context/${filename}`
    const command = new GetObjectCommand({
      Bucket: 'pathology-bites-data',
      Key: contentKey,
    })

    const signedUrl = await getSignedUrl(r2Client, command, {
      expiresIn: 3600 // 1 hour
    })

    // Fetch from R2 using signed URL for private file access
    const response = await fetch(signedUrl)

    if (!response.ok) {
      console.warn(`[Diagnostic Search] Failed to load ${filename}: ${response.status}`)
      return null
    }

    const data = await response.json()

    // Cache the result
    contentCache.set(cacheKey, data)
    cacheTimestamps.set(cacheKey, now)

    return data
  } catch (error) {
    console.error(`[Diagnostic Search] Error loading ${filename}:`, error)
    return null
  }
}

/**
 * Extract diagnostic information from educational content using AI organization
 */
async function extractDiagnosticInfo(content: any, entity: string): Promise<{
  differential_diagnosis: string[]
  immunohistochemistry: { positive: string[], negative: string[] }
  histologic_clues: string[]
  clinical_features: string[]
  molecular_findings: string[]
  additional_info: string[]
  ai_organized?: boolean
  ai_model?: string
  ai_generation_time_ms?: number
  ai_fallback_attempts?: number
  token_usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}> {
  const result = {
    differential_diagnosis: [] as string[],
    immunohistochemistry: { positive: [] as string[], negative: [] as string[] },
    histologic_clues: [] as string[],
    clinical_features: [] as string[],
    molecular_findings: [] as string[],
    additional_info: [] as string[]
  }

  if (!content) return result

  // First, extract raw information using existing patterns
  const rawInfo = extractRawDiagnosticInfo(content, entity)

  // If we have raw information, use AI to organize it
  if (hasSignificantContent(rawInfo)) {
    try {
      const aiStartTime = Date.now()
      const organizedInfo = await organizeWithAI(rawInfo, entity, 0) // Start with model index 0
      const aiGenerationTime = Date.now() - aiStartTime
      
      if (organizedInfo) {
        // Mark that AI organization was used with metadata
        ;(organizedInfo as any).ai_organized = true
        ;(organizedInfo as any).ai_generation_time_ms = aiGenerationTime
        // ai_model and token_usage are already set by organizeWithAI
        ;(organizedInfo as any).ai_fallback_attempts = countFallbackAttempts((organizedInfo as any).ai_model)
        return organizedInfo
      }
      return rawInfo // Fallback to raw if AI fails
    } catch (error) {
      console.warn('[Diagnostic Search] AI organization failed, using raw extraction:', error)
      return rawInfo
    }
  }

  return result
}

/**
 * Extract raw diagnostic information using pattern matching (original logic)
 */
function extractRawDiagnosticInfo(content: any, entity: string): {
  differential_diagnosis: string[]
  immunohistochemistry: { positive: string[], negative: string[] }
  histologic_clues: string[]
  clinical_features: string[]
  molecular_findings: string[]
  additional_info: string[]
} {
  const result = {
    differential_diagnosis: [] as string[],
    immunohistochemistry: { positive: [] as string[], negative: [] as string[] },
    histologic_clues: [] as string[],
    clinical_features: [] as string[],
    molecular_findings: [] as string[],
    additional_info: [] as string[]
  }

  if (!content) return result

  const contentText = JSON.stringify(content).toLowerCase()
  const entityLower = entity.toLowerCase()

  // Extract differential diagnosis
  const ddxPatterns = [
    /differential\s+diagnosis[:\s]*([^.]+)/gi,
    /ddx[:\s]*([^.]+)/gi,
    /consider[:\s]*([^.]+)/gi,
    /rule\s+out[:\s]*([^.]+)/gi,
    /versus[:\s]*([^.]+)/gi
  ]

  ddxPatterns.forEach(pattern => {
    const matches = contentText.match(pattern)
    if (matches) {
      matches.forEach(match => {
        const items = match.split(/[,;]/).map(item => item.trim()).filter(item => item.length > 3)
        result.differential_diagnosis.push(...items)
      })
    }
  })

  // Extract immunohistochemistry information
  const ihcPatterns = {
    positive: [
      /positive\s+for[:\s]*([^.]+)/gi,
      /\+\s*for[:\s]*([^.]+)/gi,
      /expresses[:\s]*([^.]+)/gi,
      /stains\s+positive[:\s]*([^.]+)/gi
    ],
    negative: [
      /negative\s+for[:\s]*([^.]+)/gi,
      /-\s*for[:\s]*([^.]+)/gi,
      /does\s+not\s+express[:\s]*([^.]+)/gi,
      /stains\s+negative[:\s]*([^.]+)/gi
    ]
  }

  Object.entries(ihcPatterns).forEach(([type, patterns]) => {
    patterns.forEach(pattern => {
      const matches = contentText.match(pattern)
      if (matches) {
        matches.forEach(match => {
          const items = match.split(/[,;]/).map(item => item.trim()).filter(item => item.length > 2)
          if (type === 'positive') {
            result.immunohistochemistry.positive.push(...items)
          } else {
            result.immunohistochemistry.negative.push(...items)
          }
        })
      }
    })
  })

  // Extract histologic clues
  const histologyPatterns = [
    /histologic[:\s]*([^.]+)/gi,
    /microscopic[:\s]*([^.]+)/gi,
    /morphology[:\s]*([^.]+)/gi,
    /features[:\s]*([^.]+)/gi,
    /appearance[:\s]*([^.]+)/gi
  ]

  histologyPatterns.forEach(pattern => {
    const matches = contentText.match(pattern)
    if (matches) {
      matches.forEach(match => {
        const items = match.split(/[,;]/).map(item => item.trim()).filter(item => item.length > 5)
        result.histologic_clues.push(...items)
      })
    }
  })

  // Extract clinical features
  const clinicalPatterns = [
    /clinical[:\s]*([^.]+)/gi,
    /presentation[:\s]*([^.]+)/gi,
    /symptoms[:\s]*([^.]+)/gi,
    /signs[:\s]*([^.]+)/gi
  ]

  clinicalPatterns.forEach(pattern => {
    const matches = contentText.match(pattern)
    if (matches) {
      matches.forEach(match => {
        const items = match.split(/[,;]/).map(item => item.trim()).filter(item => item.length > 5)
        result.clinical_features.push(...items)
      })
    }
  })

  // Extract molecular findings
  const molecularPatterns = [
    /molecular[:\s]*([^.]+)/gi,
    /mutation[:\s]*([^.]+)/gi,
    /fusion[:\s]*([^.]+)/gi,
    /gene[:\s]*([^.]+)/gi,
    /chromosome[:\s]*([^.]+)/gi,
    /translocation[:\s]*([^.]+)/gi,
    /amplification[:\s]*([^.]+)/gi,
    /deletion[:\s]*([^.]+)/gi
  ]

  molecularPatterns.forEach(pattern => {
    const matches = contentText.match(pattern)
    if (matches) {
      matches.forEach(match => {
        const items = match.split(/[,;]/).map(item => item.trim()).filter(item => item.length > 3)
        result.molecular_findings.push(...items)
      })
    }
  })

  // Remove duplicates and clean up
  Object.keys(result).forEach(key => {
    if (key === 'immunohistochemistry') {
      result[key].positive = [...new Set(result[key].positive)].slice(0, 10)
      result[key].negative = [...new Set(result[key].negative)].slice(0, 10)
    } else {
      result[key as keyof typeof result] = [...new Set(result[key as keyof typeof result] as string[])].slice(0, 15) as any
    }
  })

  return result
}

/**
 * Check if raw information has significant content worth organizing
 * Enhanced with smart thresholds to reduce unnecessary AI calls
 */
function hasSignificantContent(rawInfo: any): boolean {
  const totalItems =
    rawInfo.differential_diagnosis.length +
    rawInfo.immunohistochemistry.positive.length +
    rawInfo.immunohistochemistry.negative.length +
    rawInfo.histologic_clues.length +
    rawInfo.clinical_features.length +
    rawInfo.molecular_findings.length +
    rawInfo.additional_info.length

  // Require minimum 5 items to justify AI processing cost
  if (totalItems < 5) {
    return false
  }

  // Additional quality check - avoid AI for low-quality raw data
  const uniqueStrings = new Set()
  Object.values(rawInfo).forEach(value => {
    if (Array.isArray(value)) {
      value.forEach(item => uniqueStrings.add(String(item).toLowerCase().trim()))
    } else if (typeof value === 'object' && value !== null) {
      Object.values(value).forEach((subArray: any) => {
        if (Array.isArray(subArray)) {
          subArray.forEach(item => uniqueStrings.add(String(item).toLowerCase().trim()))
        }
      })
    }
  })

  // Only use AI if we have meaningful unique content (not just duplicates)
  return uniqueStrings.size >= 4
}

/**
 * Estimate token count for input text (rough approximation)
 */
function estimateTokenCount(text: string): number {
  // Rough approximation: ~4 characters per token for English text
  return Math.ceil(text.length / 4)
}

/**
 * Count how many fallback attempts were needed based on which model was used
 */
function countFallbackAttempts(modelUsed: string): number {
  const modelIndex = DIAGNOSTIC_AI_FALLBACK_MODELS.indexOf(modelUsed)
  return modelIndex >= 0 ? modelIndex + 1 : 1
}

/**
 * Organize diagnostic information using AI with fallback models
 */
async function organizeWithAI(rawInfo: any, entity: string, modelIndex: number = 0): Promise<{
  differential_diagnosis: string[]
  immunohistochemistry: { positive: string[], negative: string[] }
  histologic_clues: string[]
  clinical_features: string[]
  molecular_findings: string[]
  additional_info: string[]
  ai_model?: string
  token_usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
} | null> {
  // Prevent infinite recursion
  if (modelIndex >= DIAGNOSTIC_AI_FALLBACK_MODELS.length) {
    console.error('[Diagnostic Search] All fallback models exhausted')
    return null
  }

  const currentModel = DIAGNOSTIC_AI_FALLBACK_MODELS[modelIndex]
  const modelProvider = getModelProvider(currentModel)
  
  console.log(`[Diagnostic Search] Trying model ${modelIndex + 1}/${DIAGNOSTIC_AI_FALLBACK_MODELS.length}: ${currentModel} (${modelProvider})`)

  try {
    const prompt = createOrganizationPrompt(rawInfo, entity)
    const estimatedInputTokens = estimateTokenCount(prompt)
    console.log(`[Diagnostic Search] Estimated input tokens: ${estimatedInputTokens}`)

    let response, data, content, tokenUsage = null
    
    if (modelProvider === 'gemini') {
      const apiKey = getApiKey('gemini')
      if (!apiKey) {
        throw new Error('No Gemini API key available')
      }

      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2000
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`)
      }

      data = await response.json()
      content = data.candidates?.[0]?.content?.parts?.[0]?.text
      
      // Extract Gemini token usage
      tokenUsage = data.usageMetadata ? {
        prompt_tokens: data.usageMetadata.promptTokenCount || 0,
        completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
        total_tokens: data.usageMetadata.totalTokenCount || 0
      } : null
      
    } else if (modelProvider === 'mistral' || modelProvider === 'llama') {
      const apiKey = getApiKey(modelProvider)
      if (!apiKey) {
        throw new Error(`No ${modelProvider} API key available`)
      }

      const endpoint = modelProvider === 'mistral' 
        ? 'https://api.mistral.ai/v1/chat/completions'
        : `https://api.deepinfra.com/v1/openai/chat/completions`

      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: currentModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 2000
        })
      })

      if (!response.ok) {
        throw new Error(`${modelProvider} API error: ${response.status}`)
      }

      data = await response.json()
      content = data.choices?.[0]?.message?.content
      
      // Extract OpenAI-compatible token usage
      tokenUsage = data.usage ? {
        prompt_tokens: data.usage.prompt_tokens || 0,
        completion_tokens: data.usage.completion_tokens || 0,
        total_tokens: data.usage.total_tokens || 0
      } : null
    } else {
      throw new Error(`Unsupported model provider: ${modelProvider}`)
    }

    if (!content) {
      throw new Error('No content returned from AI')
    }

    console.log(`[Diagnostic Search] Successfully organized with ${currentModel}`)
    
    // Parse the AI response
    const parsedResult = parseAIResponse(content)
    if (parsedResult) {
      ;(parsedResult as any).ai_model = currentModel
      if (tokenUsage) {
        ;(parsedResult as any).token_usage = tokenUsage
      }
    }
    
    return parsedResult

  } catch (error) {
    console.warn(`[Diagnostic Search] Model ${currentModel} failed:`, error)
    
    // Try next model if available
    const nextModelIndex = modelIndex + 1
    if (nextModelIndex < DIAGNOSTIC_AI_FALLBACK_MODELS.length) {
      console.log(`[Diagnostic Search] Trying fallback model ${nextModelIndex + 1}/${DIAGNOSTIC_AI_FALLBACK_MODELS.length}`)
      return await organizeWithAI(rawInfo, entity, nextModelIndex)
    } else {
      console.error('[Diagnostic Search] All fallback models failed')
      return null
    }
  }
}

/**
 * Create the prompt for AI organization
 */
function createOrganizationPrompt(rawInfo: any, entity: string): string {
  const rawText = JSON.stringify(rawInfo, null, 2)

  return `You are a pathology expert organizing diagnostic information. Clean up and organize the following raw extracted data about "${entity}".

Raw extracted data:
${rawText}

Please organize this information into clean, readable format. Follow these guidelines:

1. **Clinical Features**: Describe patient presentation, demographics, symptoms, epidemiology
2. **Histologic Clues**: Describe key microscopic features in complete sentences
3. **Immunohistochemistry**:
   - Positive: List specific markers that are typically positive
   - Negative: List specific markers that are typically negative
   - Use standard marker names (e.g., "CD20", "Ki-67", "p53")
4. **Differential Diagnosis**: List clear, complete diagnostic entities (remove partial text, fix grammar)
5. **Molecular Findings**: List genetic alterations, mutations, fusions, chromosomal changes
6. **Additional Info**: Any other relevant information (prognosis, treatment, etc.)

Remove duplicates, fix incomplete sentences, and ensure medical accuracy. If information is unclear or incomplete, omit it rather than guessing.

Return ONLY a JSON object in this exact format:
{
  "clinical_features": ["feature1", "feature2"],
  "histologic_clues": ["feature1", "feature2"],
  "immunohistochemistry": {
    "positive": ["marker1", "marker2"],
    "negative": ["marker3", "marker4"]
  },
  "differential_diagnosis": ["item1", "item2"],
  "molecular_findings": ["finding1", "finding2"],
  "additional_info": ["info1", "info2"]
}`
}

/**
 * Parse AI response into structured format
 */
function parseAIResponse(content: string): {
  differential_diagnosis: string[]
  immunohistochemistry: { positive: string[], negative: string[] }
  histologic_clues: string[]
  clinical_features: string[]
  molecular_findings: string[]
  additional_info: string[]
} | null {
  try {
    // Clean the response - remove markdown code blocks if present
    let cleanContent = content.trim()
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    const parsed = JSON.parse(cleanContent)

    // Validate structure
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid JSON structure')
    }

    // Ensure all required fields exist with proper types
    const result = {
      differential_diagnosis: Array.isArray(parsed.differential_diagnosis) ? parsed.differential_diagnosis : [],
      immunohistochemistry: {
        positive: Array.isArray(parsed.immunohistochemistry?.positive) ? parsed.immunohistochemistry.positive : [],
        negative: Array.isArray(parsed.immunohistochemistry?.negative) ? parsed.immunohistochemistry.negative : []
      },
      histologic_clues: Array.isArray(parsed.histologic_clues) ? parsed.histologic_clues : [],
      clinical_features: Array.isArray(parsed.clinical_features) ? parsed.clinical_features : [],
      molecular_findings: Array.isArray(parsed.molecular_findings) ? parsed.molecular_findings : [],
      additional_info: Array.isArray(parsed.additional_info) ? parsed.additional_info : []
    }

    // Filter out empty strings and limit array sizes
    Object.keys(result).forEach(key => {
      if (key === 'immunohistochemistry') {
        result[key].positive = result[key].positive.filter((item: string) => item && item.trim().length > 0).slice(0, 10)
        result[key].negative = result[key].negative.filter((item: string) => item && item.trim().length > 0).slice(0, 10)
      } else {
        result[key as keyof typeof result] = (result[key as keyof typeof result] as string[])
          .filter(item => item && item.trim().length > 0)
          .slice(0, 15) as any
      }
    })

    return result

  } catch (error) {
    console.error('[Diagnostic Search] Failed to parse AI response:', error)
    return null
  }
}

/**
 * Calculate relevance score using unified medical search algorithm
 */
function calculateRelevanceScore(
  entity: string, 
  topicName: string, 
  lessonName: string, 
  content: any,
  category?: string,
  subcategory?: string
): { score: number; medicalTerms: any; matchDetails: any } {
  
  // Extract medical terms using unified algorithm
  const medicalTerms = extractMedicalTerms(entity)
  
  // Use diagnostic search preset for balanced results
  const searchOptions = SEARCH_PRESETS.diagnosticSearch
  
  // Calculate score using unified algorithm
  const contentText = JSON.stringify(content)
  const { score, matchDetails } = calculateUnifiedMatchScore(
    medicalTerms,
    topicName,
    lessonName,
    contentText,
    category,
    subcategory,
    searchOptions
  )
  
  console.log(`[Diagnostic Search] Unified scoring for "${topicName}": ${score}`)
  
  return { score, medicalTerms, matchDetails }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { entity } = body

    if (!entity || typeof entity !== 'string' || entity.trim().length < 2) {
      return NextResponse.json(
        { error: 'Valid diagnostic entity is required (minimum 2 characters)' },
        { status: 400 }
      )
    }

    const cleanEntity = entity.trim()
    const cacheKey = cleanEntity.toLowerCase()
    console.log(`[Diagnostic Search] Starting search for: ${cleanEntity}`)
    
    // Check search results cache first
    const now = Date.now()
    if (searchResultsCache.has(cacheKey)) {
      const cachedTimestamp = searchCacheTimestamps.get(cacheKey) || 0
      if (now - cachedTimestamp < SEARCH_CACHE_TTL) {
        console.log(`[Diagnostic Search] Using cached search result for: ${cleanEntity}`)
        const cachedResult = searchResultsCache.get(cacheKey)!
        // Update the searched_at timestamp but keep the cached result
        cachedResult.metadata.searched_at = new Date().toISOString()
        
        // Log cache hit for analytics
        console.log('[Diagnostic Search] Cache Performance:', JSON.stringify({
          search_time_ms: Date.now() - startTime,
          files_searched: 0,
          used_cache: true,
          entity: cleanEntity
        }))
        return createOptimizedResponse(cachedResult, {
          compress: true,
          cache: {
            maxAge: 3600,
            staleWhileRevalidate: 600,
            public: false
          }
        })
      }
    }

    let bestMatch: { content: EducationalContent; score: number; filename: string; lesson: string; topic: string; medicalTerms?: any; matchDetails?: any } | null = null
    let filesSearched = 0
    
    // Get prioritized file list to reduce API calls for relevant content
    const prioritizedFiles = getPrioritizedFiles(cleanEntity)
    console.log(`[Diagnostic Search] Using prioritized file loading for "${cleanEntity}": ${prioritizedFiles.slice(0, 5).join(', ')}${prioritizedFiles.length > 5 ? '...' : ''}`)

    // Search through prioritized educational content files
    let shouldTerminateEarly = false
    
    for (const filename of prioritizedFiles) {
      if (shouldTerminateEarly) break
      
      try {
        const data = await loadContentFile(filename)
        
        if (!data || !data.subject || !data.subject.lessons) {
          continue
        }

        filesSearched++
        
        // Search through all content in this file
        outerLoop: for (const [lessonName, lessonData] of Object.entries(data.subject.lessons)) {
          if (lessonData && typeof lessonData === 'object' && 'topics' in lessonData) {
            const topics = (lessonData as any).topics
            
            for (const [topicName, topicData] of Object.entries(topics)) {
              if (topicData && typeof topicData === 'object' && 'content' in topicData) {
                const { score, medicalTerms, matchDetails } = calculateRelevanceScore(
                  cleanEntity, 
                  topicName, 
                  lessonName, 
                  (topicData as any).content,
                  data.category,
                  data.subject.name
                )
                
                if (score > 0) {
                  const content: EducationalContent = {
                    category: data.category,
                    subject: data.subject.name,
                    lesson: lessonName,
                    topic: topicName,
                    content: (topicData as any).content
                  }

                  if (!bestMatch || score > bestMatch.score) {
                    bestMatch = { 
                      content, 
                      score, 
                      filename, 
                      lesson: lessonName, 
                      topic: topicName,
                      medicalTerms,
                      matchDetails
                    }
                    console.log(`[Diagnostic Search] New best match: ${filename} - ${lessonName} - ${topicName} (score: ${score})`)
                    
                    // Use unified early termination threshold with more aggressive settings to reduce API calls
                    const searchOptions = SEARCH_PRESETS.diagnosticSearch
                    if (searchOptions.enableEarlyTermination && score >= (searchOptions.earlyTerminationScore || 100000)) {
                      console.log(`[Diagnostic Search] Excellent match found (score: ${score}) - terminating search early to save API calls`)
                      shouldTerminateEarly = true
                      break outerLoop
                    }
                    
                    // Additional early termination for very high-quality matches in priority files
                    if (score >= 500000 && prioritizedFiles.indexOf(filename) < 3) {
                      console.log(`[Diagnostic Search] Outstanding match in priority file (score: ${score}) - skipping remaining files`)
                      shouldTerminateEarly = true
                      break outerLoop
                    }
                  }
                }
              }
            }
          }
        }
        
      } catch (error) {
        console.warn(`[Diagnostic Search] Error loading ${filename}:`, error)
        continue
      }
    }

    const searchTime = Date.now() - startTime
    console.log(`[Diagnostic Search] Search completed in ${searchTime}ms`)
    
    // Performance analytics
    const performanceStats = {
      search_time_ms: searchTime,
      files_searched: filesSearched,
      best_match_score: bestMatch?.score || 0,
      used_cache: false,
      ai_organization_used: false
    }
    
    console.log('[Diagnostic Search] Performance:', JSON.stringify(performanceStats))

    // Use unified quality assessment
    const searchOptions = SEARCH_PRESETS.diagnosticSearch
    const quality = bestMatch ? assessSearchQuality(bestMatch.score, searchOptions) : 'none'
    const shouldReject = !bestMatch || shouldRejectResult(bestMatch.score, quality, searchOptions)
    
    if (shouldReject) {
      return createOptimizedResponse({
        success: false,
        metadata: {
          searched_at: new Date().toISOString(),
          search_time_ms: searchTime,
          entity: cleanEntity,
          context_found: false,
          context_quality: 'none',
          files_searched: filesSearched
        }
      }, {
        compress: true,
        cache: {
          maxAge: 300, // 5 minutes for failed searches
          staleWhileRevalidate: 60,
          public: false
        }
      })
    }

    // Extract diagnostic information from the best match (now async with AI organization)
    const diagnosticInfo = await extractDiagnosticInfo(bestMatch!.content.content, cleanEntity)

    const result: DiagnosticSearchResult = {
      success: true,
      entity: cleanEntity,
      results: diagnosticInfo,
      metadata: {
        searched_at: new Date().toISOString(),
        search_time_ms: searchTime,
        entity: cleanEntity,
        context_found: true,
        context_quality: quality,
        files_searched: filesSearched,
        ai_organized: (diagnosticInfo as any).ai_organized || false,
        ai_model: (diagnosticInfo as any).ai_model,
        ai_generation_time_ms: (diagnosticInfo as any).ai_generation_time_ms,
        ai_fallback_attempts: (diagnosticInfo as any).ai_fallback_attempts,
        token_usage: (diagnosticInfo as any).token_usage,
        search_algorithm: 'unified_medical_search_v2',
        search_quality: quality,
        medical_terms_extracted: bestMatch!.medicalTerms ? Object.keys(bestMatch!.medicalTerms).length : 0,
        best_match: {
          filename: bestMatch!.filename,
          lesson: bestMatch!.lesson,
          topic: bestMatch!.topic,
          score: bestMatch!.score,
          match_details: bestMatch!.matchDetails
        }
      }
    }

    // Cache successful search results
    searchResultsCache.set(cacheKey, result)
    searchCacheTimestamps.set(cacheKey, now)
    // Update performance stats
    const finalPerformanceStats = {
      search_time_ms: searchTime,
      files_searched: filesSearched,
      best_match_score: bestMatch?.score || 0,
      used_cache: false,
      ai_organization_used: (diagnosticInfo as any).ai_organized || false,
      token_usage: (diagnosticInfo as any).token_usage?.total_tokens || 0,
      context_quality: bestMatch!.score >= 5000 ? 'excellent' : bestMatch!.score >= 2000 ? 'good' : 'fair'
    }
    
    console.log('[Diagnostic Search] Final Performance:', JSON.stringify(finalPerformanceStats))
    console.log(`[Diagnostic Search] Cached search result for: ${cleanEntity}`)
    
    return createOptimizedResponse(result, {
      compress: true,
      cache: {
        maxAge: 3600, // 1 hour for successful searches
        staleWhileRevalidate: 600, // 10 minutes
        public: false
      }
    })

  } catch (error) {
    const searchTime = Date.now() - startTime
    console.error('[Diagnostic Search] Error:', error)
    
    // Enhanced error response with more context
    const errorResponse = {
      error: 'Failed to search diagnostic entity',
      details: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        searched_at: new Date().toISOString(),
        search_time_ms: searchTime,
        error_type: error instanceof Error ? error.constructor.name : 'Unknown',
        files_searched: 0,
        context_found: false,
        context_quality: 'error'
      }
    }
    
    return NextResponse.json(errorResponse, { status: 500 })
  }
}
