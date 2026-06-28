/**
 * CellCounterPage — characterization tests.
 *
 * Written BEFORE decomposing the 1530-line tool (extract the data/utils/export
 * modules + setup / counting / dialog components). The sync hook + keyboard
 * visualizer are mocked; DOM assertions pin:
 *   - the setup panel + presets render
 *   - starting a count reveals the cell grid
 *   - a keypress increments the matching cell
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

vi.mock("./use-counter-sync", () => ({
  useCounterSync: () => ({
    serverConfig: null,
    isLoadingServer: false,
    isAuthenticated: false,
    saveConfigToServer: vi.fn(),
  }),
}));
vi.mock("@/shared/components/common/keyboard-visualizer", () => ({
  KeyboardVisualizer: () => null,
}));
vi.mock("@/shared/components/common/public-hero", () => ({
  PublicHero: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@/shared/components/common/join-community-section", () => ({
  JoinCommunitySection: () => null,
}));
vi.mock("@/shared/utils/ui/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/shared/utils/logging", () => ({
  log: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

import CellCounterPage from "@/app/(public)/tools/cell-counter/page";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("CellCounterPage — characterization", () => {
  it("renders the setup panel with preset buttons", () => {
    render(<CellCounterPage />);
    expect(screen.getByText("Quick Setup")).toBeTruthy();
    expect(screen.getByRole("button", { name: "100 cells" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "300 cells" })).toBeTruthy();
  });

  it("starts counting and shows the default peripheral-blood cell grid", () => {
    render(<CellCounterPage />);
    fireEvent.click(screen.getByRole("button", { name: "Start Counting" }));
    // default peripheral-blood preset cell types
    expect(screen.getAllByText("Segmented neutrophil").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Undo/ })).toBeTruthy();
  });

  it("increments the matching cell when its key is pressed", () => {
    render(<CellCounterPage />);
    fireEvent.click(screen.getByRole("button", { name: "Start Counting" }));

    // "Segmented neutrophil" is bound to key "k" in the peripheral-blood preset
    fireEvent.keyDown(document, { key: "k" });

    // the grid card is the last "Segmented neutrophil" in the DOM (after the setup list)
    const names = screen.getAllByText("Segmented neutrophil");
    const card = names[names.length - 1].closest(".bg-card") as HTMLElement;
    expect(within(card).getByText("1")).toBeTruthy();
  });
});
