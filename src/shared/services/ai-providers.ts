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

/**
 * Gemini "thinking" tokens are billed against `maxOutputTokens`, so a thinking
 * model handed a 2000-token budget can spend ~1900 of it reasoning and return
 * JSON truncated mid-string (finishReason MAX_TOKENS). Measured Aug 2026:
 * gemini-2.5-flash burned 513 thought tokens on a trivial prompt and 1900+ on a
 * real WSI question; gemini-3.6-flash never produced usable output at all.
 *
 * `thinkingBudget: 0` fixes the non-lite models — but the *lite* models reject
 * it outright with HTTP 400, and they already do no thinking by default. So we
 * only send it where it helps, and remember any model that rejects it.
 */
const THINKING_UNSUPPORTED = new Set<string>();

function shouldDisableThinking(model: string): boolean {
  if (THINKING_UNSUPPORTED.has(model)) return false;
  // Lite models and Gemma do no thinking by default and 400 on the parameter.
  return !/flash-lite/.test(model) && !/^gemma/.test(model);
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const buildBody = (disableThinking: boolean) =>
    JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      // Every caller passes a system prompt and expects it honoured; the old
      // copies built this body without one, so Gemini alone ran unprompted.
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    });

  const post = (disableThinking: boolean) =>
    fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: buildBody(disableThinking),
      },
      timeoutMs,
      signal,
      "Google"
    );

  const askedForNoThinking = shouldDisableThinking(model);
  let response = await post(askedForNoThinking);

  // A model that rejects thinkingBudget answers 400. Retry once without it and
  // remember, so this costs one wasted request per model per warm instance
  // rather than one per call — and so a future Google change self-heals.
  if (!response.ok && response.status === 400 && askedForNoThinking) {
    const detail = await response.text().catch(() => "");
    if (/thinking/i.test(detail) || /invalid argument/i.test(detail)) {
      THINKING_UNSUPPORTED.add(model);
      response = await post(false);
    } else {
      throw new Error(`Google API error: 400 ${detail.slice(0, 200)}`);
    }
  }

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

// ---------------------------------------------------------------------------
// Vision
// ---------------------------------------------------------------------------

/**
 * Fetch an image and return base64 + mime type. Gemini will not take a URL, so
 * the bytes have to be inlined.
 */
async function fetchImageAsBase64(
  url: string,
  signal: AbortSignal | undefined
): Promise<{ data: string; mediaType: string }> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Image fetch ${res.status} for ${url.slice(-40)}`);
  const buf = await res.arrayBuffer();
  return {
    data: Buffer.from(buf).toString("base64"),
    mediaType: res.headers.get("content-type") || "image/jpeg",
  };
}

/**
 * Single dispatcher for every vision AI call, mirroring `callModel`.
 *
 * Replaces two hand-rolled per-provider copies in lesson-studio. One of them
 * (`generate-lesson/vision-v2.ts`) sent Gemini a parts array of all-undefined
 * values, so it shipped no image at all and "failed over" on a malformed
 * request rather than on Gemini being unable to answer.
 */
export async function callVisionModel(
  provider: string,
  modelId: string,
  apiKey: string,
  prompt: string,
  imageUrl: string,
  options: AICallOptions = {}
): Promise<AICallResult> {
  const { system, maxTokens, temperature, timeoutMs, signal } = { ...DEFAULTS, ...options };

  switch (provider) {
    case "groq":
    case "cerebras": {
      const { callOpenAICompatChat } = await import("@/shared/services/openai-compat");
      const messages = [
        ...(system ? [{ role: "system" as const, content: system }] : []),
        {
          role: "user" as const,
          content: [
            { type: "image_url", image_url: { url: imageUrl } },
            { type: "text", text: prompt },
          ],
        },
      ];
      const res = await callOpenAICompatChat(
        provider,
        modelId,
        apiKey,
        messages as Parameters<typeof callOpenAICompatChat>[3],
        { maxTokens, temperature, timeoutMs, signal }
      );
      return { content: res.content, tokenUsage: res.tokenUsage };
    }

    case "claude": {
      const { callClaudeVision } = await import("@/shared/services/claude-api");
      const res = await callClaudeVision(prompt, imageUrl, modelId, apiKey, {
        system,
        maxTokens,
        temperature,
        timeoutMs,
      });
      return { content: res.content, tokenUsage: res.tokenUsage };
    }

    case "google":
    case "gemini": {
      const img = await fetchImageAsBase64(imageUrl, signal);
      const response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inline_data: { mime_type: img.mediaType, data: img.data } },
                  { text: prompt },
                ],
              },
            ],
            ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens,
              // Same trap as the text path: thinking tokens eat maxOutputTokens
              // and truncate the JSON. The lite models in VISION_FALLBACK_CHAIN
              // reject the parameter, so this is a no-op for them today.
              ...(shouldDisableThinking(modelId) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
            },
          }),
        },
        timeoutMs,
        signal,
        "Google"
      );
      if (!response.ok) {
        throw new Error(`Google vision API error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return {
        content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
        tokenUsage: data.usageMetadata
          ? {
              prompt_tokens: data.usageMetadata.promptTokenCount ?? 0,
              completion_tokens: data.usageMetadata.candidatesTokenCount ?? 0,
              total_tokens: data.usageMetadata.totalTokenCount ?? 0,
            }
          : undefined,
      };
    }

    default:
      throw new Error(`Unsupported vision provider: ${provider}`);
  }
}
