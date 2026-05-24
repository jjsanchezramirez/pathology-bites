// Centralized AI model configuration
// This file defines all available AI models and their status across the application

export interface AIModel {
  id: string;
  name: string;
  provider: "llama" | "gemini" | "mistral" | "claude";
  available: boolean;
  deprecated?: boolean;
  description?: string;
  contextLength?: string;
  temperature?: number;
  maxTokens?: number;
  tpmLimit?: number; // Tokens Per Minute limit
}

// Helper function to determine provider from model ID
export function getModelProvider(model: string): string {
  if (model.startsWith("llama-") || model.startsWith("Llama-")) return "llama";
  if (model.startsWith("gemini-")) return "google";
  if (
    model.startsWith("mistral-") ||
    model.startsWith("open-mistral") ||
    model.startsWith("open-mixtral") ||
    model.startsWith("magistral-") ||
    model.startsWith("ministral-")
  )
    return "mistral";
  if (model.startsWith("claude-")) return "claude";
  return "google";
}

// Active models (available for selection) - Prioritized for WSI Question Generator
export const ACTIVE_AI_MODELS: AIModel[] = [
  // High rate limit models (1M TPM)
  {
    id: "Llama-3.3-70B-Instruct",
    name: "Llama 3.3 70B",
    provider: "llama",
    available: true,
    description: "Large Llama model - proven performance",
    contextLength: "128K tokens",
    tpmLimit: 1000000,
  },
  {
    id: "Llama-4-Maverick-17B-128E-Instruct-FP8",
    name: "Llama 4 Maverick 17B",
    provider: "llama",
    available: true,
    description: "Complex reasoning powerhouse",
    contextLength: "128K tokens",
    tpmLimit: 1000000,
  },
  {
    id: "Llama-4-Scout-17B-16E-Instruct-FP8",
    name: "Llama 4 Scout 17B",
    provider: "llama",
    available: true,
    description: "Latest multimodal + medical reasoning",
    contextLength: "16K tokens",
    tpmLimit: 1000000,
  },
  {
    id: "Llama-3.3-8B-Instruct",
    name: "Llama 3.3 8B",
    provider: "llama",
    available: true,
    description: "Fast, excellent quality",
    contextLength: "128K tokens",
    tpmLimit: 1000000,
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    provider: "gemini",
    available: true,
    description: "Most cost-effective Gemini, highest free-tier RPD",
    contextLength: "1M tokens",
    tpmLimit: 1000000,
  },

  // Medium rate limit models (500K TPM)
  {
    id: "mistral-large-latest",
    name: "Mistral Large",
    provider: "mistral",
    available: true,
    description: "Mistral's largest and most capable model",
    contextLength: "128K tokens",
    tpmLimit: 500000,
  },
  {
    id: "mistral-medium-2505",
    name: "Mistral Medium 3",
    provider: "mistral",
    available: true,
    description: "Latest Mistral Medium 3 model - enhanced capabilities",
    contextLength: "128K tokens",
    tpmLimit: 500000,
  },
  {
    id: "mistral-small-2506",
    name: "Mistral Small 3.2",
    provider: "mistral",
    available: true,
    description: "Mistral Small 3.2 model - balanced performance",
    contextLength: "32K tokens",
    tpmLimit: 500000,
  },
  {
    id: "mistral-small-2503",
    name: "Mistral Small 3.1",
    provider: "mistral",
    available: true,
    description: "Mistral Small 3.1 model - enhanced efficiency",
    contextLength: "32K tokens",
    tpmLimit: 500000,
  },
  {
    id: "mistral-small-2501",
    name: "Mistral Small 3",
    provider: "mistral",
    available: true,
    description: "Mistral Small 3 model - fast inference",
    contextLength: "32K tokens",
    tpmLimit: 500000,
  },

  // Anthropic Claude models
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "claude",
    available: true,
    description: "Excellent vision, spatial reasoning, and structured output",
    contextLength: "200K tokens",
    tpmLimit: 200000,
  },
];

// ---------------------------------------------------------------------------
// Unified fallback chains
// ---------------------------------------------------------------------------
// Free-tier only. Quota-first ordering: Llama → Mistral → Gemini.
//
// Claude is INTENTIONALLY EXCLUDED — it's paid, and we never want production
// traffic to silently cascade into paid models. Claude is still callable via
// `modelOverride` from the debug page or by explicit caller request; it just
// won't be selected by automatic fallback.

// Provider rotation: alternate between Llama/Mistral/Gemini so a single
// provider outage falls through to a different provider in one hop, not 3.
// Quota-first within each provider tier.
export const TEXT_FALLBACK_CHAIN: string[] = [
  "Llama-4-Maverick-17B-128E-Instruct-FP8", // Meta
  "mistral-large-latest", // Mistral
  "Llama-3.3-70B-Instruct", // Meta
  "gemini-2.5-flash-lite", // Google
  "Llama-3.3-8B-Instruct", // Meta
  "mistral-medium-2505", // Mistral
  "mistral-small-2506", // Mistral
];

export const VISION_FALLBACK_CHAIN: string[] = [
  "Llama-4-Scout-17B-16E-Instruct-FP8", // Meta
  "gemini-2.5-flash-lite", // Google
  "Llama-4-Maverick-17B-128E-Instruct-FP8", // Meta
];

// Vision-capable model IDs (includes Claude for modelOverride even though
// Claude is excluded from VISION_FALLBACK_CHAIN's automatic ordering).
export const VISION_CAPABLE_MODELS = new Set<string>([
  ...VISION_FALLBACK_CHAIN,
  "claude-sonnet-4-20250514",
]);

// Disabled models (show in UI but not selectable)
export const DISABLED_AI_MODELS: AIModel[] = [
  // Claude models (legacy — superseded by active claude-sonnet-4)
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    provider: "claude",
    available: false,
    deprecated: true,
    description: "Anthropic Claude 3.5 Sonnet (superseded by Claude Sonnet 4)",
  },

  // Mistral models (disabled due to issues)
  {
    id: "mistral-small-2407",
    name: "Mistral Small 2",
    provider: "mistral",
    available: false,
    description: "Mistral Small 2 model (disabled - API issues)",
  },
];

// All models combined
export const ALL_AI_MODELS: AIModel[] = [...ACTIVE_AI_MODELS, ...DISABLED_AI_MODELS];

// Get model by ID
export function getModelById(id: string): AIModel | undefined {
  return ALL_AI_MODELS.find((model) => model.id === id);
}

// Get models by provider
export function getModelsByProvider(provider: string): AIModel[] {
  return ALL_AI_MODELS.filter((model) => model.provider === provider);
}

// Get only active models
export function getActiveModels(): AIModel[] {
  return ACTIVE_AI_MODELS;
}

// Get only disabled models
export function getDisabledModels(): AIModel[] {
  return DISABLED_AI_MODELS;
}

// Check if model is available
export function isModelAvailable(modelId: string): boolean {
  const model = getModelById(modelId);
  return model?.available ?? false;
}

// Default model selection
export const DEFAULT_MODEL = "gemini-2.5-flash-lite";

// API key configuration - All keys must be provided via environment variables
export const API_KEYS = {
  llama: process.env.NEXT_PUBLIC_LLAMA_API_KEY || process.env.LLAMA_API_KEY || "",
  google:
    process.env.NEXT_PUBLIC_GOOGLE_AI_STUDIO_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    "",
  claude: process.env.NEXT_PUBLIC_CLAUDE_API_KEY || "",
  mistral: process.env.NEXT_PUBLIC_MISTRAL_API_KEY || "",
};

// Get API key for provider
export function getApiKey(provider: string): string {
  const key = API_KEYS[provider as keyof typeof API_KEYS];
  if (!key) {
    console.warn(
      `⚠️ No API key found for provider: ${provider}. Please set NEXT_PUBLIC_${provider.toUpperCase()}_API_KEY in your environment variables.`
    );
  }
  return key || "";
}

// Check if API key is available for provider
export function hasApiKey(provider: string): boolean {
  const key = API_KEYS[provider as keyof typeof API_KEYS];
  return !!(key && key.trim() !== "");
}

// Get all available providers (those with API keys)
export function getAvailableProviders(): string[] {
  return Object.entries(API_KEYS)
    .filter(([, key]) => key && key.trim() !== "")
    .map(([provider]) => provider);
}
