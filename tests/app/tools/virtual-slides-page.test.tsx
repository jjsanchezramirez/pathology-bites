/**
 * VirtualSlidesPage — characterization tests.
 *
 * Written BEFORE decomposing the 948-line page (extract the error state, logo strip,
 * mode toggle, search/filter card, results table, and no-results section). The data
 * hook + heavy children are mocked; DOM assertions pin the major render states:
 *   - results rows render once loaded
 *   - the error state
 *   - the no-results state
 *   - the Study-mode toggle reveals the question-count config
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const state = vi.hoisted(() => {
  const make = () => ({
    slides: [
      { id: "s1", diagnosis: "Adenocarcinoma" },
      { id: "s2", diagnosis: "Lymphoma" },
    ] as { id: string; diagnosis: string }[],
    isLoading: false,
    error: null as string | null,
    currentPage: 1,
    totalPages: 1,
    totalResults: 2,
    filteredTotal: 2,
    totalSlides: 100,
    repositories: ["MGH"],
    categories: ["Bone"],
    organSystems: ["Skeletal"],
    expandedSearchTerms: [] as string[],
    currentSearchOptions: { limit: 20 },
    searchWithFilters: vi.fn(async () => {}),
    goToPage: vi.fn(),
  });
  return { client: make(), make };
});

vi.mock("@/shared/hooks/use-client-virtual-slides", () => ({
  useClientVirtualSlides: () => state.client,
  getRelatedSlides: () => [],
}));
vi.mock("@/shared/hooks/use-lottie-animation", () => ({
  useLottieAnimation: () => ({ animationData: null }),
}));
vi.mock("@/features/public/tools/virtual-slides/components/slide-row-unified", () => ({
  SlideRowUnified: ({ slide }: { slide: { id: string; diagnosis: string } }) => (
    <tr>
      <td data-testid="slide-row">{slide.diagnosis}</td>
    </tr>
  ),
}));
vi.mock("@/features/public/tools/virtual-slides/components/pagination", () => ({
  Pagination: () => null,
}));
vi.mock("@/features/public/tools/virtual-slides/components/loading-skeleton", () => ({
  LoadingSkeleton: () => null,
}));
vi.mock("@/shared/components/common/slide-viewer-modal", () => ({ SlideViewerModal: () => null }));
vi.mock("@/shared/components/common/public-hero", () => ({
  PublicHero: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@/shared/components/common/join-community-section", () => ({
  JoinCommunitySection: () => null,
}));
vi.mock("@/shared/components/common/content-disclaimer", () => ({ ContentDisclaimer: () => null }));
vi.mock("@/shared/components/common/repository-logos", () => ({ repositoryLogos: [] }));
vi.mock("@/shared/services/r2-storage", () => ({ getR2PublicUrl: (p: string) => `/${p}` }));
vi.mock("@/shared/utils/logging", () => ({
  log: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

import VirtualSlidesPage from "@/app/(public)/tools/virtual-slides/page";

beforeEach(() => {
  vi.clearAllMocks();
  state.client = state.make();
});

describe("VirtualSlidesPage — characterization", () => {
  it("renders the result rows once loaded", async () => {
    render(<VirtualSlidesPage />);
    const rows = await screen.findAllByTestId("slide-row");
    expect(rows.map((r) => r.textContent)).toEqual(["Adenocarcinoma", "Lymphoma"]);
  });

  it("renders the error state when the data hook reports an error", async () => {
    state.client.error = "boom";
    render(<VirtualSlidesPage />);
    expect(await screen.findByText("Failed to Load Virtual Slides")).toBeTruthy();
    expect(screen.getByText("boom")).toBeTruthy();
  });

  it("shows the no-results state when there are no slides", async () => {
    state.client.slides = [];
    state.client.totalResults = 0;
    render(<VirtualSlidesPage />);
    expect(await screen.findByText("No slides found")).toBeTruthy();
  });

  it("reveals the study-mode question config when Study is selected", async () => {
    render(<VirtualSlidesPage />);
    await screen.findAllByTestId("slide-row");

    fireEvent.click(screen.getByRole("button", { name: /Study/ }));
    expect(screen.getByText("Number of Questions")).toBeTruthy();
  });
});
