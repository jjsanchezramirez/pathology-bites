/**
 * The unified provider dispatcher.
 *
 * These assertions exist because the four copies this replaced had each drifted:
 * every one of them built the Google request body without a system prompt, and
 * WSI's Mistral copy dropped it too — so the role instruction the caller passed
 * was silently discarded on those providers.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/shared/utils/logging", () => ({
  log: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { callModel } from "@/shared/services/ai-providers";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, statusText: "OK", json: async () => body };
}

const GOOGLE_OK = jsonResponse({
  candidates: [{ content: { parts: [{ text: "generated" }] } }],
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
});

const MISTRAL_OK = jsonResponse({
  choices: [{ message: { content: "generated" } }],
  usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
});

function bodyOf(call: unknown[]) {
  return JSON.parse((call[1] as { body: string }).body);
}

describe("callModel — Google", () => {
  it("sends the system prompt as systemInstruction", async () => {
    fetchMock.mockResolvedValue(GOOGLE_OK);
    await callModel("google", "gemini-2.5-flash-lite", "k", "prompt", {
      system: "You are a pathologist.",
      maxTokens: 1234,
      temperature: 0.4,
    });

    const body = bodyOf(fetchMock.mock.calls[0]);
    expect(body.systemInstruction).toEqual({ parts: [{ text: "You are a pathologist." }] });
    expect(body.generationConfig.maxOutputTokens).toBe(1234);
    expect(body.generationConfig.temperature).toBe(0.4);
  });

  it("omits systemInstruction entirely when no system prompt is given", async () => {
    fetchMock.mockResolvedValue(GOOGLE_OK);
    await callModel("google", "gemini-2.5-flash-lite", "k", "prompt");
    expect(bodyOf(fetchMock.mock.calls[0]).systemInstruction).toBeUndefined();
  });

  it("normalises token usage", async () => {
    fetchMock.mockResolvedValue(GOOGLE_OK);
    const res = await callModel("google", "gemini-2.5-flash-lite", "k", "prompt");
    expect(res.content).toBe("generated");
    expect(res.tokenUsage).toEqual({
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    });
  });

  it("is reachable under the provider id the model catalog produces", async () => {
    fetchMock.mockResolvedValue(GOOGLE_OK);
    // getModelProvider maps the catalog's "gemini" to "google"; accept both so a
    // future change to that mapping can't silently fall through to "unsupported".
    await expect(
      callModel("gemini", "gemini-2.5-flash-lite", "k", "prompt")
    ).resolves.toMatchObject({ content: "generated" });
  });
});

describe("callModel — Mistral", () => {
  it("sends the system prompt as a system message", async () => {
    fetchMock.mockResolvedValue(MISTRAL_OK);
    await callModel("mistral", "mistral-large-latest", "k", "prompt", {
      system: "You are a pathologist.",
      maxTokens: 500,
    });

    const body = bodyOf(fetchMock.mock.calls[0]);
    expect(body.messages).toEqual([
      { role: "system", content: "You are a pathologist." },
      { role: "user", content: "prompt" },
    ]);
    expect(body.max_tokens).toBe(500);
  });

  it("only requests JSON mode when asked", async () => {
    fetchMock.mockResolvedValue(MISTRAL_OK);
    await callModel("mistral", "mistral-large-latest", "k", "p", { jsonMode: true });
    expect(bodyOf(fetchMock.mock.calls[0]).response_format).toEqual({ type: "json_object" });

    fetchMock.mockClear();
    await callModel("mistral", "mistral-large-latest", "k", "p");
    expect(bodyOf(fetchMock.mock.calls[0]).response_format).toBeUndefined();
  });
});

describe("callModel — failures", () => {
  it("surfaces a non-OK response as an error carrying the status", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, statusText: "Too Many Requests" });
    await expect(callModel("mistral", "mistral-large-latest", "k", "p")).rejects.toThrow(
      /Mistral API error: 429/
    );
  });

  it("rejects an unknown provider rather than silently doing nothing", async () => {
    await expect(callModel("wat", "some-model", "k", "p")).rejects.toThrow(
      /Unsupported model provider: wat/
    );
  });

  it("reports a timeout as a timeout, so it classifies as fallback not a bad request", async () => {
    // Google and Mistral previously ran with no timeout at all; a hung provider
    // could eat the whole serverless budget instead of failing over.
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });
    await expect(
      callModel("google", "gemini-2.5-flash-lite", "k", "p", { timeoutMs: 20 })
    ).rejects.toThrow(/Google API timeout after/);
  });
});
