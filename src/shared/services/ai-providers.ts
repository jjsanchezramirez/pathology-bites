// Single provider dispatcher for every text AI call in the app.
//
// Replaces four near-identical `callAIService` / `callGoogleAPI` / `callMistralAPI`
// copies (WSI questions, admin questions, admin audio, debug) that had drifted
// apart: Google silently dropped the system prompt in all of them, WSI's Mistral
// dropped it too, and neither Google nor Mistral had any request timeout.
//
// Groq and Cerebras speak the OpenAI shape (openai-compat.ts); Claude has its own
// client (claude-api.ts); Google and Mistral are called directly here.

import { callClaudeText } from "@/shared/services/claude-api";
import { callOpenAICompatText } from "@/shared/services/openai-compat";

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface AICallOptions {
  /** System / role instruction. Applied on every provider, Google included. */
  system?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** Ask the provider to emit strict JSON. */
  jsonMode?: boolean;
  /** Caller-owned abort signal; takes precedence over timeoutMs. */
  signal?: AbortSignal;
}

export interface AICallResult {
  content: string;
  tokenUsage?: TokenUsage;
}

const DEFAULTS = {
  maxTokens: 2048,
  temperature: 0.7,
  timeoutMs: 20_000,
};

/**
 * Bound a raw fetch by a timeout, unless the caller supplied its own signal.
 * Google and Mistral previously ran unbounded, which is what let a hung provider
 * eat the whole serverless budget instead of failing over.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  signal: AbortSignal | undefined,
  providerLabel: string
): Promise<Response> {
  if (signal) return fetch(url, { ...init, signal });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`${providerLabel} API timeout after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function callGoogle(
  prompt: string,
  model: string,
  apiKey: string,
  options: AICallOptions
): Promise<AICallResult> {
  const { system, maxTokens, temperature, timeoutMs, jsonMode, signal } = {
    ...DEFAULTS,
    ...options,
  };

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // Every caller passes a system prompt and expects it honoured; the old
        // copies built this body without one, so Gemini alone ran unprompted.
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
    timeoutMs,
    signal,
    "Google"
  );

  if (!response.ok) {
    throw new Error(`Google API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
    tokenUsage: data.usageMetadata
      ? {
          prompt_tokens: data.usageMetadata.promptTokenCount || 0,
          completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
          total_tokens: data.usageMetadata.totalTokenCount || 0,
        }
      : undefined,
  };
}

async function callMistral(
  prompt: string,
  model: string,
  apiKey: string,
  options: AICallOptions
): Promise<AICallResult> {
  const { system, maxTokens, temperature, timeoutMs, jsonMode, signal } = {
    ...DEFAULTS,
    ...options,
  };

  const response = await fetchWithTimeout(
    "https://api.mistral.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: prompt },
        ],
        max_tokens: maxTokens,
        temperature,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    },
    timeoutMs,
    signal,
    "Mistral"
  );

  if (!response.ok) {
    throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    tokenUsage: data.usage
      ? {
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens,
        }
      : undefined,
  };
}

/**
 * Call one model on one provider. No retries, no fallback — that is
 * `callWithFallback`'s job; this is the leaf it drives.
 */
export async function callModel(
  provider: string,
  modelId: string,
  apiKey: string,
  prompt: string,
  options: AICallOptions = {}
): Promise<AICallResult> {
  const merged = { ...DEFAULTS, ...options };

  switch (provider) {
    case "groq":
    case "cerebras":
      return callOpenAICompatText(provider, modelId, apiKey, prompt, merged);
    case "google":
    case "gemini":
      return callGoogle(prompt, modelId, apiKey, merged);
    case "mistral":
      return callMistral(prompt, modelId, apiKey, merged);
    case "claude": {
      const res = await callClaudeText(prompt, modelId, apiKey, {
        system: merged.system,
        maxTokens: merged.maxTokens,
        temperature: merged.temperature,
        timeoutMs: merged.timeoutMs,
      });
      return { content: res.content, tokenUsage: res.tokenUsage };
    }
    default:
      throw new Error(`Unsupported model provider: ${provider}`);
  }
}
