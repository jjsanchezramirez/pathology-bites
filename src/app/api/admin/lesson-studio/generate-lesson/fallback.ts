// Model fallback and retry utilities for the lesson generation pipeline.
// Ported from the WSI question generation pattern.

import { getApiKey, getModelProvider } from "@/shared/config/ai-models";

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

export type ErrorClass = "retryable" | "fallback" | "fatal";

export function classifyError(error: unknown): ErrorClass {
  const msg =
    typeof error === "string" ? error : error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  // Retryable: transient issues that might resolve quickly
  if (
    lower.includes("503") ||
    lower.includes("service unavailable") ||
    lower.includes("timeout") ||
    lower.includes("network") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("overloaded") ||
    lower.includes("try again")
  ) {
    return "retryable";
  }

  // Fallback: fundamental issues with the current model/key
  if (
    lower.includes("401") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid api key") ||
    lower.includes("invalid x-api-key") ||
    lower.includes("token limit") ||
    lower.includes("context length") ||
    lower.includes("model not found") ||
    lower.includes("quota exceeded") ||
    lower.includes("billing")
  ) {
    return "fallback";
  }

  return "fallback"; // conservative default
}

// ---------------------------------------------------------------------------
// Retry + fallback runner
// ---------------------------------------------------------------------------

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1000;
const BACKOFF_MULTIPLIER = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Try calling `callFn` with each model in order.
 * For retryable errors, retry the same model up to MAX_RETRIES times.
 * For fallback/fatal errors, move to the next model.
 */
export async function callWithFallback<T>(
  modelIds: string[],
  callFn: (model: string, apiKey: string, provider: string) => Promise<T>,
  label: string
): Promise<T> {
  const errors: string[] = [];

  for (const modelId of modelIds) {
    const provider = getModelProvider(modelId);
    const apiKey = getApiKey(provider);
    if (!apiKey) {
      console.warn(`[${label}] No API key for provider "${provider}" (model ${modelId}), skipping`);
      continue;
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[${label}] Trying ${modelId}${attempt > 0 ? ` (retry ${attempt})` : ""}`);
        return await callFn(modelId, apiKey, provider);
      } catch (err) {
        const errClass = classifyError(err);
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${modelId}[${attempt}]: ${msg}`);
        console.warn(`[${label}] ${modelId} attempt ${attempt} failed (${errClass}): ${msg}`);

        if (errClass === "retryable" && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, attempt);
          await sleep(delay);
          continue;
        }
        // fallback or fatal or retries exhausted → next model
        break;
      }
    }
  }

  throw new Error(`[${label}] All models exhausted. Errors:\n${errors.join("\n")}`);
}
