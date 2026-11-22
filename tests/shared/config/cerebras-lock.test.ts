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

describe("Cerebras lock", () => {
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

  it("does not lock other providers", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk-test");
    vi.stubEnv("CEREBRAS_ENABLED", "");
    expect((await loadKeys()).hasApiKey("groq")).toBe(true);
  });
});
