// Shared AI fallback runner.
// All routes that need provider resilience call through here.
// Used by: lesson-studio (3 passes), generate-sequence (segmenter, vision),
// WSI question generation, debug routes.

import { getApiKey, getModelProvider } from "@/shared/config/ai-models";
import { log } from "@/shared/utils/logging";

type ErrorClass = "retryable" | "fallback" | "fatal";

function classifyError(error: unknown): ErrorClass {
  const msg =
    typeof error === "string" ? error : error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (
    lower.includes("503") ||
    lower.includes("service unavailable") ||
    lower.includes("timeout") ||
    lower.includes("network") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("overloaded") ||
    lower.includes("try again") ||
    lower.includes("service_tier_capacity_exceeded")
  ) {
    return "retryable";
  }

  if (
    lower.includes("401") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid api key") ||
    lower.includes("invalid x-api-key") ||
    lower.includes("token limit") ||
    lower.includes("context length") ||
    lower.includes("model not found") ||
    lower.includes("invalid_model") ||
    lower.includes("quota exceeded") ||
    lower.includes("billing") ||
    lower.includes("403")
  ) {
    return "fallback";
  }

  return "fallback";
}

// Retry budget: 1 retry per model w/ 500ms base delay.
// Rationale: most retryable errors (rate-limit, 503) don't recover in 1-3s.
// Fewer retries → faster failover to next model in chain.
const DEFAULT_MAX_RETRIES = 1;
const BASE_DELAY_MS = 500;
const BACKOFF_MULTIPLIER = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CallWithFallbackOptions {
  /** Override the fallback chain — try only this model, no fallback. */
  modelOverride?: string;
  /** Max retries per model for retryable errors. Default 2. */
  maxRetries?: number;
}

/**
 * Try calling `callFn` with each model in order.
 * For retryable errors, retry the same model up to maxRetries times.
 * For fallback/fatal errors, move to the next model.
 *
 * If `options.modelOverride` is set, only that model is tried (no fallback).
 */
export async function callWithFallback<T>(
  modelIds: string[],
  callFn: (model: string, apiKey: string, provider: string) => Promise<T>,
  label: string,
  options: CallWithFallbackOptions = {}
): Promise<T> {
  const { modelOverride, maxRetries = DEFAULT_MAX_RETRIES } = options;
  const chain = modelOverride ? [modelOverride] : modelIds;
  const errors: string[] = [];

  for (const modelId of chain) {
    const provider = getModelProvider(modelId);
    const apiKey = getApiKey(provider);
    if (!apiKey) {
      const msg = `No API key for provider "${provider}" (model ${modelId})`;
      log.warn(`[${label}] ${msg}, skipping`);
      errors.push(`${modelId}: ${msg}`);
      continue;
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        log.debug(`[${label}] Trying ${modelId}${attempt > 0 ? ` (retry ${attempt})` : ""}`);
        return await callFn(modelId, apiKey, provider);
      } catch (err) {
        const errClass = classifyError(err);
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${modelId}[${attempt}]: ${msg}`);
        log.warn(`[${label}] ${modelId} attempt ${attempt} failed (${errClass}): ${msg}`);

        if (errClass === "retryable" && attempt < maxRetries) {
          const delay = BASE_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, attempt);
          await sleep(delay);
          continue;
        }
        break;
      }
    }
  }

  throw new Error(`[${label}] All models exhausted. Errors:\n${errors.join("\n")}`);
}
