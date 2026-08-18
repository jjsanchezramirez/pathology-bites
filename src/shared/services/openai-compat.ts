// Shared caller for OpenAI-compatible chat-completions providers
// (Groq, Cerebras, Mistral, Cloudflare Workers AI). Added when Meta shut down
// the Llama API (July 6, 2026) — its replacements all speak the OpenAI dialect,
// so one caller covers them. Provider-specific quirks live here, not in routes:
//   - Groq/Cerebras/Cloudflare take `max_completion_tokens`; Mistral only `max_tokens`.
//   - Reasoning models (gpt-oss on any provider) spend completion budget on
//     thinking before emitting content — we floor the budget and pin them to low
//     reasoning effort so short-output calls still finish.
//   - Cloudflare scopes its endpoint to an account, so its URL is built rather
//     than looked up.

import { log } from "@/shared/utils/logging";

const ENDPOINTS: Record<string, string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  cerebras: "https://api.cerebras.ai/v1/chat/completions",
  mistral: "https://api.mistral.ai/v1/chat/completions",
};

/**
 * Cloudflare's OpenAI-compatible endpoint is per-account, so it cannot be a
 * constant like the others. The account id is not a secret (it appears in every
 * dashboard URL and in wrangler.toml), but it is deployment-specific.
 */
function cloudflareEndpoint(): string {
  const account =
    process.env.CLOUDFLARE_ACCOUNT_ID || process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID;
  if (!account) {
    throw new Error(
      "Cloudflare Workers AI needs CLOUDFLARE_ACCOUNT_ID — its API endpoint is scoped to an account."
    );
  }
  return `https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1/chat/completions`;
}

function endpointFor(provider: string): string | null {
  if (provider === "cloudflare") return cloudflareEndpoint();
  return ENDPOINTS[provider] ?? null;
}

// Reasoning models need headroom for thinking tokens before content appears.
const CEREBRAS_MIN_COMPLETION_TOKENS = 1024;

/**
 * gpt-oss reasons before it answers, on every provider that serves it. Measured
 * on Groq (Aug 2026): a 10-token budget goes 8 tokens to reasoning and returns
 * an empty string with finish_reason "length" — which is what made the health
 * ping report the model as broken when it was fine at a real budget.
 *
 * Matches every id shape in use: Cerebras serves it as `gpt-oss-120b`, Groq as
 * `openai/gpt-oss-120b`, Cloudflare as `@cf/openai/gpt-oss-20b`. The
 * Cerebras-only `startsWith` this replaces silently skipped the others.
 */
function isReasoningModel(model: string): boolean {
  return /(^|\/)gpt-oss/.test(model);
}

export function isOpenAICompatProvider(provider: string): boolean {
  return provider === "cloudflare" || provider in ENDPOINTS;
}

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ChatContentPart[];
}

export interface OpenAICompatOptions {
  /** Prepended as a system message (text-prompt helper only). */
  system?: string;
  maxTokens?: number;
  temperature?: number;
  /** Ignored when `signal` is provided. */
  timeoutMs?: number;
  /** Caller-owned abort signal — takes precedence over timeoutMs. */
  signal?: AbortSignal;
  /** Force `response_format: json_object` (supported by all three providers). */
  jsonMode?: boolean;
}

export interface OpenAICompatResult {
  content: string;
  tokenUsage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function callOpenAICompatChat(
  provider: string,
  model: string,
  apiKey: string,
  messages: ChatMessage[],
  options: OpenAICompatOptions = {}
): Promise<OpenAICompatResult> {
  const endpoint = endpointFor(provider);
  if (!endpoint) throw new Error(`Not an OpenAI-compatible provider: ${provider}`);

  const { maxTokens = 4000, temperature = 0.7, timeoutMs = 20_000, signal, jsonMode } = options;

  // Cerebras keeps its blanket floor (its whole catalog is reasoning-heavy);
  // gpt-oss gets one on any provider.
  const needsThinkingHeadroom = provider === "cerebras" || isReasoningModel(model);
  const effectiveMaxTokens = needsThinkingHeadroom
    ? Math.max(maxTokens, CEREBRAS_MIN_COMPLETION_TOKENS)
    : maxTokens;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  };
  if (provider === "mistral") {
    body.max_tokens = effectiveMaxTokens;
  } else {
    body.max_completion_tokens = effectiveMaxTokens;
  }
  // Measured on Groq (Aug 2026), same prompt: default effort spent 228 tokens
  // reasoning in 2.4s; "low" spent 37 in 1.7s and returned MORE content. Free
  // latency, and it moves the model further from the maxTokens ceiling.
  // Mistral does not accept the parameter.
  if (
    isReasoningModel(model) &&
    (provider === "groq" || provider === "cerebras" || provider === "cloudflare")
  ) {
    body.reasoning_effort = "low";
  }

  const controller = signal ? undefined : new AbortController();
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: signal ?? controller!.signal,
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError" && !signal) {
      throw new Error(`${provider} API timeout after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw error;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const raw = await response.text();
    let detail = raw.slice(0, 200);
    try {
      const parsed = JSON.parse(raw);
      detail = parsed.error?.message || parsed.message || parsed.detail || detail;
    } catch {
      // keep raw slice
    }
    throw new Error(`${provider} API error: ${response.status} ${response.statusText} — ${detail}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const content: string = choice?.message?.content ?? "";

  if (!content) {
    // Reasoning models can burn the whole budget before emitting content;
    // throwing lets callWithFallback advance instead of parsing "".
    const reason = choice?.finish_reason ?? "no choices";
    log.warn(`[openai-compat] ${provider}/${model} returned empty content (${reason})`);
    throw new Error(`${provider} returned empty content (finish_reason: ${reason})`);
  }

  return {
    content,
    tokenUsage: data.usage
      ? {
          prompt_tokens: data.usage.prompt_tokens || 0,
          completion_tokens: data.usage.completion_tokens || 0,
          total_tokens: data.usage.total_tokens || 0,
        }
      : undefined,
  };
}

/** Text-prompt convenience wrapper: optional system message + one user message. */
export async function callOpenAICompatText(
  provider: string,
  model: string,
  apiKey: string,
  prompt: string,
  options: OpenAICompatOptions = {}
): Promise<OpenAICompatResult> {
  const messages: ChatMessage[] = [
    ...(options.system ? [{ role: "system", content: options.system } as ChatMessage] : []),
    { role: "user", content: prompt },
  ];
  return callOpenAICompatChat(provider, model, apiKey, messages, options);
}
