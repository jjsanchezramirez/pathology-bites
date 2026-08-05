/**
 * ImageCarousel — full-resolution fullscreen source.
 *
 * The homepage demo question ships a downscaled JPEG inline (472 KiB → 294 KiB
 * for the oncocytoma slide) because `images.unoptimized` is true globally, so
 * whatever we serve is what every visitor downloads at every viewport. The
 * carousel renders at most ~896px wide, so the small file is fine there — but
 * fullscreen is where a pathologist actually inspects the tissue, and it must
 * NOT be stuck with the downscaled copy.
 *
 * These tests pin that split: inline uses `url`, fullscreen uses `fullUrl`, and
 * callers that never set `fullUrl` (every other carousel in the app) keep
 * showing `url` in both places.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/shared/hooks/use-mobile", () => ({
  // Fullscreen is desktop-only (`openModal` no-ops on mobile).
  useMobile: () => false,
}));
vi.mock("@/shared/hooks/use-smart-image-cache", () => ({
  useImageCacheHandler: () => vi.fn(),
}));
vi.mock("@/shared/utils/logging", () => ({
  log: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));
// Render a plain <img> so we can read src without next/image's URL mangling.
vi.mock("@/shared/components/media/offline-aware-image", () => ({
  OfflineAwareImage: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import { ImageCarousel } from "@/shared/components/media/image-carousel";

const SMALL = "https://cdn.example/library/demo-optimized/slide.w1280.jpg";
const FULL = "https://cdn.example/library/slide";

function openFullscreen() {
  // The inline image's wrapper carries the click handler.
  fireEvent.click(screen.getByAltText("Oncocytoma").parentElement!);
}

describe("ImageCarousel — fullUrl", () => {
  it("renders the small file inline", () => {
    render(<ImageCarousel images={[{ url: SMALL, fullUrl: FULL, alt: "Oncocytoma" }]} />);

    expect(screen.getByAltText("Oncocytoma").getAttribute("src")).toBe(SMALL);
  });

  it("swaps to the full-resolution file once fullscreen opens", () => {
    render(<ImageCarousel images={[{ url: SMALL, fullUrl: FULL, alt: "Oncocytoma" }]} />);
    openFullscreen();

    // Inline + modal are both mounted; the modal one must carry the full URL.
    const sources = screen.getAllByAltText("Oncocytoma").map((el) => el.getAttribute("src"));
    expect(sources).toContain(FULL);
  });

  it("falls back to url in fullscreen when no fullUrl is supplied", () => {
    render(<ImageCarousel images={[{ url: SMALL, alt: "Oncocytoma" }]} />);
    openFullscreen();

    const sources = screen.getAllByAltText("Oncocytoma").map((el) => el.getAttribute("src"));
    expect(sources.every((s) => s === SMALL)).toBe(true);
  });
});
