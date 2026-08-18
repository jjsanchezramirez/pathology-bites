/**
 * Full screen asks the shell for room, and gives it back.
 *
 * The layout is a toggle inside one page, so unlike a quiz it has no pathname
 * for the shell to detect — it declares itself through ImmersiveModeProvider.
 * If that request is never made the sidebar stays wide and `main` keeps its
 * padding and its own scrollbar, and the "full screen" layout ends up in a
 * ~700px box. If it is never released, navigating away strands the shell with a
 * collapsed sidebar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// Stubbed, not rendered: the generator pulls in OpenSeadragon, which is both
// irrelevant here and heavy enough to exhaust the test worker. What this file
// tests is the page's contract with the shell.
vi.mock("@/features/user/wsi-questions/components/wsi-question-generator", () => ({
  WSIQuestionGenerator: () => <div data-testid="generator" />,
}));

import { ImmersiveModeProvider } from "@/shared/contexts/immersive-mode-context";
import { setWsiLayout, resetWsiLayout } from "@/features/user/wsi-questions/utils/wsi-layout";
import WSIQuestionsPage from "@/app/(dashboard)/dashboard/wsi-questions/page";

beforeEach(() => {
  window.localStorage.clear();
  resetWsiLayout();
});

function renderPage() {
  const setImmersive = vi.fn();
  const view = render(
    <ImmersiveModeProvider value={setImmersive}>
      <WSIQuestionsPage />
    </ImmersiveModeProvider>
  );
  return { ...view, setImmersive };
}

describe("WSI questions page — immersive mode", () => {
  it("does not ask for room in the classic layout", () => {
    const { setImmersive } = renderPage();
    expect(setImmersive).toHaveBeenCalledWith(false);
    expect(setImmersive).not.toHaveBeenCalledWith(true);
    // The heading is part of the classic layout.
    expect(screen.getByText("Slide-Based Questions")).toBeTruthy();
  });

  it("asks for room in full screen, and drops its own heading", () => {
    const { setImmersive } = renderPage();
    setImmersive.mockClear();

    act(() => setWsiLayout("fullscreen"));

    expect(setImmersive).toHaveBeenCalledWith(true);
    expect(screen.queryByText("Slide-Based Questions")).toBeNull();
  });

  it("releases the shell when the page unmounts", () => {
    const { setImmersive, unmount } = renderPage();
    act(() => setWsiLayout("fullscreen"));
    setImmersive.mockClear();

    unmount();

    expect(setImmersive).toHaveBeenCalledWith(false);
  });
});
