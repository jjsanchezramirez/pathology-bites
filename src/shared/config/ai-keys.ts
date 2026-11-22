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
 * Keys are read from server-only names (no `NEXT_PUBLIC_` prefix) and stored
 * in Vercel as Sensitive. The `NEXT_PUBLIC_` reads below are a TEMPORARY
 * fallback so a deploy never runs keyless while the env migration is in
 * flight — delete them once the old variables are removed from Vercel.
 */
export const API_KEYS = {
  groq: process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || "",
  cerebras: process.env.CEREBRAS_API_KEY || process.env.NEXT_PUBLIC_CEREBRAS_API_KEY || "",
  google:
    process.env.GOOGLE_AI_STUDIO_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_AI_STUDIO_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    "",
  mistral: process.env.MISTRAL_API_KEY || process.env.NEXT_PUBLIC_MISTRAL_API_KEY || "",
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
 * Providers locked off until someone confirms the account has funds.
 *
 * Cerebras is prepaid and its balance is empty: every model answers 402
 * (re-checked 2026-11-21). The key stays configured so it can be switched back
 * on without a key hunt, but the provider reads as unconfigured — so no chain,
 * pinned model or catalog flip can spend an attempt on it — until
 * CEREBRAS_ENABLED=true is set. Only set it after confirming funds at
 * console.cerebras.ai.
 */
export function isProviderLocked(provider: string): boolean {
  return provider === "cerebras" && process.env.CEREBRAS_ENABLED !== "true";
}

/** Get the API key for a provider. Empty string when unconfigured or locked. */
export function getApiKey(provider: string): string {
  if (isProviderLocked(provider)) {
    log.warn(
      `⚠️ ${provider} is locked (no funds). Set CEREBRAS_ENABLED=true only after topping up.`
    );
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
