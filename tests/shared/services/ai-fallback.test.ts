import { describe, it, expect, beforeEach, vi } from "vitest";

// Deterministic provider/key resolution: model id "provider:variant" → provider.
// "nokey:*" simulates a provider with no configured API key.
vi.mock("@/shared/config/ai-models", () => ({
  getModelProvider: (model: string) => model.split(":")[0],
  getApiKey: (provider: string) => (provider === "nokey" ? "" : "test-key"),
  resolveModelId: (model: string) => model,
}));

vi.mock("@/shared/utils/logging", () => ({
  log: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import {
  callWithFallback,
  classifyError,
  _resetProviderCooldowns,
} from "@/shared/services/ai-fallback";

beforeEach(() => {
  _resetProviderCooldowns();
  vi.clearAllMocks();
});

describe("classifyError", () => {
  it("treats rate-limit / quota as immediate fallback with a long cooldown", () => {
    for (const msg of [
      "429 Too Many Requests",
      "rate limit exceeded",
      "quota exceeded",
      "billing issue",
    ]) {
      expect(classifyError(new Error(msg))).toEqual({ action: "next", cooldownMs: 60_000 });
    }
  });

  it("treats auth failure as fallback with a short cooldown", () => {
    for (const msg of ["401 Unauthorized", "invalid api key", "403 Forbidden"]) {
      expect(classifyError(new Error(msg))).toEqual({ action: "next", cooldownMs: 15_000 });
    }
  });

  it("treats timeout / network as fallback with a short cooldown (no same-provider retry)", () => {
    for (const msg of ["groq API timeout after 10s", "fetch failed", "ECONNRESET"]) {
      expect(classifyError(new Error(msg))).toEqual({ action: "next", cooldownMs: 15_000 });
    }
  });

  it("treats 'briefly busy' signals as same-provider retry with no cooldown", () => {
    for (const msg of ["503 Service Unavailable", "overloaded", "please try again"]) {
      expect(classifyError(new Error(msg))).toEqual({ action: "retry", cooldownMs: 0 });
    }
  });

  it("treats request-specific errors as fallback without penalising the provider", () => {
    for (const msg of ["context length exceeded", "model not found", "totally unknown error"]) {
      expect(classifyError(new Error(msg))).toEqual({ action: "next", cooldownMs: 0 });
    }
  });

  it("accepts a raw string as well as an Error", () => {
    expect(classifyError("rate limit")).toEqual({ action: "next", cooldownMs: 60_000 });
  });
});

describe("callWithFallback", () => {
  it("returns the first model's result without touching the rest", async () => {
    const calls: string[] = [];
    const result = await callWithFallback(
      ["groq:a", "cerebras:a"],
      async (model) => {
        calls.push(model);
        return `ok:${model}`;
      },
      "test"
    );
    expect(result).toBe("ok:groq:a");
    expect(calls).toEqual(["groq:a"]);
  });

  it("skips a provider's remaining models after a provider-level failure", async () => {
    const calls: string[] = [];
    const result = await callWithFallback(
      ["groq:a", "groq:b", "cerebras:a"],
      async (model) => {
        calls.push(model);
        if (model.startsWith("groq")) throw new Error("rate limit");
        return `ok:${model}`;
      },
      "test"
    );
    expect(result).toBe("ok:cerebras:a");
    // groq:b must be skipped — groq already failed at the provider level.
    expect(calls).toEqual(["groq:a", "cerebras:a"]);
  });

  it("still tries a sibling model after a request-specific (non-provider) error", async () => {
    const calls: string[] = [];
    const result = await callWithFallback(
      ["groq:a", "groq:b"],
      async (model) => {
        calls.push(model);
        if (model === "groq:a") throw new Error("context length exceeded");
        return `ok:${model}`;
      },
      "test"
    );
    expect(result).toBe("ok:groq:b");
    expect(calls).toEqual(["groq:a", "groq:b"]);
  });

  it("skips providers with no API key", async () => {
    const calls: string[] = [];
    const result = await callWithFallback(
      ["nokey:a", "groq:a"],
      async (model) => {
        calls.push(model);
        return `ok:${model}`;
      },
      "test"
    );
    expect(result).toBe("ok:groq:a");
    expect(calls).toEqual(["groq:a"]);
  });

  it("deprioritises a provider that failed on a previous call", async () => {
    // Call 1: groq rate-limits → cools down; cerebras serves.
    await callWithFallback(
      ["groq:a", "cerebras:a"],
      async (model) => {
        if (model.startsWith("groq")) throw new Error("rate limit");
        return "ok";
      },
      "test"
    );

    // Call 2: groq is still cooling, so cerebras should be tried FIRST.
    const calls: string[] = [];
    await callWithFallback(
      ["groq:a", "cerebras:a"],
      async (model) => {
        calls.push(model);
        return "ok";
      },
      "test"
    );
    expect(calls[0]).toBe("cerebras:a");
  });

  it("clears a provider's cooldown after it succeeds again", async () => {
    // Cool groq down.
    await callWithFallback(
      ["groq:a", "cerebras:a"],
      async (model) => {
        if (model.startsWith("groq")) throw new Error("rate limit");
        return "ok";
      },
      "test"
    );
    // Single-provider chain forces groq to be tried despite cooling — it succeeds
    // and its cooldown is cleared.
    await callWithFallback(["groq:a"], async () => "ok", "test");

    // Now groq is healthy again → tried first ahead of cerebras.
    const calls: string[] = [];
    await callWithFallback(
      ["groq:a", "cerebras:a"],
      async (model) => {
        calls.push(model);
        return "ok";
      },
      "test"
    );
    expect(calls[0]).toBe("groq:a");
  });

  it("retries the SAME provider once on a transient 503, then succeeds", async () => {
    const calls: string[] = [];
    let attempts = 0;
    const result = await callWithFallback(
      ["groq:a", "cerebras:a"],
      async (model) => {
        calls.push(model);
        if (model === "groq:a" && attempts++ === 0) throw new Error("503 service unavailable");
        return `ok:${model}`;
      },
      "test"
    );
    // Same provider retried, no fallover to cerebras.
    expect(result).toBe("ok:groq:a");
    expect(calls).toEqual(["groq:a", "groq:a"]);
  });

  it("only tries the override model and ignores the chain", async () => {
    const calls: string[] = [];
    const result = await callWithFallback(
      ["groq:a", "cerebras:a"],
      async (model) => {
        calls.push(model);
        return `ok:${model}`;
      },
      "test",
      { modelOverride: "mistral:x" }
    );
    expect(result).toBe("ok:mistral:x");
    expect(calls).toEqual(["mistral:x"]);
  });

  it("throws when every model is exhausted", async () => {
    await expect(
      callWithFallback(
        ["groq:a", "cerebras:a"],
        async () => {
          throw new Error("rate limit");
        },
        "test"
      )
    ).rejects.toThrow(/All models exhausted/);
  });
});
