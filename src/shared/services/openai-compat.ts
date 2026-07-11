// Shared caller for OpenAI-compatible chat-completions providers
// (Groq, Cerebras, Mistral). Added when Meta shut down the Llama API
// (July 6, 2026) — its replacements all speak the OpenAI dialect, so one
// caller covers them. Provider-specific quirks live here, not in routes:
//   - Groq/Cerebras take `max_completion_tokens`; Mistral only `max_tokens`.
//   - Cerebras serves reasoning models (gpt-oss, GLM) that spend completion
//     budget on reasoning before emitting content — we floor the budget and
//     pin gpt-oss to low reasoning effort so short-output calls still finish.

import { log } from "@/shared/utils/logging";

const ENDPOINTS: Record<string, string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  cerebras: "https://api.cerebras.ai/v1/chat/completions",
  mistral: "https://api.mistral.ai/v1/chat/completions",
};

// Reasoning models need headroom for thinking tokens before content appears.
const CEREBRAS_MIN_COMPLETION_TOKENS = 1024;

export function isOpenAICompatProvider(provider: string): boolean {
  return provider in ENDPOINTS;
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
  const endpoint = ENDPOINTS[provider];
  if (!endpoint) throw new Error(`Not an OpenAI-compatible provider: ${provider}`);

  const { maxTokens = 4000, temperature = 0.7, timeoutMs = 20_000, signal, jsonMode } = options;

  const effectiveMaxTokens =
    provider === "cerebras" ? Math.max(maxTokens, CEREBRAS_MIN_COMPLETION_TOKENS) : maxTokens;

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
  if (provider === "cerebras" && model.startsWith("gpt-oss")) {
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
