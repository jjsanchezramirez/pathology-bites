/**
 * Home page hero — the image gallery that replaced the 3D knowledge graph.
 *
 * The graph asked the browser for WebGL and had no fallback, so a browser
 * without it (managed hospital PCs, remote desktops, some privacy settings)
 * got the site's error screen instead of the home page. These tests pin that
 * the hero renders with no WebGL at all, that phones download no gallery
 * images, and that the gallery only ever asks for the pre-cropped files.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/shared/components/common/virtual-slide-search-teaser", () => ({
  VirtualSlideSearchTeaser: () => <div data-testid="slide-search" />,
}));

import { HeroSection } from "@/shared/components/common/hero-section";
import { HERO_GALLERY_IMAGES } from "@/shared/components/common/hero-gallery-images";

function setViewport(desktop: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: desktop && query.includes("min-width: 1024px"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
}

describe("HeroSection", () => {
  let getContext: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    // A browser with WebGL switched off: every context request fails.
    getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    getContext.mockRestore();
  });

  it("renders the hero without WebGL and never asks for a canvas context", () => {
    setViewport(true);
    render(<HeroSection />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Pathology learning");
    expect(screen.getByTestId("slide-search")).toBeTruthy();
    expect(getContext).not.toHaveBeenCalled();
    expect(document.querySelector("canvas")).toBeNull();
  });

  it("shows 2 to 4 pre-cropped pictures on a desktop, AVIF first with a JPEG fallback", () => {
    setViewport(true);
    render(<HeroSection />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const imgs = Array.from(document.querySelectorAll("picture img"));
    expect(imgs.length).toBeGreaterThanOrEqual(2);
    expect(imgs.length).toBeLessThanOrEqual(4);
    for (const img of imgs) {
      expect(img.getAttribute("src")).toMatch(/^\/images\/hero\/.+-280\.jpg$/);
      expect(img.getAttribute("srcset")).toMatch(/-280\.jpg 1x, \/images\/hero\/.+-560\.jpg 2x$/);
      expect(img.getAttribute("width")).toBe("280");
      expect(img.getAttribute("height")).toBe("220");
      const avif = img.parentElement?.querySelector('source[type="image/avif"]');
      expect(avif?.getAttribute("srcset")).toMatch(
        /-280\.avif 1x, \/images\/hero\/.+-560\.avif 2x$/
      );
    }
    // Only the first picture competes for bandwidth with the page itself.
    const high = imgs.filter((img) => img.getAttribute("fetchpriority") === "high");
    expect(high).toHaveLength(1);
  });

  it("renders no gallery pictures on a phone, so a phone downloads none", () => {
    setViewport(false);
    render(<HeroSection />);
    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(document.querySelectorAll("picture, img")).toHaveLength(0);
  });

  it("points every gallery entry at its own pre-cropped files", () => {
    expect(HERO_GALLERY_IMAGES.length).toBeGreaterThanOrEqual(4);
    const ids = new Set(HERO_GALLERY_IMAGES.map((i) => i.id));
    expect(ids.size).toBe(HERO_GALLERY_IMAGES.length);
    for (const img of HERO_GALLERY_IMAGES) {
      expect(img.alt.length).toBeGreaterThan(0);
      expect(img.avif1x).toMatch(/^\/images\/hero\/.+-280\.avif$/);
      expect(img.avif2x).toMatch(/^\/images\/hero\/.+-560\.avif$/);
      expect(img.jpg1x).toMatch(/^\/images\/hero\/.+-280\.jpg$/);
      expect(img.jpg2x).toMatch(/^\/images\/hero\/.+-560\.jpg$/);
    }
  });
});
