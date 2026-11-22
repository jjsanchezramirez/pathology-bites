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
  // Workers AI. A plain Cloudflare API token with the Workers AI Read binding.
  cloudflare: process.env.CLOUDFLARE_AI_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "",
  // OpenAI — only Whisper word timing for lesson narration (optional).
  openai: process.env.OPENAI_API_KEY || "",
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
 * One on/off switch per AI provider, set in Vercel — so any provider can be
 * turned off (outage, runaway bill, dead account) or back on without a code
 * change. A switched-off provider keeps its key but reads as unconfigured, so
 * no chain, pinned model or catalog flip can spend an attempt on it.
 *
 * Defaults keep production unchanged when a variable is unset:
 * - default ON  → switched off only by exactly "false"
 * - default OFF → switched on only by exactly "true"
 *
 * Off by default, and why (unlock only once the account works again):
 * - Cerebras: prepaid, balance empty — every model answers 402 (2026-11-21).
 */
const PROVIDER_SWITCHES: Record<string, { env: string; defaultOn: boolean }> = {
  groq: { env: "GROQ_ENABLED", defaultOn: true },
  google: { env: "GEMINI_ENABLED", defaultOn: true },
  gemini: { env: "GEMINI_ENABLED", defaultOn: true }, // catalog alias of google
  cloudflare: { env: "CLOUDFLARE_AI_ENABLED", defaultOn: true },
  openai: { env: "OPENAI_ENABLED", defaultOn: true },
  cerebras: { env: "CEREBRAS_ENABLED", defaultOn: false },
};

/** The env variable that switches a provider on or off, if it has one. */
export function providerSwitchEnv(provider: string): string | undefined {
  return PROVIDER_SWITCHES[provider]?.env;
}

/** Whether a provider is switched off. Unknown providers are never switched off. */
export function isProviderLocked(provider: string): boolean {
  const sw = PROVIDER_SWITCHES[provider];
  if (!sw) return false;
  const value = process.env[sw.env];
  return sw.defaultOn ? value === "false" : value !== "true";
}

/** Get the API key for a provider. Empty string when unconfigured or locked. */
export function getApiKey(provider: string): string {
  if (isProviderLocked(provider)) {
    // debug, not warn: the fallback walk already warns when it skips a keyless
    // provider, so a warning here would fire twice on every chain walk.
    log.debug(`${provider} is switched off (${providerSwitchEnv(provider)}).`);
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
