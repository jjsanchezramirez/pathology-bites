// Pure helpers extracted from interactive-anki-viewer.tsx — card-type detection,
// inline-image HTML building (was duplicated for question + answer), the
// "is there a real back?" check, and next-cloze selection. Unit-tested in
// isolation (see interactive-anki-viewer-utils.test.ts).

import type { AnkiCard } from "@/features/user/anki/types/anki-card";
import {
  extractImagesFromHtml,
  replaceImagePlaceholders,
} from "@/shared/utils/images/html-image-extractor";

/** Strict image-occlusion detection (do NOT infer from the mere presence of <img>). */
export function isImageOcclusionCard(card: AnkiCard): boolean {
  return (
    card.modelName === "Image Occlusion Enhanced+" ||
    card.modelName === "Image Occlusion Enhanced+++" ||
    card.modelName.includes("Image Occlusion Enhanced") ||
    card.tags.some((tag) => tag.toLowerCase().includes("image-occlusion"))
  );
}

/** Multiple-images cards are pre-processed by the parser and rendered as-is. */
export function isMultipleImagesCard(card: AnkiCard): boolean {
  return (
    card.modelName === "Cloze (Multiple Images)" ||
    card.tags.some((tag) => tag === "#multiple-images")
  );
}

interface ExtractedImage {
  src?: string;
  alt?: string;
  width?: string;
  height?: string;
}

/** Build the inline <img> (or placeholder) tag for a single extracted image. */
export function buildInlineImageTag(image: ExtractedImage | undefined, index: number): string {
  if (image && image.src) {
    // Small icons/arrows should stay inline-small; everything else is a block image.
    const hasSmallKeyword =
      image.alt?.toLowerCase().includes("arrow") ||
      image.src?.toLowerCase().includes("arrow") ||
      image.alt?.toLowerCase().includes("icon") ||
      image.src?.toLowerCase().includes("symbol") ||
      image.src?.toLowerCase().includes("emoji");

    const width = image.width ? parseInt(image.width) : null;
    const height = image.height ? parseInt(image.height) : null;
    const isSmallByDimensions = (width !== null && width < 50) || (height !== null && height < 50);

    const filename = image.src.split("/").pop() || "";
    const filenameWithoutExt = filename.replace(/\.[^.]+$/, "");
    const isShortFilename = filenameWithoutExt.length <= 3 && /\.(png|svg|gif)$/i.test(filename);

    const isSmallIcon = hasSmallKeyword || isSmallByDimensions || isShortFilename;
    const className = isSmallIcon ? "inline-image-small" : "inline-image";
    return `<img src="${image.src}" alt="${image.alt || "Image"}" class="${className}" loading="lazy" />`;
  }
  return `<span class="text-muted-foreground text-sm italic">[Image ${index + 1} not available]</span>`;
}

/** Extract images from card HTML and inline them via buildInlineImageTag. */
export function processCardImageHtml(html: string): string {
  const extracted = extractImagesFromHtml(html, true);
  return replaceImagePlaceholders(extracted.cleanHtml, (index) =>
    buildInlineImageTag(extracted.images[index], index)
  );
}

/** True when a Basic card's back has more than a bare citation worth showing. */
export function hasNonCitationAnswer(answer: string | undefined): boolean {
  const ans = answer || "";
  if (!ans.trim()) return false;

  const textContent = ans.replace(/<[^>]*>/g, "").trim();
  if (!textContent) return false;

  const hasMeaningfulSections =
    ans.includes("extra-section") ||
    ans.includes("personal-notes-section") ||
    ans.includes("textbook-section");
  const hasSubstantialContent = textContent.length > 50;
  const hasImages = ans.includes("<img") || ans.includes("[IMAGE_");

  return hasMeaningfulSections || hasSubstantialContent || hasImages;
}

/** Next un-revealed cloze index in numerical order (c1, c2, …); undefined when done. */
export function getNextClozeIndex(
  clozes: { index: number }[],
  revealed: Set<number>
): number | undefined {
  return clozes
    .map((c) => c.index)
    .sort((a, b) => a - b)
    .find((index) => !revealed.has(index));
}
