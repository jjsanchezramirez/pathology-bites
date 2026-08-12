import { log } from "@/shared/utils/logging";

// Centralized AI model configuration
// This file defines all available AI models and their status across the application

export interface AIModel {
  id: string;
  name: string;
  provider: "groq" | "cerebras" | "gemini" | "mistral" | "claude" | "llama";
  available: boolean;
  deprecated?: boolean;
  description?: string;
  contextLength?: string;
  temperature?: number;
  maxTokens?: number;
  tpmLimit?: number; // Tokens Per Minute limit
}

// Legacy Meta Llama API model IDs → nearest live equivalent.
// The Meta Llama API shut down July 6, 2026; stale IDs persisted in question
// sets / user prefs are remapped here instead of erroring.
export const LEGACY_MODEL_REMAP: Record<string, string> = {
  "Llama-3.3-70B-Instruct": "llama-3.3-70b-versatile",
  "Llama-3.3-8B-Instruct": "llama-3.1-8b-instant",
  "Llama-4-Maverick-17B-128E-Instruct-FP8": "llama-3.3-70b-versatile",
  "Llama-4-Scout-17B-16E-Instruct-FP8": "meta-llama/llama-4-scout-17b-16e-instruct",
};

/** Resolve legacy model IDs to their live replacement (identity for current IDs). */
export function resolveModelId(model: string): string {
  return LEGACY_MODEL_REMAP[model] ?? model;
}

// Helper function to determine provider from model ID.
// Exact catalog lookup first (Groq's llama-* IDs would otherwise collide with
// prefix rules), then prefix heuristics for models not in the catalog.
export function getModelProvider(model: string): string {
  const resolved = resolveModelId(model);
  const known = ALL_AI_MODELS.find((m) => m.id === resolved);
  if (known) return known.provider === "gemini" ? "google" : known.provider;
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
  // Groq — fast Llama inference, free tier: 30 RPM, per-model daily token caps
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B (Groq)",
    provider: "groq",
    available: true,
    description: "Large Llama model on Groq - fast, proven performance",
    contextLength: "128K tokens",
    tpmLimit: 12000,
  },
  {
    id: "meta-llama/llama-4-scout-17b-16e-instruct",
    name: "Llama 4 Scout 17B (Groq)",
    provider: "groq",
    available: true,
    description: "Multimodal vision model on Groq",
    contextLength: "128K tokens",
    tpmLimit: 30000,
  },
  {
    id: "llama-3.1-8b-instant",
    name: "Llama 3.1 8B (Groq)",
    provider: "groq",
    available: true,
    description: "Fast lightweight Llama on Groq",
    contextLength: "128K tokens",
    tpmLimit: 6000,
  },

  // Cerebras — fastest inference (~2000+ tok/s), free tier: 5 RPM, 1M tokens/day
  {
    id: "gpt-oss-120b",
    name: "GPT-OSS 120B (Cerebras)",
    provider: "cerebras",
    available: true,
    description: "OpenAI open-weight 120B reasoning model on Cerebras",
    contextLength: "128K tokens",
    tpmLimit: 30000,
  },
  {
    id: "zai-glm-4.7",
    name: "GLM 4.7 (Cerebras)",
    provider: "cerebras",
    available: true,
    description: "Z.ai GLM 4.7 355B on Cerebras - strong reasoning",
    contextLength: "128K tokens",
    tpmLimit: 30000,
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
// Free-tier only. Speed-first ordering: Groq → Cerebras → Mistral → Gemini.
// (Meta's Llama API shut down July 6, 2026; Groq serves the same Llama
// models, Cerebras adds a 1M-token/day pool.)
//
// Claude is INTENTIONALLY EXCLUDED — it's paid, and we never want production
// traffic to silently cascade into paid models. Claude is still callable via
// `modelOverride` from the debug page or by explicit caller request; it just
// won't be selected by automatic fallback.

// Ordered by measured wall-clock on a real WSI question prompt (~830 prompt
// tokens, maxTokens 2000, Aug 2026), then by provider diversity so a single
// provider outage still falls through in one hop.
//
//   gpt-oss-120b            1.0s   934 tok/s   Cerebras
//   llama-3.1-8b-instant    1.5s   748 tok/s   Groq
//   llama-3.3-70b-versatile 3.6s   269 tok/s   Groq
//   gemini-2.5-flash-lite   4.4s   200 tok/s   Google
//   mistral-large-latest   19.8s    58 tok/s   Mistral
//
// Cerebras leads on three counts: it was 3.4x faster than the previous leader,
// it is the largest model here, and its 1M tokens/day dwarfs Groq's 100K —
// which the WSI generator exhausts in ~36 questions, after which every request
// paid a wasted 429 before failing over.
//
// Groq's 70B sits above Gemini on quality; the 8B is fast but small, so it
// ranks below the 70B despite being quicker — this is a quality-ordered chain
// that happens to lead with the fastest model, not a pure speed sort.
//
// Removed, both measured unusable rather than merely slow:
//   zai-glm-4.7        a reasoning model: spends the entire 2000-token budget
//                      on reasoning and returns content that does not parse.
//   mistral-medium     17.8s, i.e. always past the 12s WSI timeout, and
//                      strictly worse than mistral-large which is kept.
//
// mistral-large is kept LAST only as a different-provider backstop. It also
// exceeds the WSI 12s budget, so in practice it can only serve tasks with a
// longer deadline (admin question generation, audio scripts).
export const TEXT_FALLBACK_CHAIN: string[] = [
  "gpt-oss-120b", // Cerebras — 1.0s
  "llama-3.3-70b-versatile", // Groq — 3.6s
  "gemini-2.5-flash-lite", // Google — 4.4s
  "llama-3.1-8b-instant", // Groq — 1.5s, smaller model
  "mistral-large-latest", // Mistral — 19.8s, backstop for long-deadline tasks only
];

/**
 * Per-task generation settings. One place to answer "what does this feature ask
 * the model for", instead of the numbers being hardcoded in each route.
 *
 * On `maxTokens`: Groq bills its **daily token cap against `max_tokens`
 * reserved**, not tokens generated. A WSI question measured ~1,750 total tokens
 * (~780 prompt + ~970 completion), but `maxTokens: 4000` charged 4,784 per call
 * — so the 100K TPD ran out after ~20 generations instead of ~57. Keep these
 * sized to real output plus headroom, not to a round number.
 *
 * On `deadlineMs`: the whole fallback walk happens inside one serverless
 * invocation, so this must stay comfortably under the route's `maxDuration`.
 */
export interface AITaskProfile {
  chain: string[];
  maxTokens: number;
  temperature: number;
  /** Per-model request timeout. */
  timeoutMs: number;
  /** Total budget for walking the chain. Must be < the route's maxDuration. */
  deadlineMs: number;
  /** Ask the provider for strict JSON. */
  jsonMode?: boolean;
}

export const VISION_FALLBACK_CHAIN: string[] = [
  "meta-llama/llama-4-scout-17b-16e-instruct", // Groq
  "gemini-2.5-flash-lite", // Google
];

// Vision-capable model IDs (includes Claude for modelOverride even though
// Claude is excluded from VISION_FALLBACK_CHAIN's automatic ordering).
export const VISION_CAPABLE_MODELS = new Set<string>([
  ...VISION_FALLBACK_CHAIN,
  "claude-sonnet-4-20250514",
]);

export const AI_TASKS = {
  /** User-facing WSI question generation. maxDuration 45s. */
  "wsi-question": {
    chain: TEXT_FALLBACK_CHAIN,
    maxTokens: 2000, // ~970 observed completion + headroom
    temperature: 0.7,
    timeoutMs: 12_000,
    deadlineMs: 35_000,
    jsonMode: false, // parser already handles fenced output; don't change today's behaviour
  },
  /** Admin question generation. maxDuration 60s. */
  "admin-question": {
    chain: TEXT_FALLBACK_CHAIN,
    maxTokens: 4000,
    temperature: 0.7,
    timeoutMs: 20_000,
    deadlineMs: 50_000,
    jsonMode: true, // its system prompt demands JSON
  },
  /** Admin audio script. maxDuration 30s. */
  "audio-script": {
    chain: TEXT_FALLBACK_CHAIN,
    maxTokens: 500,
    temperature: 0.7,
    timeoutMs: 10_000,
    deadlineMs: 25_000,
    jsonMode: false, // free-text script, not JSON
  },
  /**
   * Lesson-studio generate-lesson, pass 1 (transcript analysis) and pass 2
   * (planner). Both share one 60s route budget with per-image vision, so their
   * deadlines are deliberately short — a slow chain walk here starves vision.
   *
   * jsonMode stays off: these parsers already accept fenced output, and the
   * previous hand-rolled calls never requested strict JSON. Standardising the
   * call path should not quietly change what the models emit.
   */
  "lesson-transcript": {
    chain: TEXT_FALLBACK_CHAIN,
    maxTokens: 2048,
    temperature: 0.2,
    timeoutMs: 12_000,
    deadlineMs: 20_000,
    jsonMode: false,
  },
  "lesson-planner": {
    chain: TEXT_FALLBACK_CHAIN,
    maxTokens: 1024,
    temperature: 0.2,
    timeoutMs: 12_000,
    deadlineMs: 20_000,
    jsonMode: false,
  },
  /** Per-image vision analysis. vision-analyze route is maxDuration 30. */
  "lesson-vision": {
    chain: VISION_FALLBACK_CHAIN,
    maxTokens: 800,
    temperature: 0.1,
    timeoutMs: 15_000,
    deadlineMs: 25_000,
    jsonMode: false,
  },
} satisfies Record<string, AITaskProfile>;

export type AITaskName = keyof typeof AI_TASKS;

// Disabled models (show in UI but not selectable)
export const DISABLED_AI_MODELS: AIModel[] = [
  // Meta Llama API models (service shut down July 6, 2026 — see LEGACY_MODEL_REMAP)
  {
    id: "Llama-3.3-70B-Instruct",
    name: "Llama 3.3 70B (Meta API)",
    provider: "llama",
    available: false,
    deprecated: true,
    description: "Meta Llama API retired July 2026 — remapped to Groq",
  },
  {
    id: "Llama-4-Maverick-17B-128E-Instruct-FP8",
    name: "Llama 4 Maverick 17B (Meta API)",
    provider: "llama",
    available: false,
    deprecated: true,
    description: "Meta Llama API retired July 2026 — remapped to Groq",
  },
  {
    id: "Llama-4-Scout-17B-16E-Instruct-FP8",
    name: "Llama 4 Scout 17B (Meta API)",
    provider: "llama",
    available: false,
    deprecated: true,
    description: "Meta Llama API retired July 2026 — remapped to Groq",
  },
  {
    id: "Llama-3.3-8B-Instruct",
    name: "Llama 3.3 8B (Meta API)",
    provider: "llama",
    available: false,
    deprecated: true,
    description: "Meta Llama API retired July 2026 — remapped to Groq",
  },

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
  groq: process.env.NEXT_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY || "",
  cerebras: process.env.NEXT_PUBLIC_CEREBRAS_API_KEY || process.env.CEREBRAS_API_KEY || "",
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
    log.warn(
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
