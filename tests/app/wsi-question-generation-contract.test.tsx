/**
 * The WSI question generation contract, end to end across the seam.
 *
 * The model fallback chain moved from the browser to the server, which changed
 * the response shape: `nextModelIndex` / `nextModel` / `currentModelIndex` /
 * `errorType` / `retryExhausted` are gone. These tests run the REAL route
 * handler (AI layer mocked) and the REAL hook (fetch mocked) against each
 * other, so the two halves can't drift apart silently.
 *
 * The load-bearing one is "issues exactly one request on 401". A single expired
 * session once produced ~89,000 requests in a day because the client walked the
 * chain itself and an unexpected error shape kept the walk going. There is no
 * client-side walk any more; this pins that.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// vi.mock factories are hoisted above const declarations; vi.hoisted keeps the
// shared spy reachable from inside the factory.
const { runAITask } = vi.hoisted(() => ({ runAITask: vi.fn() }));

vi.mock("@/shared/services/ai-fallback", () => ({ runAITask }));
vi.mock("@/shared/utils/logging", () => ({
  log: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const SLIDE = {
  id: "slide-1",
  category: "Gastrointestinal",
  diagnosis: "Tubular adenoma",
  slide_url: "https://example.org/slide",
};

const QUESTION = {
  stem: "A 62-year-old man undergoes screening colonoscopy. What is the diagnosis?",
  options: [
    { id: "a", text: "Tubular adenoma", is_correct: true, explanation: "Correct." },
    { id: "b", text: "Hyperplastic polyp", is_correct: false, explanation: "No." },
  ],
  teaching_point: "Tubular adenomas show low-grade dysplasia.",
  references: ["WHO Digestive System Tumours"],
};

import { POST } from "@/app/api/user/wsi-questions/generate/route";

function postRequest(body: unknown) {
  return new Request("http://localhost/api/user/wsi-questions/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("route: POST /api/user/wsi-questions/generate", () => {
  it("returns the question and the model that produced it", async () => {
    runAITask.mockResolvedValue({
      content: JSON.stringify(QUESTION),
      parsed: QUESTION,
      model: "gpt-oss-120b",
      tokenUsage: { prompt_tokens: 780, completion_tokens: 970, total_tokens: 1750 },
    });

    const res = await POST(postRequest({ wsi: SLIDE }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.question).toEqual(QUESTION);
    expect(body.metadata.model).toBe("gpt-oss-120b");
    expect(body.metadata.token_usage.total_tokens).toBe(1750);
    expect(body.debug.response_length).toBeGreaterThan(0);
  });

  it("no longer advertises a next model for the client to try", async () => {
    runAITask.mockRejectedValue(new Error("All models exhausted. Errors:\n..."));

    const res = await POST(postRequest({ wsi: SLIDE }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.details).toMatch(/All models exhausted/);
    // The whole point of the migration: nothing here invites a client retry.
    for (const dead of [
      "nextModelIndex",
      "nextModel",
      "currentModelIndex",
      "errorType",
      "retryExhausted",
      "availableModels",
    ]) {
      expect(body).not.toHaveProperty(dead);
    }
  });

  it("parses inside the attempt so a bad response can fall through to the next model", async () => {
    runAITask.mockResolvedValue({
      content: "{}",
      parsed: QUESTION,
      model: "mistral-large-latest",
    });
    await POST(postRequest({ wsi: SLIDE }));

    // The route hands parsing to runAITask rather than doing it afterwards —
    // that is what lets a malformed response advance the chain.
    expect(typeof runAITask.mock.calls[0][2].parse).toBe("function");
  });

  it("rejects a slide with no usable image URL before spending a model call", async () => {
    const res = await POST(postRequest({ wsi: { id: "x", diagnosis: "y" } }));
    expect(res.status).toBe(400);
    expect(runAITask).not.toHaveBeenCalled();
  });

  it("pins an explicitly requested model instead of walking the chain", async () => {
    runAITask.mockResolvedValue({ content: "{}", parsed: QUESTION, model: "claude-sonnet-4" });
    await POST(postRequest({ wsi: SLIDE, modelOverride: "claude-opus-5" }));
    expect(runAITask.mock.calls[0][2].modelOverride).toBe("claude-opus-5");
  });
});

describe("hook: useWSIQuestionGenerator", () => {
  const fetchMock = vi.fn();

  async function loadHook() {
    vi.doMock("@/shared/hooks/use-client-wsi-data", () => ({
      useClientWSIData: () => ({ wsiData: [SLIDE], isLoading: false, error: null }),
      loadClientWSIData: async () => [SLIDE],
    }));
    vi.doMock("@/features/user/wsi-questions/utils/wsi-history-tracker", () => ({
      getWSIHistoryTracker: () => ({
        getRecentIds: () => [],
        addToHistory: vi.fn(),
        clearAll: vi.fn(),
        clearCategory: vi.fn(),
        getStats: () => ({}),
      }),
    }));
    const mod = await import("@/shared/hooks/use-wsi-question-generator");
    return mod.useWSIQuestionGenerator;
  }

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("consumes the route's success shape", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        question: QUESTION,
        metadata: { model: "gpt-oss-120b", token_usage: { total_tokens: 1750 } },
      }),
    });

    const useGen = await loadHook();
    const { result } = renderHook(() => useGen());

    let generated: { metadata: { model: string } } | undefined;
    await act(async () => {
      generated = (await result.current.generateQuestion()) as never;
    });

    // Two requests: the one that produced this question, plus the background
    // prefetch queued for the next one. The failure paths below still assert
    // exactly one — a failed generation must not queue anything.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(generated!.metadata.model).toBe("gpt-oss-120b");
  });

  it("issues exactly one request on 401 — the runaway loop is structurally gone", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ error: "Unauthorized" }), // the exact middleware body
    });

    const useGen = await loadHook();
    const { result } = renderHook(() => useGen());

    await act(async () => {
      await expect(result.current.generateQuestion()).rejects.toThrow(/session has expired/i);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.isGenerating).toBe(false));
  });

  it("issues exactly one request when every model failed", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({ success: false, error: "Question generation failed.", details: "..." }),
    });

    const useGen = await loadHook();
    const { result } = renderHook(() => useGen());

    await act(async () => {
      await expect(result.current.generateQuestion()).rejects.toThrow();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
