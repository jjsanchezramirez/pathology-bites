import { describe, it, expect } from "vitest";
import {
  parseTranscriptResponse,
  deriveShortTitle,
  fallbackAnalysis,
} from "@/app/api/admin/lesson-studio/generate-lesson/transcript-analysis";
import type { ImageInput } from "@/app/api/admin/lesson-studio/generate-sequence/prompt";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeImage(overrides: Partial<ImageInput> = {}): ImageInput {
  return {
    url: "https://example.com/img.jpg",
    title: "Castleman Disease - Hyaline",
    description: "Hyaline vascular variant",
    category: "microscopic",
    magnification: "high",
    width: 1200,
    height: 900,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseTranscriptResponse
// ---------------------------------------------------------------------------

describe("parseTranscriptResponse", () => {
  const validJSON = JSON.stringify({
    episodeTitle: "Castleman Disease",
    overallTheme: "Overview of Castleman disease variants",
    segments: [
      { text: "This is segment one with several words", topic: "Introduction" },
      { text: "Segment two discusses the hyaline variant", topic: "Hyaline Variant" },
    ],
    suggestedTextSlideInsertions: [
      { afterSegmentIndex: 1, purpose: "summary", suggestedTitle: "Summary" },
    ],
  });

  it("parses valid transcript analysis JSON", () => {
    const result = parseTranscriptResponse(validJSON, 2);
    expect(result).not.toBeNull();
    expect(result!.episodeTitle).toBe("Castleman Disease");
    expect(result!.overallTheme).toBe("Overview of Castleman disease variants");
    expect(result!.segments).toHaveLength(2);
    expect(result!.suggestedTextSlideInsertions).toHaveLength(1);
  });

  it("strips markdown fences", () => {
    const fenced = "```json\n" + validJSON + "\n```";
    const result = parseTranscriptResponse(fenced, 2);
    expect(result).not.toBeNull();
    expect(result!.episodeTitle).toBe("Castleman Disease");
  });

  it("computes wordCount deterministically from segment text", () => {
    const result = parseTranscriptResponse(validJSON, 2);
    expect(result!.segments[0].wordCount).toBe(7); // "This is segment one with several words"
    expect(result!.segments[1].wordCount).toBe(6); // "Segment two discusses the hyaline variant"
  });

  it("returns null when segments array is empty", () => {
    const empty = JSON.stringify({
      episodeTitle: "Test",
      overallTheme: "Theme",
      segments: [],
    });
    expect(parseTranscriptResponse(empty, 2)).toBeNull();
  });

  it("returns null when segments is missing", () => {
    const noSeg = JSON.stringify({ episodeTitle: "Test", overallTheme: "Theme" });
    expect(parseTranscriptResponse(noSeg, 2)).toBeNull();
  });

  it("returns null when overallTheme is missing", () => {
    const noTheme = JSON.stringify({
      episodeTitle: "Test",
      segments: [{ text: "a", topic: "b" }],
    });
    expect(parseTranscriptResponse(noTheme, 2)).toBeNull();
  });

  it("truncates topic to 60 chars", () => {
    const longTopic = "T".repeat(80);
    const data = JSON.stringify({
      episodeTitle: "Test",
      overallTheme: "Theme",
      segments: [{ text: "word", topic: longTopic }],
    });
    const result = parseTranscriptResponse(data, 1);
    expect(result!.segments[0].topic.length).toBeLessThanOrEqual(60);
  });

  it("uses deriveShortTitle when episodeTitle > 40 chars", () => {
    const longTitle = "A Very Long Episode Title That Exceeds Forty Characters Easily";
    const data = JSON.stringify({
      episodeTitle: longTitle,
      overallTheme: "Theme",
      segments: [{ text: "word", topic: "t" }],
    });
    const result = parseTranscriptResponse(data, 1);
    expect(result!.episodeTitle.length).toBeLessThanOrEqual(40);
  });

  it("passes through episodeTitle when <= 40 chars", () => {
    const result = parseTranscriptResponse(validJSON, 2);
    expect(result!.episodeTitle).toBe("Castleman Disease");
  });

  it("defaults suggestedTextSlideInsertions to [] when missing", () => {
    const noInsertions = JSON.stringify({
      episodeTitle: "Test",
      overallTheme: "Theme",
      segments: [{ text: "word", topic: "t" }],
    });
    const result = parseTranscriptResponse(noInsertions, 1);
    expect(result!.suggestedTextSlideInsertions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// deriveShortTitle
// ---------------------------------------------------------------------------

describe("deriveShortTitle", () => {
  it("returns input if <= 4 words", () => {
    expect(deriveShortTitle("Castleman Disease")).toBe("Castleman Disease");
    expect(deriveShortTitle("Acute Inflammation")).toBe("Acute Inflammation");
    expect(deriveShortTitle("One Two Three Four")).toBe("One Two Three Four");
  });

  it("takes text before first comma when > 4 words", () => {
    // Must be > 4 words to trigger punctuation split
    expect(deriveShortTitle("Castleman Disease Overview, Hyaline Variant Details")).toBe(
      "Castleman Disease Overview"
    );
  });

  it("takes text before first dash when > 4 words", () => {
    expect(deriveShortTitle("Castleman Disease Overview - Hyaline Vascular Type")).toBe(
      "Castleman Disease Overview"
    );
  });

  it("takes text before first colon", () => {
    expect(deriveShortTitle("Features: many complex things here")).toBe("Features");
  });

  it("takes first 4 words if no punctuation break works", () => {
    expect(deriveShortTitle("This Is A Very Long Title Without Punctuation")).toBe(
      "This Is A Very"
    );
  });

  it("returns 'Pathology Bite' for empty string", () => {
    expect(deriveShortTitle("")).toBe("Pathology Bite");
  });
});

// ---------------------------------------------------------------------------
// fallbackAnalysis
// ---------------------------------------------------------------------------

describe("fallbackAnalysis", () => {
  const words50 = Array.from({ length: 50 }, (_, i) => `word${i}`).join(" ");

  it("splits transcript evenly across images", () => {
    const images = [makeImage(), makeImage(), makeImage()];
    const result = fallbackAnalysis(words50, images);
    expect(result.segments).toHaveLength(3);
    // First two segments get floor(50/3) = 16 words each
    expect(result.segments[0].wordCount).toBe(16);
    expect(result.segments[1].wordCount).toBe(16);
  });

  it("last segment gets remaining words", () => {
    const images = [makeImage(), makeImage(), makeImage()];
    const result = fallbackAnalysis(words50, images);
    // Last segment gets words from index 32 to 50 = 18 words
    expect(result.segments[2].wordCount).toBe(50 - 16 * 2);
  });

  it("wordCount matches actual word count of text segment", () => {
    const images = [makeImage(), makeImage()];
    const result = fallbackAnalysis(words50, images);
    result.segments.forEach((seg) => {
      const counted = seg.text.split(/\s+/).filter(Boolean).length;
      expect(seg.wordCount).toBe(counted);
    });
  });

  it("derives topic from image title (before first dash/comma)", () => {
    const images = [makeImage({ title: "Castleman Disease - Hyaline" })];
    const result = fallbackAnalysis(words50, images);
    expect(result.segments[0].topic).toBe("Castleman Disease");
  });

  it("uses 'Slide N' as topic fallback when title is empty", () => {
    const images = [makeImage({ title: "" }), makeImage({ title: "" })];
    const result = fallbackAnalysis(words50, images);
    expect(result.segments[0].topic).toBe("Slide 1");
    expect(result.segments[1].topic).toBe("Slide 2");
  });

  it("episodeTitle derived from first image title", () => {
    const images = [makeImage({ title: "Castleman Disease" })];
    const result = fallbackAnalysis(words50, images);
    expect(result.episodeTitle).toBe("Castleman Disease");
  });

  it("suggestedTextSlideInsertions is always empty", () => {
    const images = [makeImage()];
    const result = fallbackAnalysis(words50, images);
    expect(result.suggestedTextSlideInsertions).toEqual([]);
  });
});
