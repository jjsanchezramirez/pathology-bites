/**
 * The hand-off from "pending slide" to "the question's slide".
 *
 * The generator shows the slide while the question is still being written, then
 * shows the same slide under the finished question. Two different pieces of
 * state hold it across that boundary — the hook's `pendingSlide` before, the
 * component's `currentQuestion.wsi` after — and they are written by two
 * different owners in two different microtasks:
 *
 *   generateQuestion()  … finally { setPendingSlide(null) }   <- hook, first
 *   await generateQuestion() -> setCurrentQuestion(q)          <- component, second
 *
 * If React commits between them, both are null for one render, the viewer
 * unmounts, and OpenSeadragon is destroyed — the exact tile-reload the single
 * shared viewer exists to prevent, on the first question of a session.
 *
 * The sibling test in wsi-question-generator.test.tsx cannot see this: its hook
 * mock is a plain object, so nothing ever clears `pendingSlide`. This one mocks
 * the hook as a real stateful hook that reproduces the ordering exactly.
 */
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const slide = {
  id: "pp_42",
  slide_url: "https://pathpresenter.net/public/case?token=42",
  tileSourceUrl: "https://pathpresenter.blob.core.windows.net/42.dzi",
  repository: "PathPresenter",
  source_metadata: {},
};

const question = {
  wsi: slide,
  question: {
    stem: "What is the diagnosis?",
    options: [
      { id: "A", text: "Adenocarcinoma", is_correct: true, explanation: "Glands." },
      { id: "B", text: "Lymphoma", is_correct: false, explanation: "No." },
    ],
  },
  metadata: {
    model: "test-model",
    successful_model: "test-model",
    token_usage: { total_tokens: 1 },
    generation_time_ms: 1,
    fallback_attempts: 0,
  },
};

const osd = vi.hoisted(() => ({ mounts: 0 }));
const splitCommit = vi.hoisted(() => ({ on: false }));

// Stable identities: the generator derives its category list in an effect keyed
// on wsiData, so a fresh array every render would loop it forever.
const WSI_DATA = [{ category: "Dermatopathology" }];
const NOOP = () => {};

// A faithful stand-in for the real hook: `pendingSlide` is component state, set
// when the slide is picked and cleared in a `finally` — before the caller's
// continuation runs. The ordering is the whole point of the test, so it is
// reproduced rather than mocked away.
vi.mock("@/shared/hooks/use-wsi-question-generator", () => ({
  useWSIQuestionGenerator: () => {
    const [pendingSlide, setPendingSlide] = React.useState<unknown>(null);
    const [isGenerating, setIsGenerating] = React.useState(false);
    const generateQuestion = React.useCallback(async () => {
      setIsGenerating(true);
      try {
        setPendingSlide(slide); // the slide is chosen first, then written about
        await new Promise((r) => setTimeout(r, 10));
        return question;
      } finally {
        setIsGenerating(false);
        setPendingSlide(null); // "the real question carries its own slide now"
        // Force React to commit the cleared slide before the caller's
        // continuation sets the question — the gap the sticky fallback covers.
        // Without it the two updates batch and the gap never renders, which is
        // true of React today but is not something to depend on.
        if (splitCommit.on) await new Promise((r) => setTimeout(r, 0));
      }
    }, []);
    return {
      generateQuestion,
      startPrefetch: NOOP,
      isGenerating,
      error: null,
      clearError: NOOP,
      isWSIDataLoading: false,
      isReady: true,
      pendingSlide,
      wsiData: WSI_DATA,
    };
  },
}));

vi.mock("@/shared/components/common/self-hosted-osd-viewer", () => ({
  SelfHostedOSDViewer: () => {
    React.useEffect(() => {
      osd.mounts++;
    }, []);
    return <div data-testid="osd-viewer" />;
  },
}));
vi.mock("@/shared/hooks/use-client-virtual-slides", () => ({ useAllVirtualSlides: () => [] }));
vi.mock("@/shared/components/common/fake-selection-highlight", () => ({
  FakeSelectionHighlight: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/shared/components/common/slide-viewer-modal", () => ({ SlideViewerModal: () => null }));
vi.mock("@/shared/utils/logging", () => ({
  log: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/shared/utils/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { WSIQuestionGenerator } from "@/features/user/wsi-questions/components/wsi-question-generator";
import { resetWsiLayout } from "@/features/user/wsi-questions/utils/wsi-layout";

beforeEach(() => {
  osd.mounts = 0;
  splitCommit.on = false;
  window.localStorage.clear();
  resetWsiLayout();
});

describe("WSI slide hand-off", () => {
  it("mounts the viewer exactly once from the first slide through the first question", async () => {
    render(<WSIQuestionGenerator />);

    const during = await screen.findByTestId("osd-viewer");
    expect(osd.mounts).toBe(1);

    expect(await screen.findByText("What is the diagnosis?")).toBeTruthy();
    // Same node and no second construction: the pending → question hand-off
    // never left the tree without a slide.
    expect(screen.getByTestId("osd-viewer")).toBe(during);
    expect(osd.mounts).toBe(1);
  });

  it("survives the clear and the question landing in separate commits", async () => {
    // The same hand-off with the two updates forced into different renders, so
    // `pendingSlide` is null while `currentQuestion` is not yet set. The viewer
    // must not notice.
    splitCommit.on = true;
    render(<WSIQuestionGenerator />);

    const during = await screen.findByTestId("osd-viewer");
    expect(await screen.findByText("What is the diagnosis?")).toBeTruthy();
    expect(screen.getByTestId("osd-viewer")).toBe(during);
    expect(osd.mounts).toBe(1);
  });
});
