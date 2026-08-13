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
    id: "llama-3.1-8b-instant",
    name: "Llama 3.1 8B (Groq)",
    provider: "groq",
    available: true,
    description: "Fast lightweight Llama on Groq",
    contextLength: "128K tokens",
    tpmLimit: 6000,
  },

  // Groq's serving of the same model that leads the chain on Cerebras. Free tier
  // gives it 200K TPD — double the 100K the llama models get — so it is the
  // natural landing spot when Cerebras' 5 RPM runs out.
  {
    id: "openai/gpt-oss-120b",
    name: "GPT-OSS 120B (Groq)",
    provider: "groq",
    available: true,
    description: "Same model as the Cerebras chain leader, second provider",
    contextLength: "128K tokens",
    tpmLimit: 8000,
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
    id: "gemma-4-31b",
    name: "Gemma 4 31B (Cerebras)",
    provider: "cerebras",
    available: true,
    description: "Gemma 4 31B on Cerebras - bench candidate",
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
  // Gemini "flash" (non-lite) models think by default and the thinking tokens
  // count against maxOutputTokens — at maxTokens 2000 the JSON comes back
  // truncated (finishReason MAX_TOKENS). thinkingBudget:0 fixes 2.5-flash but is
  // rejected outright by the 3.x lite models, so prefer the lite line, which
  // does no thinking by default and answers in ~1.2s.
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash Lite",
    provider: "gemini",
    available: true,
    description: "Newest Gemini lite - no thinking by default, ~1.2s",
    contextLength: "1M tokens",
    tpmLimit: 1000000,
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    provider: "gemini",
    available: true,
    description: "Prior-generation Gemini lite - no thinking by default",
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
  // Current-generation Mistral. The 25xx small/medium entries below are the
  // older releases the chain was measured against; kept for comparison.
  {
    id: "mistral-small-2603",
    name: "Mistral Small (2603)",
    provider: "mistral",
    available: true,
    description: "Current Mistral Small release - bench candidate",
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

// Ordered by measured wall-clock on a real WSI question prompt (~813 prompt
// tokens, maxTokens 2000, /debug/wsi-bench, Aug 2026), then by provider
// diversity so a single provider outage still falls through in one hop.
//
//   gpt-oss-120b            0.9s  1126 tok/s   Cerebras
//   gemini-3.5-flash-lite   3.1s   282 tok/s   Google
//   openai/gpt-oss-120b     3.6s   439 tok/s   Groq
//   llama-3.3-70b-versatile 3.4s   310 tok/s   Groq
//   mistral-small-2603      8.0s   129 tok/s   Mistral
//
// The first three are three DIFFERENT providers on purpose. That matters more
// than shaving 400ms off slot 2: only ~3 models are ever reachable anyway —
// with timeoutMs 12s and deadlineMs 35s, three consecutive timeouts spend 36s
// and the deadline check stops the walk before a fourth attempt starts.
//
// Cerebras leads on speed but has the TIGHTEST limit of the three (5 RPM vs
// Groq's 30). Slot 2 is therefore load-bearing, not decorative: under any real
// concurrency it serves a large share of traffic. Groq's own gpt-oss-120b sits
// at 3 so a Cerebras outage keeps the same model family, and it carries a
// 200K TPD free-tier allowance against the llama models' 100K.
//
// Not in the chain, and why:
//   llama-3.1-8b-instant   fine (2.8s) but same provider as slot 4, so a Groq
//                          provider-level failure skips it anyway; and slot 5+
//                          is unreachable on timeout paths. Still selectable.
//   mistral-large/medium   17.4s / 17.6s — past the 12s WSI timeout every time.
//                          Selectable for admin tasks (20s timeout) only.
//   gemini-2.5-flash-lite  4.3s, superseded by 3.5-flash-lite (3.1s) which is
//                          also free tier. Kept selectable as the Gemini
//                          fallback in VISION_FALLBACK_CHAIN.
// See DISABLED_AI_MODELS for the four that were measured genuinely unusable.
export const TEXT_FALLBACK_CHAIN: string[] = [
  "gpt-oss-120b", // Cerebras — 0.9s
  "gemini-3.5-flash-lite", // Google — 3.1s
  "openai/gpt-oss-120b", // Groq — 3.6s
  "llama-3.3-70b-versatile", // Groq — 3.4s
  "mistral-small-2603", // Mistral — 8.0s, 4th-provider backstop
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

// Groq's Llama 4 Scout led this chain until Groq removed it from their catalog;
// the API returns `model_not_found`, so every vision call had been failing over
// to Gemini regardless. Groq now serves no vision model on our account, which
// leaves both slots on Google — there is NO provider diversity here. A Google
// outage takes vision down; the deliberate escape hatch is passing Claude via
// modelOverride, which is why it stays in VISION_CAPABLE_MODELS.
//
// Measured on a real R2 histology image (Aug 2026): 3.5-flash-lite 1.9s,
// 2.5-flash-lite 2.8s. Both saw the image and returned parseable JSON with no
// thinking tokens. Only the "lite" line behaves this way — see callGoogle.
export const VISION_FALLBACK_CHAIN: string[] = [
  "gemini-3.5-flash-lite", // Google — 1.9s
  "gemini-2.5-flash-lite", // Google — 2.8s
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
    // The prompt caps explanations at 2 sentences; observed completions dropped
    // to ~700-800, so 1600 keeps ~2x headroom. Groq bills its daily cap against
    // the RESERVED figure, so this is a 20% cut in daily-cap burn as well as a
    // latency win. Raise it back if anything starts truncating.
    maxTokens: 1600,
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

  // Retired by the provider — Groq removed Llama 4 Scout from the catalog and
  // the API now answers `model_not_found`. It was VISION_FALLBACK_CHAIN[0], so
  // every vision call had been silently failing over to Gemini.
  {
    id: "meta-llama/llama-4-scout-17b-16e-instruct",
    name: "Llama 4 Scout 17B (Groq)",
    provider: "groq",
    available: false,
    deprecated: true,
    description: "Removed from Groq's catalog (404 as of Aug 2026)",
  },

  // Measured unusable on the real WSI prompt (/debug/wsi-bench, Aug 2026): each
  // spent its entire 2000-token budget reasoning or rambling and never closed
  // the JSON. Not slow — unusable. Kept visible so nobody re-adds them blind.
  {
    id: "zai-glm-4.7",
    name: "GLM 4.7 (Cerebras)",
    provider: "cerebras",
    available: false,
    description: "Burns the whole token budget on reasoning - output never parses",
  },
  {
    id: "openai/gpt-oss-20b",
    name: "GPT-OSS 20B (Groq)",
    provider: "groq",
    available: false,
    description: "Hit the 2000-token cap without closing the JSON",
  },
  {
    id: "qwen/qwen3.6-27b",
    name: "Qwen3.6 27B (Groq)",
    provider: "groq",
    available: false,
    description: "Hit the 2000-token cap without closing the JSON",
  },
  {
    id: "ministral-14b-2512",
    name: "Ministral 14B",
    provider: "mistral",
    available: false,
    description: "15.7s and hit the 2000-token cap without closing the JSON",
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
