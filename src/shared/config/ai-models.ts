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
  tpmLimit?: number // Tokens Per Minute limit
}

// Helper function to determine provider from model ID
export function getModelProvider(model: string): string {
  // LLAMA models use Meta's direct API
  if (model.startsWith('llama-') || model.startsWith('Llama-')) return 'llama'
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
  // High rate limit models (1M TPM)
  {
    id: 'Llama-3.3-70B-Instruct',
    name: 'Llama 3.3 70B',
    provider: 'llama',
    available: true,
    description: 'Large Llama model - proven performance',
    contextLength: '128K tokens',
    tpmLimit: 1000000
  },
  {
    id: 'Llama-4-Maverick-17B-128E-Instruct-FP8',
    name: 'Llama 4 Maverick 17B',
    provider: 'llama',
    available: true,
    description: 'Complex reasoning powerhouse',
    contextLength: '128K tokens',
    tpmLimit: 1000000
  },
  {
    id: 'Llama-4-Scout-17B-16E-Instruct-FP8',
    name: 'Llama 4 Scout 17B',
    provider: 'llama',
    available: true,
    description: 'Latest multimodal + medical reasoning',
    contextLength: '16K tokens',
    tpmLimit: 1000000
  },
  {
    id: 'Llama-3.3-8B-Instruct',
    name: 'Llama 3.3 8B',
    provider: 'llama',
    available: true,
    description: 'Fast, excellent quality',
    contextLength: '128K tokens',
    tpmLimit: 1000000
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    available: true,
    description: 'Gemini 2.0 Flash model',
    contextLength: '1M tokens',
    tpmLimit: 1000000
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    provider: 'gemini',
    available: true,
    description: 'Lightweight Gemini 2.0 Flash model',
    contextLength: '1M tokens',
    tpmLimit: 1000000
  },

  // Medium rate limit models (500K TPM)
  {
    id: 'mistral-large-2411',
    name: 'Mistral Large 2.1',
    provider: 'mistral',
    available: true,
    description: 'Latest Mistral Large 2.1 model - most capable',
    contextLength: '128K tokens',
    tpmLimit: 500000
  },
  {
    id: 'mistral-large-latest',
    name: 'Mistral Large',
    provider: 'mistral',
    available: true,
    description: 'Mistral\'s largest and most capable model',
    contextLength: '128K tokens',
    tpmLimit: 500000
  },
  {
    id: 'mistral-medium-2505',
    name: 'Mistral Medium 3',
    provider: 'mistral',
    available: true,
    description: 'Latest Mistral Medium 3 model - enhanced capabilities',
    contextLength: '128K tokens',
    tpmLimit: 500000
  },
  {
    id: 'magistral-medium-2507',
    name: 'Magistral Medium 1.1',
    provider: 'mistral',
    available: true,
    description: 'Magistral Medium 1.1 model - optimized performance',
    contextLength: '128K tokens',
    tpmLimit: 500000
  },
  {
    id: 'magistral-medium-2506',
    name: 'Magistral Medium 1',
    provider: 'mistral',
    available: true,
    description: 'Magistral Medium 1 model - reliable performance',
    contextLength: '128K tokens',
    tpmLimit: 500000
  },
  {
    id: 'mistral-small-2506',
    name: 'Mistral Small 3.2',
    provider: 'mistral',
    available: true,
    description: 'Mistral Small 3.2 model - balanced performance',
    contextLength: '32K tokens',
    tpmLimit: 500000
  },
  {
    id: 'magistral-small-2507',
    name: 'Magistral Small 1.1',
    provider: 'mistral',
    available: true,
    description: 'Magistral Small 1.1 model - optimized efficiency',
    contextLength: '32K tokens',
    tpmLimit: 500000
  },
  {
    id: 'magistral-small-2506',
    name: 'Magistral Small 1',
    provider: 'mistral',
    available: true,
    description: 'Magistral Small 1 model - reliable efficiency',
    contextLength: '32K tokens',
    tpmLimit: 500000
  },
  {
    id: 'mistral-small-2503',
    name: 'Mistral Small 3.1',
    provider: 'mistral',
    available: true,
    description: 'Mistral Small 3.1 model - enhanced efficiency',
    contextLength: '32K tokens',
    tpmLimit: 500000
  },
  {
    id: 'mistral-small-2501',
    name: 'Mistral Small 3',
    provider: 'mistral',
    available: true,
    description: 'Mistral Small 3 model - fast inference',
    contextLength: '32K tokens',
    tpmLimit: 500000
  },
  {
    id: 'ministral-3b-2410',
    name: 'Ministral 3B',
    provider: 'mistral',
    available: true,
    description: 'Ministral 3B model - ultra-efficient lightweight model',
    contextLength: '32K tokens',
    tpmLimit: 500000
  },
  {
    id: 'ministral-8b-2410',
    name: 'Ministral 8B',
    provider: 'mistral',
    available: true,
    description: 'Ministral 8B model - efficient mid-size model',
    contextLength: '32K tokens',
    tpmLimit: 500000
  },

  // Low rate limit models (250K TPM)
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    available: true,
    description: 'Best price-performance balance',
    contextLength: '1M tokens',
    tpmLimit: 250000
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'gemini',
    available: true,
    description: 'Most cost-effective, high throughput',
    contextLength: '1M tokens',
    tpmLimit: 250000
  },

  // Very low rate limit models (125K TPM)
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    available: true,
    description: 'Most powerful thinking model',
    contextLength: '2M tokens',
    tpmLimit: 125000
  }
]

// Simple TPM-based fallback lists
export const HIGH_TPM_MODELS = ACTIVE_AI_MODELS.filter(model => (model.tpmLimit || 0) >= 1000000).map(model => model.id)
export const MEDIUM_TPM_MODELS = ACTIVE_AI_MODELS.filter(model => (model.tpmLimit || 0) >= 500000 && (model.tpmLimit || 0) < 1000000).map(model => model.id)
export const LOW_TPM_MODELS = ACTIVE_AI_MODELS.filter(model => (model.tpmLimit || 0) < 500000).map(model => model.id)

// Combined fallback list ordered by TPM (high to low)
export const TPM_ORDERED_FALLBACK = [
  ...HIGH_TPM_MODELS,
  ...MEDIUM_TPM_MODELS,
  ...LOW_TPM_MODELS
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

  // GPT-5 model (disabled - not yet available)
  {
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'chatgpt',
    available: false,
    description: 'OpenAI GPT-5 (not yet available)',
    contextLength: 'TBD'
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
  },

  // Mistral models (disabled due to issues)
  {
    id: 'mistral-small-2407',
    name: 'Mistral Small 2',
    provider: 'mistral',
    available: false,
    description: 'Mistral Small 2 model (disabled - API issues)'
  },

  // Groq and Cerebras models (disabled - excluded from configuration)
  {
    id: 'Cerebras-Llama-4-Maverick-17B-128E-Instruct',
    name: 'Cerebras LLAMA 4 Maverick 17B',
    provider: 'llama',
    available: false,
    description: 'LLAMA 4 Maverick optimized for Cerebras hardware (unavailable)'
  },
  {
    id: 'Cerebras-Llama-4-Scout-17B-16E-Instruct',
    name: 'Cerebras LLAMA 4 Scout 17B',
    provider: 'llama',
    available: false,
    description: 'LLAMA 4 Scout optimized for Cerebras hardware (unavailable)'
  },
  {
    id: 'Groq-Llama-4-Maverick-17B-128E-Instruct',
    name: 'Groq LLAMA 4 Maverick 17B',
    provider: 'llama',
    available: false,
    description: 'LLAMA 4 Maverick optimized for Groq hardware (unavailable)'
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
export const DEFAULT_MODEL = 'gemini-2.5-flash'

// API key configuration - All keys must be provided via environment variables
export const API_KEYS = {
  llama: process.env.NEXT_PUBLIC_LLAMA_API_KEY || process.env.LLAMA_API_KEY || '', // LLAMA models use Meta's direct API ONLY
  groq: process.env.NEXT_PUBLIC_GROQ_API_KEY || '', // Groq API key (separate from LLAMA)
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
