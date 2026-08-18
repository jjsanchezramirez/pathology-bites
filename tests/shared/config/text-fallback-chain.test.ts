/**
 * Invariants for the shared text fallback chain.
 *
 * The order was set from measured wall-clock on a real WSI question prompt
 * (~830 prompt tokens, maxTokens 2000, Aug 2026). These tests do not re-measure
 * — they pin the decisions that measurement produced, so a future edit has to
 * be deliberate rather than accidental.
 */
import { describe, it, expect } from "vitest";
import {
  AI_TASKS,
  TEXT_FALLBACK_CHAIN,
  getModelProvider,
  ACTIVE_AI_MODELS,
} from "@/shared/config/ai-models";

/** Measured seconds to produce a full WSI question. */
const MEASURED_SECONDS: Record<string, number> = {
  "gpt-oss-120b": 1.05,
  // llama-3.1-8b-instant measured 1.55s but Groq decommissioned it 2026-08-16.
  // Dropped rather than kept as a record: a fast number next to a dead model id
  // is an invitation to put it back in the chain.
  "llama-3.3-70b-versatile": 3.58,
  "gemini-2.5-flash-lite": 4.4,
  "mistral-large-latest": 19.8,
};

describe("TEXT_FALLBACK_CHAIN", () => {
  it("leads with the fastest measured model", () => {
    // gpt-oss-120b was 3.4x faster than the previous leader and is also the
    // largest model in the chain, so there is no speed/quality trade to make.
    expect(TEXT_FALLBACK_CHAIN[0]).toBe("gpt-oss-120b");
  });

  it("does not contain models that cannot serve a WSI question", () => {
    // zai-glm-4.7 spends the whole 2000-token budget on reasoning and returns
    // content that fails to parse; mistral-medium took 17.8s against a 12s
    // timeout. Both were in the chain and neither could ever succeed.
    expect(TEXT_FALLBACK_CHAIN).not.toContain("zai-glm-4.7");
    expect(TEXT_FALLBACK_CHAIN).not.toContain("mistral-medium-2505");
  });

  it("puts every model that fits the WSI deadline ahead of every model that does not", () => {
    const budget = AI_TASKS["wsi-question"].timeoutMs / 1000;
    const fits = TEXT_FALLBACK_CHAIN.map((m) => (MEASURED_SECONDS[m] ?? 0) < budget);
    const firstMiss = fits.indexOf(false);
    if (firstMiss !== -1) {
      // Once one model is too slow for the budget, all later ones must be too:
      // a usable model must never sit behind an unusable one.
      expect(fits.slice(firstMiss).every((f) => !f)).toBe(true);
    }
  });

  it("reaches at least three providers, so one outage cannot empty the chain", () => {
    const providers = new Set(TEXT_FALLBACK_CHAIN.map(getModelProvider));
    expect(providers.size).toBeGreaterThanOrEqual(3);
  });

  it("never places two models from the same provider first and second", () => {
    // The first failover should change provider — most failures (rate limit,
    // auth, outage) are provider-wide rather than model-specific.
    expect(getModelProvider(TEXT_FALLBACK_CHAIN[0])).not.toBe(
      getModelProvider(TEXT_FALLBACK_CHAIN[1])
    );
  });

  it("references only models that exist and are marked available", () => {
    const available = new Set(ACTIVE_AI_MODELS.filter((m) => m.available).map((m) => m.id));
    for (const model of TEXT_FALLBACK_CHAIN) {
      expect(available.has(model), `${model} missing from ACTIVE_AI_MODELS`).toBe(true);
    }
  });

  it("excludes paid models from automatic fallback", () => {
    // Production traffic must never silently cascade into a paid provider.
    expect(TEXT_FALLBACK_CHAIN.some((m) => m.startsWith("claude-"))).toBe(false);
  });
});
