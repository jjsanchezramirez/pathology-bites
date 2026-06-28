/**
 * Unit tests for the pure helpers extracted from interactive-anki-viewer.tsx.
 */
import { describe, it, expect } from "vitest";
import {
  isImageOcclusionCard,
  isMultipleImagesCard,
  buildInlineImageTag,
  hasNonCitationAnswer,
  getNextClozeIndex,
} from "@/features/user/anki/components/interactive-anki-viewer-utils";
import type { AnkiCard } from "@/features/user/anki/types/anki-card";

function card(p: Partial<AnkiCard>): AnkiCard {
  return { id: "x", modelName: "Basic", tags: [], question: "", answer: "", ...p } as AnkiCard;
}

describe("isImageOcclusionCard", () => {
  it("detects by model name or tag", () => {
    expect(isImageOcclusionCard(card({ modelName: "Image Occlusion Enhanced+" }))).toBe(true);
    expect(isImageOcclusionCard(card({ tags: ["#image-occlusion"] }))).toBe(true);
    expect(isImageOcclusionCard(card({ modelName: "Basic", tags: ["x"] }))).toBe(false);
  });
});

describe("isMultipleImagesCard", () => {
  it("detects by model name or tag", () => {
    expect(isMultipleImagesCard(card({ modelName: "Cloze (Multiple Images)" }))).toBe(true);
    expect(isMultipleImagesCard(card({ tags: ["#multiple-images"] }))).toBe(true);
    expect(isMultipleImagesCard(card({}))).toBe(false);
  });
});

describe("buildInlineImageTag", () => {
  it("renders a block image for normal images", () => {
    const tag = buildInlineImageTag({ src: "https://x/big-figure.png", alt: "Figure" }, 0);
    expect(tag).toContain('class="inline-image"');
    expect(tag).toContain('src="https://x/big-figure.png"');
  });

  it("renders inline-small for icon keywords, small dims, or short filenames", () => {
    expect(buildInlineImageTag({ src: "x/arrow.png" }, 0)).toContain("inline-image-small");
    expect(buildInlineImageTag({ src: "x/y.png", width: "20" }, 0)).toContain("inline-image-small");
    expect(buildInlineImageTag({ src: "x/BO.png" }, 0)).toContain("inline-image-small");
  });

  it("renders a placeholder when the image is missing", () => {
    expect(buildInlineImageTag(undefined, 2)).toContain("[Image 3 not available]");
  });
});

describe("hasNonCitationAnswer", () => {
  it("is false for empty / tag-only / short answers", () => {
    expect(hasNonCitationAnswer("")).toBe(false);
    expect(hasNonCitationAnswer("<div></div>")).toBe(false);
    expect(hasNonCitationAnswer("<p>Robbins p.42</p>")).toBe(false);
  });

  it("is true for meaningful sections, long text, or (text +) images", () => {
    expect(hasNonCitationAnswer('<div class="extra-section">x</div>')).toBe(true);
    expect(hasNonCitationAnswer("a".repeat(60))).toBe(true);
    // image branch is only reached when there is some text content alongside the <img>
    expect(hasNonCitationAnswer("Fig <img src='x'>")).toBe(true);
  });

  it("returns false for a pure image with no text (empty-text guard short-circuits)", () => {
    expect(hasNonCitationAnswer("<img src='x'>")).toBe(false);
  });
});

describe("getNextClozeIndex", () => {
  it("returns the lowest un-revealed cloze index", () => {
    const clozes = [{ index: 3 }, { index: 1 }, { index: 2 }];
    expect(getNextClozeIndex(clozes, new Set([1]))).toBe(2);
  });

  it("returns undefined when all are revealed", () => {
    expect(getNextClozeIndex([{ index: 1 }], new Set([1]))).toBeUndefined();
  });
});
