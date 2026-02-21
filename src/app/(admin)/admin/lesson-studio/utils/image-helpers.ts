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
    // Remove trailing punctuation and quotes
    const cleaned = shortened.replace(/[.,;:!?"']+$/, "");
    return cleaned.length > 40 ? cleaned.substring(0, 40) + "..." : cleaned;
  }
  // Fallback to filename from URL
  const filename = image.url.split("/").pop()?.split(".")[0] || "Untitled";
  return filename.substring(0, 40);
}

/**
 * Convert UI coordinate (0-100 range) to CSS transform coordinate (-50 to 50 range).
 * UI coordinates: 0 = left/top edge, 50 = center, 100 = right/bottom edge
 * Transform coordinates: -50 = left/top edge, 0 = center, 50 = right/bottom edge
 */
export function uiToTransform(uiValue: number): number {
  return uiValue - 50;
}

/**
 * Convert CSS transform coordinate (-50 to 50 range) to UI coordinate (0-100 range).
 * Transform coordinates: -50 = left/top edge, 0 = center, 50 = right/bottom edge
 * UI coordinates: 0 = left/top edge, 50 = center, 100 = right/bottom edge
 */
export function transformToUI(transformValue: number): number {
  return transformValue + 50;
}

/**
 * Calculate zoom to cover the viewport (16:9 aspect ratio) with no black spaces.
 * Returns a zoom value where:
 * - zoom > 1 means we see LESS of the image (zoomed in)
 * - zoom < 1 means we see MORE of the image (zoomed out)
 * - zoom = 1 means no zoom (100%)
 *
 * The calculation ensures the image covers (fills) the 16:9 viewport
 * without any letterboxing or pillarboxing (no black spaces).
 * Result is rounded UP to 2 decimal places (e.g., 1.159786 → 1.16).
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

  // Clamp between 0.5x and 2x, then round UP to 2 decimal places
  const clamped = Math.max(0.5, Math.min(zoom, 2));
  return Math.ceil(clamped * 100) / 100;
}
