import type { LibraryImage } from "../types";

/**
 * Extract a display title from a library image.
 * Tries to use the description first (up to 40 chars or first dash),
 * then falls back to filename from URL.
 */
export function getImageTitle(image: LibraryImage): string {
  // Try to extract title from description or URL
  if (image.description) {
    // Take first 40 chars or up to first dash/period
    const shortened = image.description.split(/[–—-]/)[0].trim();
    return shortened.length > 40 ? shortened.substring(0, 40) + "..." : shortened;
  }
  // Fallback to filename from URL
  const filename = image.url.split("/").pop()?.split(".")[0] || "Untitled";
  return filename.substring(0, 40);
}

/**
 * Calculate initial zoom to cover the viewport (16:9 aspect ratio).
 * Returns a zoom value where:
 * - zoom > 1 means we see LESS of the image (zoomed in)
 * - zoom < 1 means we see MORE of the image (zoomed out)
 * - zoom = 1 means no zoom (100%)
 *
 * The calculation ensures the image covers (fills) the 16:9 viewport
 * without any letterboxing or pillarboxing.
 */
export function calculateCoverZoom(image: LibraryImage): number {
  const viewportAspectRatio = 16 / 9; // 1.777...
  const imageAspectRatio = image.width / image.height;

  // Calculate zoom needed to make the image cover (fill) the viewport
  let zoom: number;
  if (imageAspectRatio > viewportAspectRatio) {
    // Image is wider than viewport (e.g., 21:9 vs 16:9)
    // Need to fit by height → zoom IN to crop the sides
    zoom = imageAspectRatio / viewportAspectRatio;
  } else {
    // Image is taller than viewport (e.g., 4:3 vs 16:9)
    // Need to fit by width → zoom IN to crop top/bottom
    zoom = viewportAspectRatio / imageAspectRatio;
  }

  // Clamp between 0.5x and 2x
  return Math.max(0.5, Math.min(zoom, 2));
}
