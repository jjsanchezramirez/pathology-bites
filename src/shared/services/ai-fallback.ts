// Shared AI fallback runner.
// All routes that need provider resilience call through here.
// Used by: lesson-studio (3 passes), generate-sequence (vision),
// WSI question generation, debug routes.

import { getApiKey, getModelProvider, resolveModelId } from "@/shared/config/ai-models";
import { log } from "@/shared/utils/logging";

type FailureAction = "retry" | "next";

export interface Classification {
  /** Retry the SAME provider (transient "briefly busy"), or move to the NEXT one. */
  action: FailureAction;
  /** How long to skip this provider on *later* requests. 0 = provider is
   *  healthy; the failure was request-specific (bad context length / model id). */
  cooldownMs: number;
}

// Free-tier rate limits are billed against one shared key per provider, so a
// limit is account-global and won't clear in a second — skip the provider for a
// window. Transient unreachability / auth failure gets a shorter skip.
const RATE_LIMIT_COOLDOWN_MS = 60_000;
const TRANSIENT_COOLDOWN_MS = 15_000;

/** @internal exported for testing */
export function classifyError(error: unknown): Classification {
  const msg =
    typeof error === "string" ? error : error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  // Rate / quota limits — capped on the shared key; retrying the same provider
  // is guaranteed to fail. Move on and skip it for a window.
  if (
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("too many requests") ||
    lower.includes("quota") ||
    lower.includes("billing")
  ) {
    return { action: "next", cooldownMs: RATE_LIMIT_COOLDOWN_MS };
  }

  // Auth / config failure — the whole provider is unusable (bad or missing key),
  // so every model on it will fail. Skip it, short cooldown.
  if (
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid api key") ||
    lower.includes("invalid x-api-key")
  ) {
    return { action: "next", cooldownMs: TRANSIENT_COOLDOWN_MS };
  }

  // Hung or unreachable — don't burn a second full timeout on the same provider.
  if (
    lower.includes("timeout") ||
    lower.includes("network") ||
    lower.includes("econnreset") ||
    lower.includes("econnrefused") ||
    lower.includes("fetch failed")
  ) {
    return { action: "next", cooldownMs: TRANSIENT_COOLDOWN_MS };
  }

  // Provider explicitly says "briefly busy, retry" — one quick same-provider
  // retry is worthwhile; it usually recovers within a second.
  if (
    lower.includes("503") ||
    lower.includes("service unavailable") ||
    lower.includes("overloaded") ||
    lower.includes("try again") ||
    lower.includes("service_tier_capacity_exceeded")
  ) {
    return { action: "retry", cooldownMs: 0 };
  }

  // Request-specific (context length, bad model id, unknown) — the provider is
  // healthy, this request just won't work with this model. Move on to the next
  // model without penalising the provider (a sibling model may still work).
  return { action: "next", cooldownMs: 0 };
}

// Retry budget for the "retry" action (transient busy signals only).
const DEFAULT_MAX_RETRIES = 1;
const BASE_DELAY_MS = 400;
const BACKOFF_MULTIPLIER = 2;

// Per-provider cooldown, module scope. Lives only within a warm serverless
// instance — a cold start begins empty. Enough to spare a burst of requests
// from each re-paying a dead provider's timeout; NOT a globally shared health
// record (use a KV store if you ever need cross-instance truth).
const providerCooldownUntil = new Map<string, number>();

/** @internal test seam — clears cooldown state between test cases. */
export function _resetProviderCooldowns(): void {
  providerCooldownUntil.clear();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CallWithFallbackOptions {
  /** Override the fallback chain — try only this model, no fallback. */
  modelOverride?: string;
  /** Max same-provider retries for transient "busy" errors. Default 1. */
  maxRetries?: number;
}

/**
 * Try calling `callFn` with each model in order.
 *
 * Providers that recently failed at the provider level (rate-limit, auth,
 * timeout) are moved to the back of the chain — a healthy provider is tried
 * first, but a fully-cooled chain is still attempted as a last resort. Within a
 * single call, once a provider fails at the provider level its remaining models
 * are skipped (they'd hit the same wall). Only transient "briefly busy" signals
 * (503/overloaded) trigger a same-provider retry.
 *
 * If `options.modelOverride` is set, only that model is tried (no fallback,
 * cooldown ignored — the caller asked for it explicitly).
 */
export async function callWithFallback<T>(
  modelIds: string[],
  callFn: (model: string, apiKey: string, provider: string) => Promise<T>,
  label: string,
  options: CallWithFallbackOptions = {}
): Promise<T> {
  const { modelOverride, maxRetries = DEFAULT_MAX_RETRIES } = options;
  // resolveModelId: stale Meta Llama API IDs (saved prefs/links) → live equivalents.
  const chain = (modelOverride ? [modelOverride] : modelIds).map(resolveModelId);

  // Deprioritise (never drop) providers cooling down from a recent request, so a
  // healthy provider is tried first but a fully-cooled chain still gets attempted.
  let ordered = chain;
  if (!modelOverride) {
    const now = Date.now();
    const ready: string[] = [];
    const cooling: string[] = [];
    for (const modelId of chain) {
      const until = providerCooldownUntil.get(getModelProvider(modelId)) ?? 0;
      (until > now ? cooling : ready).push(modelId);
    }
    ordered = [...ready, ...cooling];
  }

  const errors: string[] = [];
  // Providers that failed at the provider level *this call* — skip their other models.
  const failedThisCall = new Set<string>();

  for (const modelId of ordered) {
    const provider = getModelProvider(modelId);
    if (failedThisCall.has(provider)) continue;

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
        const result = await callFn(modelId, apiKey, provider);
        providerCooldownUntil.delete(provider); // recovered — clear any cooldown
        return result;
      } catch (err) {
        const { action, cooldownMs } = classifyError(err);
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${modelId}[${attempt}]: ${msg}`);
        log.warn(`[${label}] ${modelId} attempt ${attempt} failed (${action}): ${msg}`);

        if (cooldownMs > 0) {
          providerCooldownUntil.set(provider, Date.now() + cooldownMs);
          failedThisCall.add(provider);
        }

        if (action === "retry" && attempt < maxRetries) {
          await sleep(BASE_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, attempt));
          continue;
        }
        break; // move to next provider
      }
    }
  }

  throw new Error(`[${label}] All models exhausted. Errors:\n${errors.join("\n")}`);
}
