// Ankoma parser — image URL helpers.
import { transformAnkiMediaUrl } from "@/shared/utils/r2/r2-url-transformer";

/**
 * Sanitize image filenames in HTML to match R2 storage format
 * Replaces ALL whitespace characters (including Unicode spaces) with underscores in image src attributes
 */
export function sanitizeImageSources(html: string): string {
  if (!html) return html;

  // Match all img tags and replace ALL whitespace in src attributes with underscores
  return html.replace(
    /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
    (match, before, src, after) => {
      // Replace ALL whitespace characters with underscores
      // Includes: regular spaces, non-breaking spaces (U+00A0, U+202F), and other Unicode spaces
      const sanitizedSrc = src.replace(/[\s\u00A0\u2000-\u200B\u202F\uFEFF]/g, "_");
      return `<img${before}src="${sanitizedSrc}"${after}>`;
    }
  );
}

/**
 * Transform image URL to R2 and sanitize whitespace in filename
 */
export function transformToR2Url(imagePath: string): string {
  if (!imagePath) return imagePath;
  // First sanitize whitespace in filename, then transform to R2 URL
  const sanitizedPath = imagePath.replace(/[\s\u00A0\u2000-\u200B\u202F\uFEFF]/g, "_");
  return transformAnkiMediaUrl(sanitizedPath);
}
