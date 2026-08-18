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

const logMock = vi.hoisted(() => ({
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));
vi.mock("@/shared/utils/logging", () => ({ log: logMock }));

// tileSourceUrl is required, not decorative: the generator only draws from slides
// the in-house viewer can actually render.
const SLIDES = [
  {
    id: "s1",
    category: "Hematopathology",
    diagnosis: "Follicular lymphoma",
    slide_url: "u1",
    tileSourceUrl: "https://example.org/s1.dzi",
  },
  {
    id: "s2",
    category: "Hematopathology",
    diagnosis: "Mantle cell lymphoma",
    slide_url: "u2",
    tileSourceUrl: "https://example.org/s2.dzi",
  },
  {
    id: "s3",
    category: "Thoracic pathology",
    diagnosis: "Adenocarcinoma",
    slide_url: "u3",
    tileSourceUrl: "https://example.org/s3.dzi",
    // The only slide recording a phenotype options can be built from, so an IHC
    // request narrows the pool to this category rather than emptying the corpus.
    source_metadata: { immuno_profile: "TTF-1+, napsin A+, CK7+, p40-, CK5/6-" },
  },
  // The 67-of-875 case: PathPresenter never built a pyramid for it, so our
  // viewer has nothing to draw and it must never reach a question.
  { id: "s4", category: "Dermatopathology", diagnosis: "Melanoma", slide_url: "u4" },
];

vi.mock("@/shared/hooks/use-client-wsi-data", () => ({
  useClientWSIData: () => ({ wsiData: SLIDES, isLoading: false, error: null }),
  loadClientWSIData: async () => SLIDES,
}));
const historyMock = vi.hoisted(() => ({
  getRecentIds: vi.fn(() => [] as string[]),
  addToHistory: vi.fn(),
  clearAll: vi.fn(),
  clearCategory: vi.fn(),
  getStats: vi.fn(() => ({})),
}));
vi.mock("@/features/user/wsi-questions/utils/wsi-history-tracker", () => ({
  getWSIHistoryTracker: () => historyMock,
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

describe("WSI question pool", () => {
  it("never draws a slide the in-house viewer cannot render", async () => {
    fetchMock.mockResolvedValue(okResponse("gpt-oss-120b"));
    const { result } = renderHook(() => useWSIQuestionGenerator());

    // Dermatopathology holds exactly one slide, and it has no tile source.
    await expect(result.current.generateQuestion("Dermatopathology")).rejects.toThrow(
      /No slides found for category/i
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("WSI question generation — retry on a different slide", () => {
  it("tries another slide when the model chain rejects every attempt", async () => {
    // The server rejects questions that give themselves away, and on a few cases
    // every model fails the same way. That used to reach the reader as
    // "generation failed"; another slide almost always works.
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Server Error",
        json: async () => ({ error: "Question generation failed. Please try again." }),
      })
      .mockResolvedValue(okResponse("gpt-oss-120b"));

    const { result } = renderHook(() => useWSIQuestionGenerator());
    let question: Awaited<ReturnType<typeof result.current.generateQuestion>> | undefined;
    await act(async () => {
      question = await result.current.generateQuestion();
    });

    expect(question?.question?.stem).toContain("painless cervical lymphadenopathy");
    // Two calls for the question itself (one rejected, one served), and the
    // prefetch that follows it.
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));

    // The retry must be a DIFFERENT slide — repeating the one that just failed
    // every model would fail the same way three times over.
    const bodies = fetchMock.mock.calls
      .slice(0, 2)
      .map((c) => JSON.parse((c[1] as { body: string }).body).wsi.id);
    expect(bodies[0]).not.toBe(bodies[1]);
  });

  it("gives up immediately when the session is dead", async () => {
    // No slide fixes an expired session; retrying only burns calls and delays
    // the message telling the reader to sign in.
    fetchMock.mockResolvedValue({ ok: false, status: 401, statusText: "Unauthorized" });

    const { result } = renderHook(() => useWSIQuestionGenerator());
    await expect(result.current.generateQuestion()).rejects.toThrow(/session has expired/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("WSI question pool — empty for the enabled kinds", () => {
  it("names the toggle to fix, not just the empty category", async () => {
    // The curated haematolymphoid cases record no immunoprofile, so asking for
    // IHC empties the pool before the category is applied. "No slides found for
    // Hematopathology" sends the reader hunting through categories that are all
    // equally empty.
    const { result } = renderHook(() => useWSIQuestionGenerator());

    await expect(result.current.generateQuestion("Hematopathology", ["ihc"])).rejects.toThrow(
      /Switch Diagnosis on/i
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("WSI question prefetch — how failures are reported", () => {
  it("a failed prefetch warns, it does not error", async () => {
    // Nobody is waiting on a prefetch and the next real request generates fresh,
    // so a red console entry misrepresents it — especially since the question the
    // reader actually asked for has usually already succeeded on a retry.
    logMock.error.mockClear();
    logMock.warn.mockClear();
    fetchMock
      .mockResolvedValueOnce(okResponse("gpt-oss-120b")) // the reader's question
      .mockRejectedValue(new Error("all models exhausted")); // its prefetch

    const { result } = renderHook(() => useWSIQuestionGenerator());
    await act(async () => {
      await result.current.generateQuestion();
    });
    await waitFor(() => expect(logMock.warn).toHaveBeenCalled());

    expect(logMock.warn.mock.calls.some(([msg]) => String(msg).includes("Prefetch failed"))).toBe(
      true
    );
    expect(logMock.error).not.toHaveBeenCalled();
  });
});

describe("WSI question history", () => {
  it("records a slide when the question is delivered, not when it is generated", async () => {
    // A prefetch runs ahead of the reader and may be thrown away — if generating
    // wrote history, a slide nobody ever saw would be marked "recently shown"
    // and excluded from later draws.
    historyMock.addToHistory.mockClear();
    fetchMock.mockResolvedValue(okResponse("gpt-oss-120b"));

    const { result } = renderHook(() => useWSIQuestionGenerator());
    await act(async () => {
      await result.current.generateQuestion();
    });

    // One question delivered, one prefetch in flight behind it.
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(historyMock.addToHistory).toHaveBeenCalledTimes(1);
  });

  it("does not record a prefetch that is never consumed", async () => {
    historyMock.addToHistory.mockClear();
    fetchMock.mockResolvedValue(okResponse("gpt-oss-120b"));

    const { result } = renderHook(() => useWSIQuestionGenerator());
    await act(async () => {
      result.current.startPrefetch(undefined, ["diagnosis"]);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(historyMock.addToHistory).not.toHaveBeenCalled();
  });
});
