// Centralized AI model configuration
// This file defines all available AI models and their status across the application

export interface AIModel {
  id: string
  name: string
  provider: 'llama' | 'gemini' | 'mistral' | 'deepseek' | 'claude' | 'chatgpt'
  available: boolean
  deprecated?: boolean
  description?: string
  contextLength?: string
  temperature?: number
  maxTokens?: number
}

// Helper function to determine provider from model ID
export function getModelProvider(model: string): string {
  if (model.startsWith('llama-') || model.startsWith('Llama-')) return 'groq'
  if (model.startsWith('Cerebras-') || model.startsWith('cerebras-')) return 'groq'
  if (model.startsWith('Groq-') || model.startsWith('groq-')) return 'groq'
  if (model.startsWith('gemini-')) return 'google'
  if (model.startsWith('mistral-') || model.startsWith('open-mistral') || model.startsWith('open-mixtral') || model.startsWith('magistral-') || model.startsWith('ministral-')) return 'mistral'
  if (model.startsWith('deepseek-')) return 'deepseek'
  if (model.startsWith('claude-')) return 'claude'
  if (model.startsWith('gpt-')) return 'chatgpt'
  return 'google' // default to google instead of gemini
}

// Active models (available for selection) - Prioritized for WSI Question Generator
export const ACTIVE_AI_MODELS: AIModel[] = [
  // Gemini models (prioritized for WSI generation)
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    available: true,
    description: 'Latest Gemini 2.5 Pro model - most capable',
    contextLength: '2M tokens'
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    available: true,
    description: 'Latest Gemini 2.5 Flash model - fast and efficient',
    contextLength: '1M tokens'
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'gemini',
    available: true,
    description: 'Lightweight Gemini 2.5 Flash model - ultra fast',
    contextLength: '1M tokens'
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    available: true,
    description: 'Gemini 2.0 Flash model',
    contextLength: '1M tokens'
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    provider: 'gemini',
    available: true,
    description: 'Lightweight Gemini 2.0 Flash model',
    contextLength: '1M tokens'
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    available: true,
    description: 'Fast and efficient Gemini 1.5 model - preferred for WSI questions',
    contextLength: '1M tokens'
  },
  {
    id: 'gemini-1.5-flash-8b',
    name: 'Gemini 1.5 Flash 8B',
    provider: 'gemini',
    available: true,
    description: 'Efficient 8B parameter Gemini 1.5 Flash model',
    contextLength: '1M tokens'
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    available: true,
    description: 'Most capable Gemini 1.5 model',
    contextLength: '2M tokens'
  },

  // Mistral models (second choice)
  {
    id: 'mistral-medium-2505',
    name: 'Mistral Medium 3',
    provider: 'mistral',
    available: true,
    description: 'Latest Mistral Medium 3 model - enhanced capabilities',
    contextLength: '128K tokens'
  },
  {
    id: 'magistral-medium-2507',
    name: 'Magistral Medium 1.1',
    provider: 'mistral',
    available: true,
    description: 'Magistral Medium 1.1 model - optimized performance',
    contextLength: '128K tokens'
  },
  {
    id: 'magistral-medium-2506',
    name: 'Magistral Medium 1',
    provider: 'mistral',
    available: true,
    description: 'Magistral Medium 1 model - reliable performance',
    contextLength: '128K tokens'
  },
  {
    id: 'mistral-large-2411',
    name: 'Mistral Large 2.1',
    provider: 'mistral',
    available: true,
    description: 'Latest Mistral Large 2.1 model - most capable',
    contextLength: '128K tokens'
  },
  {
    id: 'mistral-large-latest',
    name: 'Mistral Large',
    provider: 'mistral',
    available: true,
    description: 'Mistral\'s largest and most capable model',
    contextLength: '128K tokens'
  },
  {
    id: 'mistral-small-2407',
    name: 'Mistral Small 2',
    provider: 'mistral',
    available: true,
    description: 'Mistral Small 2 model - efficient and fast',
    contextLength: '32K tokens'
  },
  {
    id: 'magistral-small-2507',
    name: 'Magistral Small 1.1',
    provider: 'mistral',
    available: true,
    description: 'Magistral Small 1.1 model - optimized efficiency',
    contextLength: '32K tokens'
  },
  {
    id: 'mistral-small-2506',
    name: 'Mistral Small 3.2',
    provider: 'mistral',
    available: true,
    description: 'Mistral Small 3.2 model - balanced performance',
    contextLength: '32K tokens'
  },
  {
    id: 'magistral-small-2506',
    name: 'Magistral Small 1',
    provider: 'mistral',
    available: true,
    description: 'Magistral Small 1 model - reliable efficiency',
    contextLength: '32K tokens'
  },
  {
    id: 'mistral-small-2503',
    name: 'Mistral Small 3.1',
    provider: 'mistral',
    available: true,
    description: 'Mistral Small 3.1 model - enhanced efficiency',
    contextLength: '32K tokens'
  },
  {
    id: 'mistral-small-2501',
    name: 'Mistral Small 3',
    provider: 'mistral',
    available: true,
    description: 'Mistral Small 3 model - fast inference',
    contextLength: '32K tokens'
  },
  {
    id: 'ministral-3b-2410',
    name: 'Ministral 3B',
    provider: 'mistral',
    available: true,
    description: 'Ministral 3B model - ultra-efficient lightweight model',
    contextLength: '32K tokens'
  },
  {
    id: 'ministral-8b-2410',
    name: 'Ministral 8B',
    provider: 'mistral',
    available: true,
    description: 'Ministral 8B model - efficient mid-size model',
    contextLength: '32K tokens'
  },

  // LLAMA models (fallback)
  {
    id: 'Llama-3.3-70B-Instruct',
    name: 'LLAMA 3.3 70B Instruct',
    provider: 'llama',
    available: true,
    description: 'LLAMA 3.3 model with 70B parameters - fallback option',
    contextLength: '128K tokens'
  },
  {
    id: 'Llama-3.3-8B-Instruct',
    name: 'LLAMA 3.3 8B Instruct',
    provider: 'llama',
    available: true,
    description: 'LLAMA 3.3 model with 8B parameters - efficient option',
    contextLength: '128K tokens'
  },
  {
    id: 'Llama-4-Maverick-17B-128E-Instruct-FP8',
    name: 'LLAMA 4 Maverick 17B',
    provider: 'llama',
    available: true,
    description: 'Latest LLAMA 4 model with enhanced capabilities',
    contextLength: '128K tokens'
  },
  {
    id: 'Llama-4-Scout-17B-16E-Instruct-FP8',
    name: 'LLAMA 4 Scout 17B',
    provider: 'llama',
    available: true,
    description: 'LLAMA 4 Scout model optimized for fast inference',
    contextLength: '128K tokens'
  },
  {
    id: 'Cerebras-Llama-4-Maverick-17B-128E-Instruct',
    name: 'Cerebras LLAMA 4 Maverick 17B',
    provider: 'llama',
    available: true,
    description: 'LLAMA 4 Maverick optimized for Cerebras hardware',
    contextLength: '128K tokens'
  },
  {
    id: 'Cerebras-Llama-4-Scout-17B-16E-Instruct',
    name: 'Cerebras LLAMA 4 Scout 17B',
    provider: 'llama',
    available: true,
    description: 'LLAMA 4 Scout optimized for Cerebras hardware',
    contextLength: '128K tokens'
  },
  {
    id: 'Groq-Llama-4-Maverick-17B-128E-Instruct',
    name: 'Groq LLAMA 4 Maverick 17B',
    provider: 'llama',
    available: true,
    description: 'LLAMA 4 Maverick optimized for Groq hardware',
    contextLength: '128K tokens'
  }
]

// Disabled models (show in UI but not selectable)
export const DISABLED_AI_MODELS: AIModel[] = [
  // ChatGPT models (disabled due to API issues)
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'chatgpt',
    available: false,
    description: 'OpenAI GPT-4o model (currently unavailable)'
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'chatgpt',
    available: false,
    description: 'OpenAI GPT-4o Mini model (currently unavailable)'
  },

  // Claude models (disabled due to API issues)
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'claude',
    available: false,
    description: 'Anthropic Claude 3.5 Sonnet (currently unavailable)'
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'claude',
    available: false,
    description: 'Anthropic Claude 3.5 Haiku (currently unavailable)'
  }
]

// All models combined
export const ALL_AI_MODELS: AIModel[] = [...ACTIVE_AI_MODELS, ...DISABLED_AI_MODELS]

// Get model by ID
export function getModelById(id: string): AIModel | undefined {
  return ALL_AI_MODELS.find(model => model.id === id)
}

// Get models by provider
export function getModelsByProvider(provider: string): AIModel[] {
  return ALL_AI_MODELS.filter(model => model.provider === provider)
}

// Get only active models
export function getActiveModels(): AIModel[] {
  return ACTIVE_AI_MODELS
}

// Get only disabled models
export function getDisabledModels(): AIModel[] {
  return DISABLED_AI_MODELS
}

// Check if model is available
export function isModelAvailable(modelId: string): boolean {
  const model = getModelById(modelId)
  return model?.available ?? false
}

// Default model selection - prioritize Gemini 1.5 for WSI question generation
export const DEFAULT_MODEL = 'gemini-1.5-flash'

// API key configuration - All keys must be provided via environment variables
export const API_KEYS = {
  groq: process.env.NEXT_PUBLIC_LLAMA_API_KEY || '',
  google: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '',
  claude: process.env.NEXT_PUBLIC_CLAUDE_API_KEY || '',
  chatgpt: process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
  mistral: process.env.NEXT_PUBLIC_MISTRAL_API_KEY || '',
  deepseek: process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || ''
}

// Get API key for provider
export function getApiKey(provider: string): string {
  const key = API_KEYS[provider as keyof typeof API_KEYS]
  if (!key) {
    console.warn(`⚠️ No API key found for provider: ${provider}. Please set NEXT_PUBLIC_${provider.toUpperCase()}_API_KEY in your environment variables.`)
  }
  return key || ''
}

// Check if API key is available for provider
export function hasApiKey(provider: string): boolean {
  const key = API_KEYS[provider as keyof typeof API_KEYS]
  return !!(key && key.trim() !== '')
}

// Get all available providers (those with API keys)
export function getAvailableProviders(): string[] {
  return Object.entries(API_KEYS)
    .filter(([, key]) => key && key.trim() !== '')
    .map(([provider]) => provider)
}
