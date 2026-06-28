/**
 * ABPathContentPage — characterization tests.
 *
 * Written BEFORE decomposing the 1063-line page (extract the filter/stats/category
 * logic + skeleton / controls / stats / item / section / pagination components).
 * The smart-loading hook + PDF generator are mocked; DOM assertions pin:
 *   - the loading skeleton vs the loaded controls
 *   - section + item rendering
 *   - the error state
 *   - the no-results state
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const hook = vi.hoisted(() => {
  const section = {
    type: "ap",
    section: "1",
    title: "Bone & Soft Tissue",
    items: [
      { title: "Osteosarcoma", designation: "C" },
      { title: "Chondrosarcoma", designation: "AR" },
    ],
    subsections: [],
  };
  const make = () => ({
    sections: [section],
    allSections: [section],
    filteredSections: [section],
    metadata: { total_sections: 2, ap_sections: 1, cp_sections: 1 },
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalSections: 2,
      hasNextPage: false,
      hasPrevPage: false,
    },
    isLoading: false,
    error: null as string | null,
    actions: { loadPage: vi.fn() },
    strategy: "full-load",
  });
  return { value: make(), make };
});

vi.mock("@/shared/hooks/use-smart-abpath", () => ({ useSmartABPath: () => hook.value }));
vi.mock("@/features/public/tools/abpath/utils/pdf-generator", () => ({
  ABPathPDFGenerator: class {
    generatePDF = vi.fn();
  },
}));
vi.mock("@/shared/components/common/public-hero", () => ({
  PublicHero: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@/shared/components/common/join-community-section", () => ({
  JoinCommunitySection: () => null,
}));
vi.mock("@/shared/utils/logging", () => ({
  log: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

import ABPathContentPage from "@/app/(public)/tools/abpath/page";

beforeEach(() => {
  vi.clearAllMocks();
  hook.value = hook.make();
});

describe("ABPathContentPage — characterization", () => {
  it("renders the loading skeleton (no controls) while loading", () => {
    hook.value.isLoading = true;
    render(<ABPathContentPage />);
    expect(screen.queryByPlaceholderText("Search topics...")).toBeNull();
  });

  it("renders the controls, section header, and items once loaded", () => {
    render(<ABPathContentPage />);
    expect(screen.getByPlaceholderText("Search topics...")).toBeTruthy();
    expect(screen.getByText("AP 1")).toBeTruthy();
    expect(screen.getByText("Bone & Soft Tissue")).toBeTruthy();
    expect(screen.getByText("Osteosarcoma")).toBeTruthy();
    expect(screen.getByText("Chondrosarcoma")).toBeTruthy();
  });

  it("renders the error state when the hook errors", () => {
    hook.value.error = "boom";
    render(<ABPathContentPage />);
    expect(screen.getByText(/Error loading content specifications: boom/)).toBeTruthy();
  });

  it("shows the no-results state when no sections are on the page", () => {
    hook.value.sections = [];
    render(<ABPathContentPage />);
    expect(screen.getByText("No results found matching your criteria.")).toBeTruthy();
  });
});
