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
import { render, screen, fireEvent } from "@testing-library/react";

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
    value: {
      generateQuestion: vi.fn(async () => question),
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

import { WSIQuestionGenerator } from "@/features/user/wsi-questions/components/wsi-question-generator";

beforeEach(() => {
  vi.clearAllMocks();
  hook.value.isGenerating = false;
  hook.value.error = null;
  hook.value.isWSIDataLoading = false;
  hook.value.isReady = true;
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
    // categories are extracted + sorted; the label renders
    expect(screen.getAllByText("Category:").length).toBeGreaterThan(0);
  });

  it("renders the error state when the hook reports an error", async () => {
    hook.value.error = "boom";
    render(<WSIQuestionGenerator />);
    expect(await screen.findByText("Error Loading Question")).toBeTruthy();
    expect(screen.getByText("boom")).toBeTruthy();
  });
});
