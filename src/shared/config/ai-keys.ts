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
 * The `NEXT_PUBLIC_` names are kept because they are what is configured in
 * Vercel today; renaming them is an env migration, not a code change. The
 * import guard is what actually contains them.
 */
export const API_KEYS = {
  groq: process.env.NEXT_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY || "",
  cerebras: process.env.NEXT_PUBLIC_CEREBRAS_API_KEY || process.env.CEREBRAS_API_KEY || "",
  google:
    process.env.NEXT_PUBLIC_GOOGLE_AI_STUDIO_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    "",
  claude: process.env.NEXT_PUBLIC_CLAUDE_API_KEY || "",
  mistral: process.env.NEXT_PUBLIC_MISTRAL_API_KEY || "",
};

/** Get the API key for a provider. Empty string when unconfigured. */
export function getApiKey(provider: string): string {
  const key = API_KEYS[provider as keyof typeof API_KEYS];
  if (!key) {
    log.warn(
      `⚠️ No API key found for provider: ${provider}. Please set NEXT_PUBLIC_${provider.toUpperCase()}_API_KEY in your environment variables.`
    );
  }
  return key || "";
}

/** Whether a provider has a usable key configured. */
export function hasApiKey(provider: string): boolean {
  const key = API_KEYS[provider as keyof typeof API_KEYS];
  return !!(key && key.trim() !== "");
}

/** Every provider with a key configured. */
export function getAvailableProviders(): string[] {
  return Object.entries(API_KEYS)
    .filter(([, key]) => key && key.trim() !== "")
    .map(([provider]) => provider);
}
