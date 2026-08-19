// Centralized AI model configuration
// This file defines all available AI models and their status across the application

export interface AIModel {
  id: string;
  name: string;
  provider: "groq" | "cerebras" | "gemini" | "mistral" | "claude" | "cloudflare";
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
//
// This map is the ONLY llama remnant, and it is load-bearing: a stored id in
// the database still has to resolve to something callable. The four matching
// entries in DISABLED_AI_MODELS were deleted in Aug 2026 — they were tombstones
// nothing could reach, because getModelProvider() resolves an id through this
// map BEFORE looking it up in the catalog, so the tombstones were unmatchable
// by construction. Deleting a key here is a different matter entirely: it would
// let a stale id through unresolved.
export const LEGACY_MODEL_REMAP: Record<string, string> = {
  "Llama-3.3-70B-Instruct": "openai/gpt-oss-120b",
  // Was llama-3.1-8b-instant until Groq decommissioned it on 2026-08-16.
  // openai/gpt-oss-20b is Groq's own recommended replacement and the closest
  // thing left in that small-and-fast slot.
  "Llama-3.3-8B-Instruct": "openai/gpt-oss-20b",
  "Llama-4-Maverick-17B-128E-Instruct-FP8": "openai/gpt-oss-120b",
  // Scout was the vision model, and it was remapped onto Groq's serving of it —
  // which Groq has since retired too (it is absent from their live model list,
  // the same reason the vision chain had to be rebuilt). Point it at the current
  // vision chain leader so a stale Scout id still resolves to something that can
  // actually see an image.
  "Llama-4-Scout-17B-16E-Instruct-FP8": "gemini-3.5-flash-lite",
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
  if (model.startsWith("@cf/")) return "cloudflare";
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
  // Groq — free tier: 30 RPM, per-model daily token caps.
  //
  // llama-3.3-70b-versatile lived here until Groq decommissioned it; the API now
  // answers 404 "does not exist or you do not have access to it". It has no
  // replacement: Groq's /models list still serves only the gpt-oss family and
  // qwen3.6-27b, and both of the small ones are in DISABLED_AI_MODELS for
  // running past the token cap without closing their JSON.
  // Replaced llama-3.1-8b-instant, decommissioned by Groq 2026-08-16. This is
  // Groq's nominated successor and keeps a small/fast option selectable.
  {
    id: "openai/gpt-oss-20b",
    name: "GPT-OSS 20B (Groq)",
    provider: "groq",
    available: true,
    description: "Small fast model on Groq — replaces Llama 3.1 8B",
    contextLength: "128K tokens",
    tpmLimit: 8000,
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

  // Cloudflare Workers AI — 10K neurons/day free (~39% of current volume), then
  // $0.011/1K neurons. The 20B rather than the 120B: at $0.20/$0.30 per MTok it
  // is the cheapest thing in the chain by a wide margin, and a backstop's job is
  // to answer at all, not to answer fastest.
  {
    id: "@cf/openai/gpt-oss-20b",
    name: "GPT-OSS 20B (Cloudflare)",
    provider: "cloudflare",
    available: true,
    description: "OpenAI open-weight 20B on Workers AI — cheapest chain backstop",
    contextLength: "128K tokens",
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

  // Anthropic Claude — the paid escape hatch. Never selected by automatic
  // fallback (see VISION_FALLBACK_CHAIN); reachable only via modelOverride.
  //
  // claude-sonnet-4-20250514 sat here until 2026-08-13 and had been RETIRED by
  // Anthropic since 2026-06-15 — the API answered `not_found_error`, so the one
  // non-Google vision option in the catalog did not exist. Verified on a real
  // histology image: opus-5 4.2s, and the only one of the three current models
  // to read the atrophic/regressed germinal centre correctly (sonnet-5 called
  // the organ spleen; haiku-4-5 was vaguer but 10x cheaper at ~$0.002/image).
  {
    id: "claude-opus-5",
    name: "Claude Opus 5",
    provider: "claude",
    available: true,
    description: "Paid escape hatch - best vision read, high-res tier (~$0.02/image)",
    contextLength: "1M tokens",
    tpmLimit: 200000,
  },
];

// ---------------------------------------------------------------------------
// Unified fallback chains
// ---------------------------------------------------------------------------
// Ordering: Groq → Cerebras → Cloudflare → Mistral → Gemini.
// (Meta's Llama API shut down July 6, 2026; Groq serves the same Llama
// models, Cerebras adds a 1M-token/day pool.)
//
// No longer free-tier only, and the ordering is no longer speed-first alone.
// A cost pass (Aug 2026) priced one month of real traffic — 9.3M input /
// 7.2M output — on every service serving these models:
//
//   Cloudflare gpt-oss-20b   $0.66   (after 10K free neurons/day)
//   Groq                     $5.69
//   Mistral small            $5.69
//   Cerebras                 $8.62
//   Gemini 3.5 Flash-Lite   $20.68
//
// Gemini is the most expensive option available to us, by 2.4x, because its
// output rate is $2.50/MTok against everyone else's $0.30-0.75 — and this
// workload is output-heavy. It sat at slot 2, absorbing everything the leader
// dropped. That was invisible only because ~324 req/day fits inside Google's
// free 1,000/day; the first busy month would have started billing at the worst
// rate in the table with no code change. Hence last.
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
// Every slot is a DIFFERENT provider on purpose. That matters more than raw
// speed ordering: only ~3 models are ever reachable on a timeout path — with
// timeoutMs 12s and deadlineMs 35s, three consecutive timeouts spend 36s and
// the deadline check stops the walk before a fourth attempt starts.
//
// Which is the case FOR this order rather than against it. Timeouts are the
// slow failure; the common one is fast — 429 over a daily cap, 402 on an empty
// prepaid balance — and those reject in milliseconds, so slots 4 and 5 are
// genuinely reachable exactly when the cheap providers have run out. That is
// the day observed on 2026-08-17: Cerebras 402, Groq over its 200K TPD, Gemini
// 429, all within one request.
//
// Cerebras is no longer the leader despite being 4x faster (0.9s vs 3.6s). It
// is the most expensive per token of the two, it has the tightest rate limit
// (5 RPM vs Groq's 30), and its balance is prepaid — so it empties without
// warning and takes the whole chain's leader slot down with it. Groq leads
// because it is cheaper, has 6x the RPM, and degrades by 429 rather than by
// going dark. Cerebras at 2 still serves the speed win under normal load.
//
// Not in the chain, and why:
//   openai/gpt-oss-20b     Groq's serving of it duplicates slot 1's provider, so
//                          a Groq provider-level failure skips it anyway.
//                          Cloudflare's serving of the same model is in the
//                          chain instead, which adds a provider rather than
//                          repeating one. Still selectable.
//   mistral-large/medium   17.4s / 17.6s — past the 12s WSI timeout every time.
//                          Selectable for admin tasks (20s timeout) only.
//   gemini-2.5-flash-lite  4.3s, superseded by 3.5-flash-lite (3.1s) which is
//                          also free tier. Kept selectable as the Gemini
//                          fallback in VISION_FALLBACK_CHAIN.
// See DISABLED_AI_MODELS for the four that were measured genuinely unusable.
export const TEXT_FALLBACK_CHAIN: string[] = [
  "openai/gpt-oss-120b", // Groq — 3.6s, $5.69/mo, 30 RPM
  // Cerebras' gpt-oss-120b sat here — 0.9s, the fastest model available to us by
  // 4x. Removed 2026-08-18: its balance is prepaid, it is empty, and there is no
  // plan to top it up. A model that answers 402 on every call is worse than an
  // absent one, because the chain is walked in order and it delays the providers
  // that still work. See the Cerebras note in DISABLED_AI_MODELS to restore it.
  "@cf/openai/gpt-oss-20b", // Cloudflare — $0.66/mo, 10K free neurons/day
  // A slot here held llama-3.3-70b-versatile until Groq decommissioned it. It
  // stayed in the chain long enough to 404 on every single failure, wasting an
  // attempt that could not possibly answer — and, because the chain is walked in
  // order, delaying the one backstop that still works. Live models only.
  "mistral-small-2603", // Mistral — 8.0s, ~1B tokens/mo free but 2 RPM
  "gemini-3.5-flash-lite", // Google — 3.1s but $20.68/mo; last on cost, not speed
];

/**
 * The model to use when a caller has no preference of its own.
 *
 * Admin components used to hardcode `llama-3.3-70b-versatile` for this, which
 * Groq decommissioned on 2026-08-16 — and unlike the Meta-era ids it is NOT in
 * LEGACY_MODEL_REMAP, so nothing would have rescued it: the refinement step in
 * question creation would have posted a dead model id and taken a 404. Pointing
 * at the chain leader means this cannot rot silently, because the chain tests
 * assert every entry is present and available in the catalog.
 */
export const DEFAULT_AI_MODEL = TEXT_FALLBACK_CHAIN[0];

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
// to Gemini regardless. Groq serves no vision model on our account at all now.
//
// Cerebras' gemma-4-31b sits at slot 2 to keep a SECOND PROVIDER in the chain —
// with Google in slots 1 and 3, a Google outage would otherwise take vision down
// completely. It refuses remote image URLs and needs the bytes inlined as a data
// URI; callVisionModel handles that.
//
// Measured on a real R2 histology image (Aug 2026): 3.5-flash-lite 1.9s,
// gemma-4-31b 1.2s, 2.5-flash-lite 2.8s. All three saw the image and returned
// parseable JSON with no thinking tokens. Among Gemini only the "lite" line
// behaves this way — see callGoogle.
//
// Claude stays in VISION_CAPABLE_MODELS but out of the chain: it is paid, and
// automatic fallback must never cascade into a paid model.
export const VISION_FALLBACK_CHAIN: string[] = [
  "gemini-3.5-flash-lite", // Google — 1.9s
  // gemma-4-31b (Cerebras, 1.2s) was the non-Google leg and went with the
  // billing. THIS CHAIN IS NOW SINGLE-PROVIDER: a Google outage or a 429 on the
  // free tier empties it, where the text chain would still have three providers
  // to fall through. That is a known gap, not an oversight — filling it needs a
  // vision model benchmarked on a real image (/debug/vision-bench), and the
  // candidates are Cloudflare Workers AI and Mistral's pixtral line.
  "gemini-2.5-flash-lite", // Google — 2.8s
];

// Vision-capable model IDs (includes Claude for modelOverride even though
// Claude is excluded from VISION_FALLBACK_CHAIN's automatic ordering).
export const VISION_CAPABLE_MODELS = new Set<string>([...VISION_FALLBACK_CHAIN, "claude-opus-5"]);

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
  // Claude models retired by Anthropic — the API answers `not_found_error`.
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    provider: "claude",
    available: false,
    deprecated: true,
    description: "Retired by Anthropic (404)",
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

  // Cerebras — parked 2026-08-18, not broken.
  //
  // These are the fastest models we ever measured (gpt-oss-120b at 0.9s, 4x the
  // next best) and nothing is wrong with them. The account is prepaid, the
  // balance is empty, and topping it up is not planned. Left visible rather than
  // deleted so the numbers survive: at ~$8.62/month for our volume it is the
  // dearest text option after Gemini, which is why parking it costs little.
  //
  // To restore: top up at console.cerebras.ai, flip these to available: true,
  // put "gpt-oss-120b" back at slot 2 of TEXT_FALLBACK_CHAIN and "gemma-4-31b"
  // at slot 2 of VISION_FALLBACK_CHAIN — the latter also un-does vision being
  // single-provider. The chain tests will need their expectations moved back.
  // Cerebras — fastest inference (~2000+ tok/s), free tier: 5 RPM, 1M tokens/day
  {
    id: "gpt-oss-120b",
    name: "GPT-OSS 120B (Cerebras)",
    provider: "cerebras",
    available: false,
    description: "OpenAI open-weight 120B reasoning model on Cerebras",
    contextLength: "128K tokens",
    tpmLimit: 30000,
  },

  // Measured unusable on the real WSI prompt (/debug/wsi-bench, Aug 2026): each
  // spent its entire 2000-token budget reasoning or rambling and never closed
  // the JSON. Not slow — unusable. Kept visible so nobody re-adds them blind.
  // Re-measured on Cloudflare (Aug 2026, /debug/wsi-bench with the FULL
  // enforceQuestionContract, n=6 each) after the same families failed on
  // Cerebras and Groq. The point of the re-test was that disablement had looked
  // provider-specific: Groq's openai/gpt-oss-20b is disabled below for hitting
  // the token cap, while the identical weights on Cloudflare pass 6/6. That
  // does not generalise. Both of these reproduced their original defect on a
  // third, independent host, and both blow the 12s wsi-question timeout on
  // median latency alone — so they fail twice over, before quality is even
  // discussed. Control in the same run: @cf/openai/gpt-oss-20b, 6/6 at 3.9s.
  {
    id: "@cf/qwen/qwen3-30b-a3b-fp8",
    name: "Qwen3 30B A3B (Cloudflare)",
    provider: "cloudflare",
    available: false,
    description: "2/6 contract passes, 15.2s median (>12s timeout) - truncates JSON mid-object",
  },
  {
    id: "@cf/zai-org/glm-4.7-flash",
    name: "GLM 4.7 Flash (Cloudflare)",
    provider: "cloudflare",
    available: false,
    description: "0/6 contract passes, 20.7s median - empty content, finish_reason length",
  },
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

// API keys moved to ./ai-keys.ts, which is `server-only`. This module is
// imported by admin CLIENT components for ACTIVE_AI_MODELS, so keys living
// here were one client-side getApiKey() call away from a public bundle.
