/**
 * WSIQuestionGenerator — characterization tests.
 *
 * Written BEFORE decomposing the 774-line component (extract the pure helpers +
 * skeleton / options / explanation / controls sub-components). The generation hook +
 * viewer/selection children are mocked; DOM assertions pin:
 *   - auto-generating on mount → question stem + sorted A/B/C options render
 *   - answering an option → correct/incorrect marks + the explanation (Teaching Point)
 *   - the error state
 *   - the category filter derived from wsiData
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const hook = vi.hoisted(() => {
  const question = {
    wsi: { id: "mgh_1", slide_url: "https://example.org/slide", source_metadata: {} },
    question: {
      stem: "What is the diagnosis shown in this slide?",
      options: [
        {
          id: "A",
          text: "Adenocarcinoma",
          is_correct: true,
          explanation: "Correct because glands.",
        },
        { id: "B", text: "Lymphoma", is_correct: false, explanation: "No lymphoid cells." },
        { id: "C", text: "Sarcoma", is_correct: false, explanation: "" },
      ],
    },
    metadata: {
      model: "test-model",
      successful_model: "test-model",
      token_usage: { total_tokens: 1234 },
      generation_time_ms: 42,
      fallback_attempts: 0,
    },
  };
  return {
    question,
    value: {
      generateQuestion: vi.fn(async () => question),
      // Changing category or the enabled kinds queues a prefetch for the new scope.
      startPrefetch: vi.fn(),
      isGenerating: false,
      error: null as string | null,
      clearError: vi.fn(),
      isWSIDataLoading: false,
      isReady: true,
      wsiData: [{ category: "Dermatopathology" }, { category: "Cytopathology" }],
    },
  };
});

vi.mock("@/shared/hooks/use-wsi-question-generator", () => ({
  useWSIQuestionGenerator: () => hook.value,
}));
vi.mock("@/shared/hooks/use-client-virtual-slides", () => ({ useAllVirtualSlides: () => [] }));
vi.mock("@/shared/components/common/wsi-viewer", () => ({
  WSIViewer: () => <div data-testid="wsi-viewer" />,
}));
vi.mock("@/shared/components/common/fake-selection-highlight", () => ({
  FakeSelectionHighlight: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/shared/components/common/slide-viewer-modal", () => ({ SlideViewerModal: () => null }));
vi.mock("@/shared/utils/logging", () => ({
  log: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));
const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("@/shared/utils/ui/toast", () => ({ toast: toastMock }));

import { WSIQuestionGenerator } from "@/features/user/wsi-questions/components/wsi-question-generator";
import { resetWsiLayout } from "@/features/user/wsi-questions/utils/wsi-layout";

beforeEach(() => {
  vi.clearAllMocks();
  hook.value.isGenerating = false;
  hook.value.error = null;
  hook.value.isWSIDataLoading = false;
  hook.value.isReady = true;
  // The layout preference persists; without this, a full-screen test leaks into
  // whatever runs after it.
  window.localStorage.clear();
  // The layout preference lives in a module store shared by the page and the
  // generator, so it outlives an unmount — reset it or one case leaks into the next.
  resetWsiLayout();
});

describe("WSIQuestionGenerator — characterization", () => {
  it("auto-generates on mount and renders the stem + sorted options", async () => {
    render(<WSIQuestionGenerator />);

    expect(await screen.findByText("What is the diagnosis shown in this slide?")).toBeTruthy();
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("Adenocarcinoma"),
      expect.stringContaining("Lymphoma"),
      expect.stringContaining("Sarcoma"),
    ]);
  });

  it("answering an option reveals the explanation (Teaching Point)", async () => {
    render(<WSIQuestionGenerator />);
    await screen.findByText("What is the diagnosis shown in this slide?");

    expect(screen.queryByText("Teaching Point")).toBeNull();
    fireEvent.click(screen.getByText("Lymphoma"));

    expect(screen.getByText("Teaching Point")).toBeTruthy();
    expect(screen.getByText("Correct because glands.")).toBeTruthy(); // correct option's explanation
  });

  it("derives the category filter from wsiData", async () => {
    render(<WSIQuestionGenerator />);
    await screen.findByText("What is the diagnosis shown in this slide?");
    // The visible "Category:" label gave way to an accessible name when the bar
    // became one row — the control is what matters, not the word beside it.
    expect(screen.getByRole("combobox", { name: "Category" })).toBeTruthy();
  });

  it("renders the error state when the hook reports an error", async () => {
    hook.value.error = "boom";
    render(<WSIQuestionGenerator />);
    expect(await screen.findByText("Error Loading Question")).toBeTruthy();
    expect(screen.getByText("boom")).toBeTruthy();
  });
});

describe("WSIQuestionGenerator — question kind + layout", () => {
  it("passes the enabled question kinds to the generator", async () => {
    render(<WSIQuestionGenerator />);
    await screen.findByText("What is the diagnosis shown in this slide?");

    // Mount asks for diagnosis only — the default set.
    expect(hook.value.generateQuestion).toHaveBeenCalledWith(undefined, ["diagnosis"]);
  });

  it("toggling a type adds it to the set, and the last one cannot be switched off", async () => {
    render(<WSIQuestionGenerator />);
    await screen.findByText("What is the diagnosis shown in this slide?");

    // Labelled by the full name; the visible text shortens with the viewport.
    const toggle = (name: string) => screen.getByRole("button", { name });

    fireEvent.click(toggle("Immunohistochemistry"));
    expect(toggle("Immunohistochemistry").getAttribute("aria-pressed")).toBe("true");
    expect(toggle("Diagnosis").getAttribute("aria-pressed")).toBe("true");

    // Diagnosis off is fine while IHC is on...
    fireEvent.click(toggle("Diagnosis"));
    expect(toggle("Diagnosis").getAttribute("aria-pressed")).toBe("false");

    // ...but the last one on refuses: an empty set can only generate nothing.
    fireEvent.click(toggle("Immunohistochemistry"));
    expect(toggle("Immunohistochemistry").getAttribute("aria-pressed")).toBe("true");

    expect(JSON.parse(window.localStorage.getItem("wsi-question-kinds") || "[]")).toEqual(["ihc"]);
  });

  it("full-screen layout renders the side-by-side frame and is remembered", async () => {
    const { container } = render(<WSIQuestionGenerator />);
    await screen.findByText("What is the diagnosis shown in this slide?");

    // The frame fills the shell's content area in flow (the header stays put and
    // the sidebar collapses to a rail) — it is not an overlay over the app.
    const frame = () => container.querySelector(".grid.min-h-0.flex-1");

    // Classic is the default: a stacked, centred document column.
    expect(frame()).toBeNull();

    // One bar now, so one switch.
    fireEvent.click(screen.getByRole("switch", { name: "Full screen" }));

    expect(frame()).toBeTruthy();
    // And the switch reads as on, which is the way back out.
    expect(screen.getByRole("switch").getAttribute("data-state")).toBe("checked");
    // Nothing escapes to <body>: an overlay would have covered the shell.
    expect(document.body.querySelector(".fixed.inset-0")).toBeNull();
    expect(window.localStorage.getItem("wsi-question-layout")).toBe("fullscreen");
  });
});

describe("WSIQuestionGenerator — category switching", () => {
  it("generates a question as soon as a category is picked", async () => {
    render(<WSIQuestionGenerator />);
    await screen.findByText("What is the diagnosis shown in this slide?");
    hook.value.generateQuestion.mockClear();

    // Radix's select is not driveable in jsdom, so go through the same callback
    // the picker fires.
    const select = screen.getByRole("combobox", { name: "Category" });
    fireEvent.keyDown(select, { key: "Enter" });
    fireEvent.click(screen.getByText("Cytopathology"));

    // The category the reader JUST picked, not the one in state a render ago.
    expect(hook.value.generateQuestion).toHaveBeenCalledWith("Cytopathology", ["diagnosis"]);
  });

  it("does not refresh when returning to All categories", async () => {
    render(<WSIQuestionGenerator />);
    await screen.findByText("What is the diagnosis shown in this slide?");

    const select = screen.getByRole("combobox", { name: "Category" });
    fireEvent.keyDown(select, { key: "Enter" });
    fireEvent.click(screen.getByText("Cytopathology"));
    hook.value.generateQuestion.mockClear();

    fireEvent.keyDown(select, { key: "Enter" });
    fireEvent.click(screen.getByText("All categories"));

    // "All" is the state you pass through on the way somewhere else; refreshing
    // there would discard the question on screen for nothing.
    expect(hook.value.generateQuestion).not.toHaveBeenCalled();
  });
});

describe("WSIQuestionGenerator — a failed refresh", () => {
  it("keeps the question on screen and reports the failure in a toast", async () => {
    render(<WSIQuestionGenerator />);
    await screen.findByText("What is the diagnosis shown in this slide?");
    toastMock.error.mockClear();

    // Every model rejected, every retry exhausted — while a case is on screen.
    hook.value.error = "All models exhausted. 429 Too Many Requests";
    fireEvent.click(screen.getAllByRole("button", { name: /new question/i })[0]);

    // The question survives: three failed attempts must not clear a case the
    // reader is part-way through.
    expect(screen.getByText("What is the diagnosis shown in this slide?")).toBeTruthy();
    expect(screen.queryByText("Error Loading Question")).toBeNull();
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(String(toastMock.error.mock.calls[0][0])).toMatch(/rate limited/i);
  });

  it("still takes over the view when there is no question to preserve", async () => {
    hook.value.error = "boom";
    render(<WSIQuestionGenerator />);
    expect(await screen.findByText("Error Loading Question")).toBeTruthy();
  });
});

describe("WSIQuestionGenerator — overlapping requests", () => {
  it("disables the category picker while a question is generating", async () => {
    render(<WSIQuestionGenerator />);
    await screen.findByText("What is the diagnosis shown in this slide?");

    expect(screen.getByRole("combobox", { name: "Category" }).getAttribute("data-disabled")).toBe(
      null
    );

    hook.value.isGenerating = true;
    fireEvent.click(screen.getAllByRole("button", { name: /new question/i })[0]);

    // Picking a second category mid-flight starts a second generation, and the
    // slower one used to win — landing the reader on a slide from a category the
    // dropdown no longer showed.
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Category" })).toHaveProperty("disabled", true)
    );
    hook.value.isGenerating = false;
  });

  it("drops the result of a superseded request", async () => {
    // The picker is inert during generation, but a keyboard change or a type
    // toggle can still overlap; the token is what makes stale results harmless.
    render(<WSIQuestionGenerator />);
    await screen.findByText("What is the diagnosis shown in this slide?");

    let resolveStale: ((q: unknown) => void) | undefined;
    hook.value.generateQuestion
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStale = resolve as (q: unknown) => void;
          })
      )
      .mockImplementation(async () => ({
        ...hook.question,
        question: { ...hook.question.question, stem: "SECOND question" },
      }));

    const newQuestion = () =>
      fireEvent.click(screen.getAllByRole("button", { name: /new question/i })[0]);

    newQuestion(); // request A — left pending
    newQuestion(); // request B — supersedes it
    await screen.findByText("SECOND question");

    // A now resolves, and must not overwrite what the reader is looking at.
    resolveStale?.({
      ...hook.question,
      question: { ...hook.question.question, stem: "STALE question" },
    });
    await waitFor(() => expect(screen.queryByText("STALE question")).toBeNull());
    expect(screen.getByText("SECOND question")).toBeTruthy();
  });
});
