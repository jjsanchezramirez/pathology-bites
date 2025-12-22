/**
 * AI Content Parser for Diagnostic Search
 *
 * Takes raw educational content and uses AI to extract and organize:
 * - Clinical features
 * - Histologic findings
 * - Immunohistochemistry (positive/negative)
 * - Differential diagnosis
 * - Molecular findings
 */

import { getApiKey, getModelProvider } from '@/shared/config/ai-models'

const AI_MODELS = [
  'gemini-2.5-flash',
  'mistral-small-2506',
  'gemini-2.0-flash',
  'mistral-small-2503',
  'ministral-8b-2410',
]

interface ParsedContent {
  clinical_features: string[]
  histologic_findings: string[]
  immunohistochemistry: {
    positive: string[]
    negative: string[]
  }
  differential_diagnosis: string[]
  molecular_findings: string[]
  additional_info: string[]
  ai_metadata?: {
    model: string
    generation_time_ms: number
    token_usage?: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
    }
  }
}

/**
 * Parse content using AI
 */
export async function parseContentWithAI(
  rawContent: any,
  entity: string,
  modelIndex: number = 0
): Promise<ParsedContent | null> {
  if (modelIndex >= AI_MODELS.length) {
    console.error('[AI Parser] All models exhausted')
    return null
  }

  const currentModel = AI_MODELS[modelIndex]
  const modelProvider = getModelProvider(currentModel)

  console.log(`[AI Parser] Using model: ${currentModel} (${modelProvider})`)

  try {
    const startTime = Date.now()
    const prompt = createParsingPrompt(rawContent, entity)

    let response, data, content, tokenUsage = null

    if (modelProvider === 'gemini') {
      const apiKey = getApiKey('gemini')
      if (!apiKey) throw new Error('No Gemini API key')

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 2000,
              }
            })
          }
        )
        clearTimeout(timeoutId)
      } catch (error) {
        clearTimeout(timeoutId)
        throw error
      }

      if (!response.ok) throw new Error(`Gemini error: ${response.status}`)

      data = await response.json()
      content = data.candidates?.[0]?.content?.parts?.[0]?.text

      tokenUsage = data.usageMetadata ? {
        prompt_tokens: data.usageMetadata.promptTokenCount || 0,
        completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
        total_tokens: data.usageMetadata.totalTokenCount || 0
      } : null

    } else if (modelProvider === 'mistral' || modelProvider === 'llama') {
      const apiKey = getApiKey(modelProvider)
      if (!apiKey) throw new Error(`No ${modelProvider} API key`)

      const endpoint = modelProvider === 'mistral'
        ? 'https://api.mistral.ai/v1/chat/completions'
        : 'https://api.deepinfra.com/v1/openai/chat/completions'

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: currentModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 2000
          })
        })
        clearTimeout(timeoutId)
      } catch (error) {
        clearTimeout(timeoutId)
        throw error
      }

      if (!response.ok) throw new Error(`${modelProvider} error: ${response.status}`)

      data = await response.json()
      content = data.choices?.[0]?.message?.content

      tokenUsage = data.usage ? {
        prompt_tokens: data.usage.prompt_tokens || 0,
        completion_tokens: data.usage.completion_tokens || 0,
        total_tokens: data.usage.total_tokens || 0
      } : null
    }

    if (!content) throw new Error('No content from AI')

    const parsed = parseAIResponse(content)
    if (!parsed) throw new Error('Failed to parse AI response')

    const generationTime = Date.now() - startTime
    console.log(`[AI Parser] Success with ${currentModel} in ${generationTime}ms`)

    return {
      ...parsed,
      ai_metadata: {
        model: currentModel,
        generation_time_ms: generationTime,
        token_usage: tokenUsage || undefined
      }
    }

  } catch (error) {
    console.warn(`[AI Parser] Model ${currentModel} failed:`, error)
    return await parseContentWithAI(rawContent, entity, modelIndex + 1)
  }
}

/**
 * Create parsing prompt
 */
function createParsingPrompt(rawContent: any, entity: string): string {
  const contentText = JSON.stringify(rawContent, null, 2)

  return `You are a pathology expert. Extract and organize diagnostic information about "${entity}" from this educational content.

Content:
${contentText}

Please organize this into clean, readable sections:

1. **Clinical Features**: Patient demographics, presentation, symptoms, epidemiology (2-5 clear sentences)
2. **Histologic Findings**: Key microscopic features (3-6 clear bullet points)
3. **Immunohistochemistry**:
   - Positive markers (list standard marker names like CD20, Ki-67)
   - Negative markers
4. **Differential Diagnosis**: Other diagnostic entities to consider (3-6 items)
5. **Molecular Findings**: Genetic alterations, mutations, translocations (2-5 items)
6. **Additional Information**: Prognosis, treatment, grading, staging (if available)

IMPORTANT:
- Use complete, readable sentences
- Fix any run-together text (add spaces)
- Remove duplicates
- Use standard medical terminology
- Keep it concise but informative

Return ONLY valid JSON in this exact format:
{
  "clinical_features": ["feature1", "feature2"],
  "histologic_findings": ["finding1", "finding2"],
  "immunohistochemistry": {
    "positive": ["CD20", "CD79a"],
    "negative": ["CD3", "CD5"]
  },
  "differential_diagnosis": ["diagnosis1", "diagnosis2"],
  "molecular_findings": ["finding1", "finding2"],
  "additional_info": ["info1", "info2"]
}`
}

/**
 * Parse AI response
 */
function parseAIResponse(content: string): Omit<ParsedContent, 'ai_metadata'> | null {
  try {
    let cleanContent = content.trim()
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    const parsed = JSON.parse(cleanContent)

    return {
      clinical_features: Array.isArray(parsed.clinical_features) ? parsed.clinical_features : [],
      histologic_findings: Array.isArray(parsed.histologic_findings) ? parsed.histologic_findings : [],
      immunohistochemistry: {
        positive: Array.isArray(parsed.immunohistochemistry?.positive) ? parsed.immunohistochemistry.positive : [],
        negative: Array.isArray(parsed.immunohistochemistry?.negative) ? parsed.immunohistochemistry.negative : []
      },
      differential_diagnosis: Array.isArray(parsed.differential_diagnosis) ? parsed.differential_diagnosis : [],
      molecular_findings: Array.isArray(parsed.molecular_findings) ? parsed.molecular_findings : [],
      additional_info: Array.isArray(parsed.additional_info) ? parsed.additional_info : []
    }
  } catch (error) {
    console.error('[AI Parser] Failed to parse response:', error)
    return null
  }
}
