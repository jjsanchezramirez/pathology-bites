/**
 * Every AI provider has an on/off switch in the environment. Working providers
 * default on (only "false" turns them off); Cerebras (402, no funds) defaults
 * off (only "true" turns it on). A switched-off
 * provider keeps its key but must read as unconfigured, so no chain, pinned
 * model or catalog flip spends an attempt on it.
 */
import { describe, it, expect, vi, afterEach } from "vitest";

async function loadKeys() {
  vi.resetModules();
  return import("@/shared/config/ai-keys");
}

describe("AI provider switches", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ignores a configured Cerebras key while locked", async () => {
    vi.stubEnv("CEREBRAS_API_KEY", "csk-test");
    vi.stubEnv("CEREBRAS_ENABLED", "");
    const { getApiKey, hasApiKey, getAvailableProviders } = await loadKeys();
    expect(getApiKey("cerebras")).toBe("");
    expect(hasApiKey("cerebras")).toBe(false);
    expect(getAvailableProviders()).not.toContain("cerebras");
  });

  it("only unlocks on an explicit CEREBRAS_ENABLED=true", async () => {
    vi.stubEnv("CEREBRAS_API_KEY", "csk-test");
    vi.stubEnv("CEREBRAS_ENABLED", "1");
    expect((await loadKeys()).hasApiKey("cerebras")).toBe(false);

    vi.stubEnv("CEREBRAS_ENABLED", "true");
    const { getApiKey, hasApiKey } = await loadKeys();
    expect(getApiKey("cerebras")).toBe("csk-test");
    expect(hasApiKey("cerebras")).toBe(true);
  });

  it.each([
    ["groq", "GROQ_API_KEY", "GROQ_ENABLED"],
    ["google", "GOOGLE_AI_STUDIO_API_KEY", "GEMINI_ENABLED"],
    ["cloudflare", "CLOUDFLARE_AI_API_TOKEN", "CLOUDFLARE_AI_ENABLED"],
    ["openai", "OPENAI_API_KEY", "OPENAI_ENABLED"],
  ])("switches %s off only on an explicit %s=false", async (provider, keyEnv, switchEnv) => {
    vi.stubEnv(keyEnv, "test-key");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
    vi.stubEnv(switchEnv, "");
    expect((await loadKeys()).hasApiKey(provider)).toBe(true);

    vi.stubEnv(switchEnv, "0");
    expect((await loadKeys()).hasApiKey(provider)).toBe(true);

    vi.stubEnv(switchEnv, "false");
    const keys = await loadKeys();
    expect(keys.hasApiKey(provider)).toBe(false);
    expect(keys.getApiKey(provider)).toBe("");
  });

  it("treats the gemini catalog alias like google", async () => {
    vi.stubEnv("GEMINI_ENABLED", "false");
    expect((await loadKeys()).isProviderLocked("gemini")).toBe(true);
  });

  it("does not lock other providers", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk-test");
    vi.stubEnv("GOOGLE_AI_STUDIO_API_KEY", "goog-test");
    vi.stubEnv("CEREBRAS_ENABLED", "");
    const keys = await loadKeys();
    expect(keys.hasApiKey("groq")).toBe(true);
    expect(keys.hasApiKey("google")).toBe(true);
  });
});
