// dev/test/lesson-studio/timing.test.ts
import { describe, it, expect } from "vitest";
import {
  tokenise,
  overlapScore,
  buildImageKeywordSets,
  scoreCaptionsAgainstImages,
  findTransitionCaptionIndices,
  computeSegmentTimings,
} from "@/app/api/admin/lesson-studio/generate-sequence/timing";
import type { CaptionChunk } from "@/shared/types/explainer";
import type { ImageInput } from "@/app/api/admin/lesson-studio/generate-sequence/prompt";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeImage(title: string, description: string, category = "microscopic"): ImageInput {
  return {
    url: "https://example.com/img.jpg",
    title,
    description,
    category,
    width: 1200,
    height: 900,
  };
}

function makeCaption(text: string, start: number, end: number): CaptionChunk {
  return { text, start, end };
}

// ---------------------------------------------------------------------------
// tokenise()
// ---------------------------------------------------------------------------

describe("tokenise()", () => {
  it("lowercases and splits on non-alphanumeric boundaries", () => {
    const tokens = tokenise("Hyaline Vascular Type");
    expect(tokens.has("hyaline")).toBe(true);
    expect(tokens.has("vascular")).toBe(true);
  });

  it("removes stopwords", () => {
    const tokens = tokenise("the type of the lesion");
    expect(tokens.has("the")).toBe(false);
    expect(tokens.has("type")).toBe(false); // 'type' is a stopword
    expect(tokens.has("lesion")).toBe(true);
  });

  it("filters tokens shorter than 3 characters", () => {
    const tokens = tokenise("CD is a disease");
    expect(tokens.has("cd")).toBe(false);
    expect(tokens.has("is")).toBe(false);
    expect(tokens.has("disease")).toBe(true);
  });

  it("returns empty set for empty string", () => {
    expect(tokenise("").size).toBe(0);
  });

  it("handles punctuation and mixed separators", () => {
    const tokens = tokenise("Castleman disease — hyaline-vascular, germinal centre");
    expect(tokens.has("castleman")).toBe(true);
    expect(tokens.has("disease")).toBe(true);
    expect(tokens.has("germinal")).toBe(true);
    expect(tokens.has("centre")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// overlapScore()
// ---------------------------------------------------------------------------

describe("overlapScore()", () => {
  it("returns 1.0 for identical sets", () => {
    const a = new Set(["castleman", "hyaline", "vascular"]);
    expect(overlapScore(a, a)).toBe(1);
  });

  it("returns 0 for completely disjoint sets", () => {
    const a = new Set(["castleman", "hyaline"]);
    const b = new Set(["sarcoidosis", "granuloma"]);
    expect(overlapScore(a, b)).toBe(0);
  });

  it("returns 0 for empty sets", () => {
    expect(overlapScore(new Set(), new Set(["foo"]))).toBe(0);
    expect(overlapScore(new Set(["foo"]), new Set())).toBe(0);
  });

  it("partial overlap is between 0 and 1", () => {
    const a = new Set(["castleman", "hyaline", "vascular"]);
    const b = new Set(["hyaline", "vascular", "sarcoidosis"]);
    const score = overlapScore(a, b);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("uses the smaller set as denominator", () => {
    // a has 1 token, b has 10 — the 1 match should score 1.0 not 0.1
    const a = new Set(["hyaline"]);
    const b = new Set([
      "hyaline",
      "alpha",
      "beta",
      "gamma",
      "delta",
      "epsilon",
      "zeta",
      "eta",
      "theta",
      "iota",
    ]);
    expect(overlapScore(a, b)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// buildImageKeywordSets()
// ---------------------------------------------------------------------------

describe("buildImageKeywordSets()", () => {
  it("builds one set per image", () => {
    const images = [
      makeImage("Castleman Disease overview", "General overview of lymph nodes"),
      makeImage("Hyaline Vascular Variant", "Regressed germinal centres with hyalinised vessels"),
    ];
    const sets = buildImageKeywordSets(images);
    expect(sets).toHaveLength(2);
    expect(sets[0].has("castleman")).toBe(true);
    expect(sets[1].has("hyaline")).toBe(true);
    expect(sets[1].has("germinal")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// scoreCaptionsAgainstImages()
// ---------------------------------------------------------------------------

describe("scoreCaptionsAgainstImages()", () => {
  it("produces a matrix of [captionCount][imageCount]", () => {
    const images = [
      makeImage("Castleman overview", "lymph node architecture"),
      makeImage("Hyaline Vascular", "germinal centre hyalinised"),
    ];
    const captions = [
      makeCaption("Castleman disease affects lymph nodes", 0, 3),
      makeCaption("The hyaline vascular type has regressed germinal centres", 3, 6),
    ];
    const kwSets = buildImageKeywordSets(images);
    const scores = scoreCaptionsAgainstImages(captions, kwSets);
    expect(scores).toHaveLength(2); // 2 captions
    expect(scores[0]).toHaveLength(2); // 2 images
  });

  it("scores the matching caption higher against its image", () => {
    const images = [
      makeImage("Castleman overview", "lymph node architecture"),
      makeImage("Hyaline Vascular Variant", "germinal centres hyalinised vessels"),
    ];
    const captions = [
      makeCaption("Castleman disease affects lymph nodes with characteristic architecture", 0, 3),
      makeCaption(
        "The hyaline vascular type has regressed germinal centres with hyalinised vessels",
        3,
        6
      ),
    ];
    const kwSets = buildImageKeywordSets(images);
    const scores = scoreCaptionsAgainstImages(captions, kwSets);

    // Caption 0 should score higher against image 0 than image 1
    expect(scores[0][0]).toBeGreaterThan(scores[0][1]);
    // Caption 1 should score higher against image 1 than image 0
    expect(scores[1][1]).toBeGreaterThan(scores[1][0]);
  });
});

// ---------------------------------------------------------------------------
// computeSegmentTimings()
// ---------------------------------------------------------------------------

describe("computeSegmentTimings()", () => {
  it("returns single segment covering full duration for one image", () => {
    const images = [makeImage("Overview", "Introduction to the topic")];
    const captions = [makeCaption("Introduction", 0, 5)];
    const timings = computeSegmentTimings(images, captions, 30);
    expect(timings).toHaveLength(1);
    expect(timings[0].startTime).toBe(0);
    expect(timings[0].endTime).toBe(30);
  });

  it("returns equal-split timings when no captions provided", () => {
    const images = [
      makeImage("Image A", "description A"),
      makeImage("Image B", "description B"),
      makeImage("Image C", "description C"),
    ];
    const timings = computeSegmentTimings(images, [], 30);
    expect(timings).toHaveLength(3);
    expect(timings[0].startTime).toBe(0);
    expect(timings[2].endTime).toBe(30);
    // Each segment should be roughly equal
    const durations = timings.map((t) => t.endTime - t.startTime);
    expect(Math.abs(durations[0] - 10)).toBeLessThan(0.5);
  });

  it("first segment starts at 0 and last segment ends at totalDuration", () => {
    const images = [
      makeImage("Castleman overview", "lymph node architecture overview"),
      makeImage("Hyaline Vascular", "germinal centres hyalinised vessels regressed"),
    ];
    const captions = [
      makeCaption("Castleman disease is a lymph node disorder", 0, 8),
      makeCaption(
        "The hyaline vascular type has regressed germinal centres with hyalinised vessels",
        8,
        20
      ),
    ];
    const timings = computeSegmentTimings(images, captions, 20);
    expect(timings[0].startTime).toBe(0);
    expect(timings[timings.length - 1].endTime).toBe(20);
  });

  it("produces contiguous segments (no gaps, no overlaps)", () => {
    const images = [
      makeImage("Figure 1", "classification diagram", "figure"),
      makeImage("Hyaline Vascular", "hyalinised germinal centres vessels", "microscopic"),
      makeImage("Plasma Cell Variant", "plasma cells sheets interfollicular", "microscopic"),
    ];
    const captions = [
      makeCaption("Castleman disease can be classified into subtypes", 0, 5),
      makeCaption("The hyaline vascular type has regressed germinal centres", 5, 12),
      makeCaption("The plasma cell variant shows sheets of plasma cells", 12, 20),
    ];
    const timings = computeSegmentTimings(images, captions, 20);
    expect(timings).toHaveLength(3);

    // Contiguous
    for (let i = 0; i < timings.length - 1; i++) {
      expect(timings[i].endTime).toBeCloseTo(timings[i + 1].startTime, 5);
    }
  });

  it("enforces minimum segment duration", () => {
    const images = [
      makeImage("Image A", "long detailed content about castleman disease lymph node"),
      makeImage("Image B", "brief end"),
    ];
    // Give all captions to image A — image B would get 0 seconds without clamping
    const captions = [
      makeCaption("Castleman disease castleman castleman castleman", 0, 29),
      makeCaption("brief", 29, 30),
    ];
    const timings = computeSegmentTimings(images, captions, 30);
    const durationB = timings[1].endTime - timings[1].startTime;
    expect(durationB).toBeGreaterThanOrEqual(3.0);
  });

  it("correctly assigns early captions to first image and late captions to last image", () => {
    const images = [
      makeImage("Diagram overview", "classification subtypes overview diagram figure"),
      makeImage("Microscopic slide", "germinal centres hyalinised vessels microscopic histology"),
    ];
    const totalDuration = 40;
    // Captions are weighted 2 vs 3 toward image 1 in the second half
    const captions = [
      makeCaption("This diagram shows the classification of Castleman disease subtypes", 0, 8),
      makeCaption("Now looking at the microscopic histology of the hyaline vascular type", 8, 18),
      makeCaption("Germinal centres are regressed with hyalinised vessels microscopic", 18, 28),
      makeCaption(
        "This microscopic histology pattern is characteristic of the hyaline vascular variant",
        28,
        40
      ),
    ];
    const timings = computeSegmentTimings(images, captions, totalDuration);

    // Image 1 must start strictly after 0 and end at totalDuration
    expect(timings[1].startTime).toBeGreaterThan(0);
    expect(timings[1].endTime).toBe(totalDuration);
    // Image 0 must end where image 1 starts
    expect(timings[0].endTime).toBeCloseTo(timings[1].startTime, 5);
    // Image 0 should not consume the entire duration
    expect(timings[0].endTime).toBeLessThan(totalDuration);
  });
});

// ---------------------------------------------------------------------------
// findTransitionCaptionIndices()
// ---------------------------------------------------------------------------

describe("findTransitionCaptionIndices()", () => {
  it("returns N-1 transition indices for N images", () => {
    const scores = [
      [0.8, 0.1, 0.0],
      [0.6, 0.2, 0.0],
      [0.1, 0.9, 0.0],
      [0.0, 0.8, 0.1],
      [0.0, 0.1, 0.9],
    ];
    const indices = findTransitionCaptionIndices(scores, 3);
    expect(indices).toHaveLength(2);
  });

  it("transition from image 0 to image 1 is found where right score rises", () => {
    // Caption 0,1: image 0 dominates; Caption 2,3,4: image 1 dominates
    const scores = [
      [0.9, 0.0],
      [0.8, 0.1],
      [0.1, 0.8],
      [0.0, 0.9],
      [0.0, 0.9],
    ];
    const [t01] = findTransitionCaptionIndices(scores, 2);
    // Transition should be somewhere after image 0 dominates and before the end
    // Search window goes up to index 4 for a 2-image, 5-caption sequence
    expect(t01).toBeGreaterThanOrEqual(1);
    expect(t01).toBeLessThanOrEqual(4);
  });
});
