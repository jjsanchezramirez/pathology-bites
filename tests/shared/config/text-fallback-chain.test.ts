/**
 * Invariants for the shared text fallback chain.
 *
 * The order was set from measured wall-clock on a real WSI question prompt
 * (~830 prompt tokens, maxTokens 2000, Aug 2026), then revised by a cost pass
 * (Aug 2026) that priced a month of real traffic on every service serving these
 * models. These tests do not re-measure or re-price — they pin the decisions
 * those passes produced, so a future edit has to be deliberate rather than
 * accidental.
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
  it("leads with Groq, not with the fastest model", () => {
    // Cerebras' gpt-oss-120b is 4x faster (0.9s vs 3.6s) and led this chain
    // until Aug 2026. It lost the slot on three counts that outrank 2.7s:
    // it costs more per token, it allows 5 RPM against Groq's 30, and its
    // balance is prepaid — so it fails with 402 and no warning, taking the
    // leader slot dark rather than degrading. Groq 429s instead, which the
    // fallback walk handles in milliseconds.
    expect(TEXT_FALLBACK_CHAIN[0]).toBe("openai/gpt-oss-120b");
    expect(getModelProvider(TEXT_FALLBACK_CHAIN[0])).toBe("groq");
  });

  it("keeps the two fastest models in the two leading slots", () => {
    // Cost reordered the chain; it did not abandon latency. Both servings of
    // gpt-oss-120b — the only sub-4s models measured — still lead.
    expect(TEXT_FALLBACK_CHAIN.slice(0, 2).sort()).toEqual(
      ["gpt-oss-120b", "openai/gpt-oss-120b"].sort()
    );
  });

  it("puts Gemini last, because it is the most expensive option available", () => {
    // $0.30 in / $2.50 out per MTok. On this output-heavy workload that is
    // ~$20.68/month against $5.69 for Groq and $0.66 for Cloudflare — 2.4x the
    // next dearest. It sat at slot 2 absorbing every leader failure, which only
    // looked free because current volume fits inside Google's 1,000 req/day.
    // Promoting it again should require editing this test.
    expect(TEXT_FALLBACK_CHAIN[TEXT_FALLBACK_CHAIN.length - 1]).toBe("gemini-3.5-flash-lite");
  });

  it("carries a backstop that bills nothing at current volume", () => {
    // Cloudflare's 10K free neurons/day cover ~39% of a month's traffic, and
    // the overflow on gpt-oss-20b is ~$0.66. When the cheap-and-fast providers
    // have all hit their ceilings, the chain should still reach something whose
    // marginal cost is a rounding error.
    expect(TEXT_FALLBACK_CHAIN).toContain("@cf/openai/gpt-oss-20b");
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

  it("never repeats a provider, so no slot can be skipped by an earlier failure", () => {
    // Most failures are provider-wide. A second model behind the same provider
    // is an attempt that cannot succeed once the first one has failed — the
    // same waste that a decommissioned model id caused.
    const providers = TEXT_FALLBACK_CHAIN.map(getModelProvider);
    expect(new Set(providers).size).toBe(providers.length);
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

  it("excludes Claude from automatic fallback", () => {
    // This used to read "excludes paid models", which is no longer true of the
    // chain: Cerebras is prepaid and Cloudflare meters past its free neurons.
    // What the rule actually protects against is a cascade into frontier-priced
    // models — roughly 20-100x the rest of the chain per token. Claude stays
    // callable by explicit override, never by automatic fallback.
    expect(TEXT_FALLBACK_CHAIN.some((m) => m.startsWith("claude-"))).toBe(false);
  });
});
