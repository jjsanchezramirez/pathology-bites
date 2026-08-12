/**
 * Background prefetch in the WSI question generator.
 *
 * Questions are consumed one after another, so the ~1-4s generation for
 * question N+1 can be spent while the reader is still on question N. These
 * tests pin the parts that are easy to get subtly wrong: that a prefetch is
 * actually started, that it is *used* rather than regenerated, that a failed
 * prefetch stays invisible, and that switching category cannot serve a slide
 * from the wrong one.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("@/shared/utils/logging", () => ({
  log: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const SLIDES = [
  { id: "s1", category: "Hematopathology", diagnosis: "Follicular lymphoma", slide_url: "u1" },
  { id: "s2", category: "Hematopathology", diagnosis: "Mantle cell lymphoma", slide_url: "u2" },
  { id: "s3", category: "Thoracic pathology", diagnosis: "Adenocarcinoma", slide_url: "u3" },
];

vi.mock("@/shared/hooks/use-client-wsi-data", () => ({
  useClientWSIData: () => ({ wsiData: SLIDES, isLoading: false, error: null }),
  loadClientWSIData: async () => SLIDES,
}));
vi.mock("@/features/user/wsi-questions/utils/wsi-history-tracker", () => ({
  getWSIHistoryTracker: () => ({
    getRecentIds: () => [],
    addToHistory: vi.fn(),
    clearAll: vi.fn(),
    clearCategory: vi.fn(),
    getStats: () => ({}),
  }),
}));

import { useWSIQuestionGenerator } from "@/shared/hooks/use-wsi-question-generator";

const QUESTION = {
  stem: "A 58-year-old woman presents with painless cervical lymphadenopathy.",
  options: [{ id: "a", text: "Follicular lymphoma", is_correct: true, explanation: "Yes." }],
  teaching_point: "BCL2 distinguishes it from reactive follicular hyperplasia.",
  references: [],
};

const fetchMock = vi.fn();

function okResponse(model: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, question: QUESTION, metadata: { model } }),
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("WSI question prefetch", () => {
  it("starts one prefetch after delivering a question", async () => {
    fetchMock.mockResolvedValue(okResponse("gpt-oss-120b"));
    const { result } = renderHook(() => useWSIQuestionGenerator());

    await act(async () => {
      await result.current.generateQuestion();
    });

    // One request served the user; a second is already in flight for next time.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("serves the second question from the prefetch instead of generating again", async () => {
    fetchMock.mockResolvedValue(okResponse("gpt-oss-120b"));
    const { result } = renderHook(() => useWSIQuestionGenerator());

    await act(async () => {
      await result.current.generateQuestion();
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await act(async () => {
      await result.current.generateQuestion();
    });

    // The second question consumed the prefetch (no third request for it) and
    // queued exactly one more. Without prefetch this would be 4.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });

  it("keeps a failed prefetch invisible and still returns a question", async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse("gpt-oss-120b")) // the user's first question
      .mockRejectedValueOnce(new Error("prefetch exploded")) // the prefetch
      .mockResolvedValue(okResponse("llama-3.3-70b-versatile")); // regeneration

    const { result } = renderHook(() => useWSIQuestionGenerator());
    await act(async () => {
      await result.current.generateQuestion();
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    let second: { metadata: { model: string } } | undefined;
    await act(async () => {
      second = (await result.current.generateQuestion()) as never;
    });

    // Fell back to a fresh generation rather than surfacing the prefetch error.
    expect(second!.metadata.model).toBe("llama-3.3-70b-versatile");
    expect(result.current.error).toBeNull();
  });

  it("does not serve a prefetch from a different category", async () => {
    fetchMock.mockResolvedValue(okResponse("gpt-oss-120b"));
    const { result } = renderHook(() => useWSIQuestionGenerator());

    await act(async () => {
      await result.current.generateQuestion("Hematopathology");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const before = fetchMock.mock.calls.length;
    await act(async () => {
      await result.current.generateQuestion("Thoracic pathology");
    });

    // The heme prefetch must not be handed back for a thoracic request: that
    // would show a slide from the category the user just navigated away from.
    // So this needs a fresh generation *plus* a new prefetch — two calls.
    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(before + 2));
  });

  it("reports isGenerating false once the question is returned", async () => {
    fetchMock.mockResolvedValue(okResponse("gpt-oss-120b"));
    const { result } = renderHook(() => useWSIQuestionGenerator());

    await act(async () => {
      await result.current.generateQuestion();
    });

    // The in-flight prefetch must not hold the spinner on.
    await waitFor(() => expect(result.current.isGenerating).toBe(false));
  });
});
