/**
 * Cerebras is prepaid and out of funds (402 on every model). Its key stays
 * configured, but the provider must read as unconfigured until someone sets
 * CEREBRAS_ENABLED=true after confirming funds — otherwise a catalog flip or a
 * pinned model would spend a chain attempt on a guaranteed failure.
 */
import { describe, it, expect, vi, afterEach } from "vitest";

async function loadKeys() {
  vi.resetModules();
  return import("@/shared/config/ai-keys");
}

describe("provider locks (Cerebras, Mistral)", () => {
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

  it("locks Mistral the same way until MISTRAL_ENABLED=true", async () => {
    vi.stubEnv("MISTRAL_API_KEY", "ms-test");
    vi.stubEnv("MISTRAL_ENABLED", "");
    let keys = await loadKeys();
    expect(keys.getApiKey("mistral")).toBe("");
    expect(keys.getAvailableProviders()).not.toContain("mistral");

    vi.stubEnv("MISTRAL_ENABLED", "true");
    keys = await loadKeys();
    expect(keys.getApiKey("mistral")).toBe("ms-test");
  });

  it("does not lock other providers", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk-test");
    vi.stubEnv("GOOGLE_AI_STUDIO_API_KEY", "goog-test");
    vi.stubEnv("CEREBRAS_ENABLED", "");
    vi.stubEnv("MISTRAL_ENABLED", "");
    const keys = await loadKeys();
    expect(keys.hasApiKey("groq")).toBe(true);
    expect(keys.hasApiKey("google")).toBe(true);
  });
});
