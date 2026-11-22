import "server-only";

import { log } from "@/shared/utils/logging";

/**
 * Provider API keys. Server-only, enforced by the import above.
 *
 * These lived in `ai-models.ts` next to the model catalog — which four admin
 * CLIENT components import for `ACTIVE_AI_MODELS`. A production build was
 * verified clean (webpack tree-shook the constant away), but that was luck, not
 * design: a single `getApiKey()` call from a client component would have
 * inlined all five keys into a public bundle, and `NEXT_PUBLIC_` prefixes mean
 * they inline without complaint.
 *
 * `server-only` turns that from a silent leak into a build error. Splitting the
 * file is what makes the guarantee real — the catalog stays importable from the
 * client, the keys cannot be.
 *
 * Keys are read from server-only names and stored in Vercel as Sensitive.
 * Never give them a `NEXT_PUBLIC_` prefix: that inlines the value into the
 * browser bundle wherever it is referenced (Vercel flags it as exposed). The
 * old `NEXT_PUBLIC_*_API_KEY` variables were deleted from Vercel 2026-11-22.
 */
export const API_KEYS = {
  groq: process.env.GROQ_API_KEY || "",
  cerebras: process.env.CEREBRAS_API_KEY || "",
  google: process.env.GOOGLE_AI_STUDIO_API_KEY || process.env.GEMINI_API_KEY || "",
  mistral: process.env.MISTRAL_API_KEY || "",
  // Workers AI. A plain Cloudflare API token with the Workers AI Read binding.
  cloudflare: process.env.CLOUDFLARE_AI_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "",
};

/**
 * Some providers need more than a key before a call can be made. Cloudflare's
 * endpoint is account-scoped, so a token on its own addresses nothing — and the
 * fallback walk decides whether to skip a model purely on `getApiKey`, so an
 * incomplete config has to read as unconfigured there or the chain spends an
 * attempt discovering it.
 */
function missingCompanionConfig(provider: string): boolean {
  return (
    provider === "cloudflare" &&
    !(process.env.CLOUDFLARE_ACCOUNT_ID || process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID)
  );
}

/**
 * Providers locked off until their account is usable again. Each stays
 * configured so it can be switched back on without a key hunt, but reads as
 * unconfigured — so no chain, pinned model or catalog flip can spend an
 * attempt on it — until its `*_ENABLED` variable is exactly "true".
 *
 * - Cerebras: prepaid, balance empty — every model answers 402 (re-checked
 *   2026-11-21). Unlock only after confirming funds at console.cerebras.ai.
 * - Mistral: the workspace has a 0 requests/minute limit on every model
 *   (`x-ratelimit-limit-req-minute: 0`, 2026-11-22) — no active plan. The key
 *   is valid. Unlock only after admin.mistral.ai shows a non-zero limit.
 */
const PROVIDER_LOCKS: Record<string, string> = {
  cerebras: "CEREBRAS_ENABLED",
  mistral: "MISTRAL_ENABLED",
};

export function isProviderLocked(provider: string): boolean {
  const flag = PROVIDER_LOCKS[provider];
  return !!flag && process.env[flag] !== "true";
}

/** Get the API key for a provider. Empty string when unconfigured or locked. */
export function getApiKey(provider: string): string {
  if (isProviderLocked(provider)) {
    // debug, not warn: the fallback walk already warns when it skips a keyless
    // provider, and Mistral sits in the chain, so this would fire every request.
    log.debug(`${provider} is locked; set ${PROVIDER_LOCKS[provider]}=true to re-enable.`);
    return "";
  }
  const key = API_KEYS[provider as keyof typeof API_KEYS];
  if (key && missingCompanionConfig(provider)) {
    log.warn(
      `⚠️ ${provider} has a key but no CLOUDFLARE_ACCOUNT_ID; its endpoint is account-scoped, so it is skipped.`
    );
    return "";
  }
  if (!key) {
    log.warn(
      `⚠️ No API key found for provider: ${provider}. Please set ${provider.toUpperCase()}_API_KEY in your environment variables.`
    );
  }
  return key || "";
}

/** Whether a provider has a usable key configured. */
export function hasApiKey(provider: string): boolean {
  if (isProviderLocked(provider)) return false;
  const key = API_KEYS[provider as keyof typeof API_KEYS];
  return !!(key && key.trim() !== "" && !missingCompanionConfig(provider));
}

/** Every provider with a key configured. */
export function getAvailableProviders(): string[] {
  return Object.keys(API_KEYS).filter(hasApiKey);
}
