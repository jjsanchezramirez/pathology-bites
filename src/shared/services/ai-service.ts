// Centralized AI Service
// Handles all AI model interactions across the application

import { getApiKey, getModelProvider } from '@/shared/config/ai-models'

// Types
export interface AIRequest {
  model: string
  prompt: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

export interface AIResponse {
  content: string
  tokenUsage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  responseTime: number
  model: string
  provider: string
}

export interface AIError {
  message: string
  type: 'unauthorized' | 'rate_limit' | 'quota_exceeded' | 'timeout' | 'server_error' | 'unknown'
  statusCode?: number
  retryable: boolean
}

// Configuration
const DEFAULT_CONFIG = {
  temperature: 0.7,
  maxTokens: 4000,
  timeout: 20000, // 20 seconds
  maxRetries: 3,
  retryDelay: 1000 // Base delay in ms
}

export class AIService {
  private config: typeof DEFAULT_CONFIG

  constructor(config: Partial<typeof DEFAULT_CONFIG> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Generate text using specified AI model
   */
  async generateText(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now()
    const provider = getModelProvider(request.model)
    const apiKey = getApiKey(provider)

    if (!apiKey) {
      throw this.createError(`No API key found for provider: ${provider}`, 'unauthorized', 401, false)
    }

    console.log(`[AI Service] Generating with ${request.model} (${provider})`)

    try {
      const response = await this.callProvider(provider, request, apiKey)
      const responseTime = Date.now() - startTime

      return {
        ...response,
        responseTime,
        model: request.model,
        provider
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Generate structured content (like JSON) with validation
   */
  async generateStructured<T>(
    request: AIRequest, 
    validator?: (data: any) => T
  ): Promise<AIResponse & { parsed?: T }> {
    const response = await this.generateText(request)

    if (validator) {
      try {
        const parsed = this.extractJSON(response.content)
        const validated = validator(parsed)
        return { ...response, parsed: validated }
      } catch (parseError) {
        throw this.createError(
          `Failed to parse structured response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          'server_error',
          500,
          false
        )
      }
    }

    return response
  }

  /**
   * Generate with automatic fallback to next model on failure
   */
  async generateWithFallback(
    request: AIRequest,
    fallbackModels: string[]
  ): Promise<AIResponse> {
    const allModels = [request.model, ...fallbackModels]
    let lastError: AIError | null = null

    for (let i = 0; i < allModels.length; i++) {
      const currentModel = allModels[i]
      
      try {
        console.log(`[AI Service] Trying model ${i + 1}/${allModels.length}: ${currentModel}`)
        return await this.generateText({ ...request, model: currentModel })
      } catch (error) {
        lastError = error as AIError
        console.warn(`[AI Service] Model ${currentModel} failed: ${lastError.message}`)
        
        // If error is not retryable, try next model immediately
        if (!lastError.retryable && i < allModels.length - 1) {
          continue
        }
        
        // If this is the last model, throw the error
        if (i === allModels.length - 1) {
          throw lastError
        }
      }
    }

    throw lastError || this.createError('All models failed', 'server_error', 500, false)
  }

  /**
   * Generate with TPM-based fallback (simple approach)
   */
  async generateWithTPMFallback(
    request: AIRequest
  ): Promise<AIResponse> {
    const { TPM_ORDERED_FALLBACK } = await import('@/shared/config/ai-models')
    return this.generateWithFallback(request, TPM_ORDERED_FALLBACK)
  }

  /**
   * Call the appropriate AI provider
   */
  private async callProvider(
    provider: string,
    request: AIRequest,
    apiKey: string
  ): Promise<{ content: string; tokenUsage?: any }> {
    switch (provider) {
      case 'llama':
        return await this.callMetaAPI(request, apiKey)
      case 'google':
        return await this.callGoogleAPI(request, apiKey)
      case 'mistral':
        return await this.callMistralAPI(request, apiKey)
      default:
        throw this.createError(`Unsupported provider: ${provider}`, 'server_error', 500, false)
    }
  }

  /**
   * Meta/Llama API implementation
   */
  private async callMetaAPI(request: AIRequest, apiKey: string): Promise<{ content: string; tokenUsage?: any }> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const messages = []
      
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt })
      }
      
      messages.push({ role: 'user', content: request.prompt })

      const response = await fetch('https://api.llama.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: request.model,
          messages,
          max_completion_tokens: request.maxTokens || this.config.maxTokens,
          temperature: request.temperature || this.config.temperature
        })
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw this.createAPIError('Meta LLAMA', response.status, errorText)
      }

      const data = await response.json()
      
      // Handle different response formats
      let content = ''
      if (data.completion_message?.content?.text) {
        content = data.completion_message.content.text
      } else if (data.choices?.[0]?.message?.content) {
        content = data.choices[0].message.content
      }

      // Extract token usage
      const tokenUsage = this.extractTokenUsage(data, ['usage', 'token_usage', 'completion_message.usage'])

      return { content: content || '', tokenUsage }
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createError('Request timeout', 'timeout', 408, true)
      }
      throw error
    }
  }

  /**
   * Google/Gemini API implementation
   */
  private async callGoogleAPI(request: AIRequest, apiKey: string): Promise<{ content: string; tokenUsage?: any }> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: request.prompt }] }],
          generationConfig: {
            temperature: request.temperature || this.config.temperature,
            maxOutputTokens: request.maxTokens || this.config.maxTokens
          }
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw this.createAPIError('Google Gemini', response.status, errorText)
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

  /**
   * Mistral API implementation
   */
  private async callMistralAPI(request: AIRequest, apiKey: string): Promise<{ content: string; tokenUsage?: any }> {
    const messages = []
    
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }
    
    messages.push({ role: 'user', content: request.prompt })

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: request.model,
        messages,
        temperature: request.temperature || this.config.temperature,
        max_tokens: request.maxTokens || this.config.maxTokens
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw this.createAPIError('Mistral', response.status, errorText)
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

  /**
   * Extract JSON from AI response text
   */
  private extractJSON(text: string): any {
    // Strategy 1: Smart brace counting
    const firstBrace = text.indexOf('{')
    if (firstBrace !== -1) {
      let braceCount = 0
      let i = firstBrace
      let inString = false
      let escapeNext = false

      while (i < text.length) {
        const char = text[i]

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
              const jsonStr = text.substring(firstBrace, i + 1)
              try {
                return JSON.parse(jsonStr)
              } catch (e) {
                break
              }
            }
          }
        }
        i++
      }
    }

    // Strategy 2: Code block extraction
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1])
      } catch (e) {
        // Continue to next strategy
      }
    }

    // Strategy 3: Greedy match
    const greedyMatch = text.match(/\{[\s\S]*\}/)
    if (greedyMatch) {
      try {
        return JSON.parse(greedyMatch[0])
      } catch (e) {
        // Try to fix common issues
        const fixedJson = greedyMatch[0]
          .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes to keys
          .replace(/:\s*'([^']*)'/g, ': "$1"') // Fix single quotes
          .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas

        try {
          return JSON.parse(fixedJson)
        } catch (fixError) {
          throw new Error(`JSON parsing failed: ${e instanceof Error ? e.message : 'Parse error'}`)
        }
      }
    }

    throw new Error('No valid JSON found in response')
  }

  /**
   * Extract token usage from various response formats
   */
  private extractTokenUsage(data: any, paths: string[]): any {
    for (const path of paths) {
      const usage = this.getNestedValue(data, path)
      if (usage && typeof usage === 'object') {
        return {
          prompt_tokens: usage.prompt_tokens || 0,
          completion_tokens: usage.completion_tokens || 0,
          total_tokens: usage.total_tokens || 0
        }
      }
    }
    return undefined
  }

  /**
   * Get nested object value by dot notation path
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * Create standardized API error
   */
  private createAPIError(provider: string, status: number, errorText: string): AIError {
    let type: AIError['type'] = 'unknown'
    let retryable = false

    if (status === 401) {
      type = 'unauthorized'
    } else if (status === 429) {
      type = 'rate_limit'
      retryable = true
    } else if (status === 402) {
      type = 'quota_exceeded'
    } else if (status >= 500) {
      type = 'server_error'
      retryable = true
    }

    return this.createError(`${provider} API error: ${status} ${errorText}`, type, status, retryable)
  }

  /**
   * Create standardized error
   */
  private createError(message: string, type: AIError['type'], statusCode: number, retryable: boolean): AIError {
    const error = new Error(message) as any
    error.type = type
    error.statusCode = statusCode
    error.retryable = retryable
    return error as AIError
  }

  /**
   * Handle and classify errors
   */
  private handleError(error: any): AIError {
    if (error.type) {
      return error // Already an AIError
    }

    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return this.createError(error.message, 'timeout', 408, true)
      }
      if (error.message.includes('network')) {
        return this.createError(error.message, 'server_error', 500, true)
      }
    }

    return this.createError(error.message || 'Unknown AI service error', 'unknown', 500, false)
  }
}

// Default instance
export const aiService = new AIService()

// Convenience functions for common use cases
export async function generateText(request: AIRequest): Promise<AIResponse> {
  return aiService.generateText(request)
}

export async function generateStructured<T>(
  request: AIRequest, 
  validator?: (data: any) => T
): Promise<AIResponse & { parsed?: T }> {
  return aiService.generateStructured(request, validator)
}

export async function generateWithFallback(
  request: AIRequest,
  fallbackModels: string[]
): Promise<AIResponse> {
  return aiService.generateWithFallback(request, fallbackModels)
}

export async function generateWithTPMFallback(
  request: AIRequest
): Promise<AIResponse> {
  return aiService.generateWithTPMFallback(request)
}