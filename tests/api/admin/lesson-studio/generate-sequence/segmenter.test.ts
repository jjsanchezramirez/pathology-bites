// dev/test/lesson-studio/segmenter.test.ts
import { describe, it, expect } from "vitest";
import {
  parseSegmenterResponse,
  indicesToTimings,
} from "@/app/api/admin/lesson-studio/generate-sequence/segmenter";
import type { CaptionChunk } from "@/shared/types/explainer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCaption(text: string, start: number, end: number): CaptionChunk {
  return { text, start, end };
}

// Castleman disease captions reused from other tests
const CASTLEMAN_CAPTIONS: CaptionChunk[] = [
  makeCaption("Castleman disease is a lymphoproliferative disorder", 0, 5),
  makeCaption("not a true malignancy but it can behave like one", 5, 10),
  makeCaption("It comes in two main flavors unicentric and multicentric", 10, 15),
  makeCaption("Unicentric presents as a single enlarged lymph node", 15, 20),
  makeCaption("Histologically the classic pattern is hyaline vascular type", 20, 25),
  makeCaption("small atretic germinal centers penetrated by a blood vessel", 25, 30),
  makeCaption("the so called lollipop lesion surrounded by concentric rings", 30, 35),
  makeCaption("The plasma cell variant shows hyperplastic germinal centers", 35, 40),
  makeCaption("with sheets of mature polyclonal plasma cells interfollicular", 40, 45),
  makeCaption("A mixed type also exists combining features of both", 45, 50),
];

// ---------------------------------------------------------------------------
// parseSegmenterResponse()
// ---------------------------------------------------------------------------

describe("parseSegmenterResponse()", () => {
  describe("valid responses", () => {
    it("parses a clean JSON array", () => {
      expect(parseSegmenterResponse("[0, 4, 7]", 3, 10)).toEqual([0, 4, 7]);
    });

    it("parses when surrounded by prose", () => {
      const raw = "Here are the transition indices:\n[0, 3, 8]\nHope that helps.";
      expect(parseSegmenterResponse(raw, 3, 10)).toEqual([0, 3, 8]);
    });

    it("parses single-image (trivial case)", () => {
      expect(parseSegmenterResponse("[0]", 1, 5)).toEqual([0]);
    });

    it("accepts float values by rounding them", () => {
      expect(parseSegmenterResponse("[0, 3.7, 7.2]", 3, 10)).toEqual([0, 4, 7]);
    });

    it("accepts string-encoded integers", () => {
      expect(parseSegmenterResponse('["0", "4", "7"]', 3, 10)).toEqual([0, 4, 7]);
    });
  });

  describe("invalid responses — returns null", () => {
    it("returns null when no array found", () => {
      expect(parseSegmenterResponse("no array here", 3, 10)).toBeNull();
    });

    it("returns null when array length mismatches numImages", () => {
      expect(parseSegmenterResponse("[0, 4]", 3, 10)).toBeNull(); // 2 items, expected 3
    });

    it("returns null when first index is not 0", () => {
      expect(parseSegmenterResponse("[2, 4, 7]", 3, 10)).toBeNull();
    });

    it("returns null when indices are not strictly increasing", () => {
      expect(parseSegmenterResponse("[0, 5, 5]", 3, 10)).toBeNull(); // 5 == 5
      expect(parseSegmenterResponse("[0, 6, 4]", 3, 10)).toBeNull(); // 6 > 4
    });

    it("returns null when an index is out of range (>= numCaptions)", () => {
      expect(parseSegmenterResponse("[0, 4, 10]", 3, 10)).toBeNull(); // index 10 invalid for 10 captions
    });

    it("returns null when an index is negative", () => {
      expect(parseSegmenterResponse("[0, -1, 5]", 3, 10)).toBeNull();
    });

    it("returns null for NaN values", () => {
      expect(parseSegmenterResponse("[0, null, 7]", 3, 10)).toBeNull();
    });

    it("returns null for malformed JSON", () => {
      expect(parseSegmenterResponse("[0, 4, 7", 3, 10)).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// indicesToTimings()
// ---------------------------------------------------------------------------

describe("indicesToTimings()", () => {
  it("first segment starts at 0, last ends at totalDuration", () => {
    const timings = indicesToTimings([0, 4, 7], CASTLEMAN_CAPTIONS, 50);
    expect(timings[0].startTime).toBe(0);
    expect(timings[timings.length - 1].endTime).toBe(50);
  });

  it("produces contiguous segments (no gaps, no overlaps)", () => {
    const timings = indicesToTimings([0, 4, 7], CASTLEMAN_CAPTIONS, 50);
    for (let i = 0; i < timings.length - 1; i++) {
      expect(timings[i].endTime).toBeCloseTo(timings[i + 1].startTime, 5);
    }
  });

  it("segment start times match caption start times at the given indices", () => {
    // index 0 → caption 0 starts at 0s; index 4 → caption 4 starts at 20s; index 7 → 35s
    const timings = indicesToTimings([0, 4, 7], CASTLEMAN_CAPTIONS, 50);
    expect(timings[0].startTime).toBe(0);
    expect(timings[1].startTime).toBe(20); // caption[4].start = 20
    expect(timings[2].startTime).toBe(35); // caption[7].start = 35
  });

  it("returns one segment for one image (full duration)", () => {
    const timings = indicesToTimings([0], CASTLEMAN_CAPTIONS, 50);
    expect(timings).toHaveLength(1);
    expect(timings[0].startTime).toBe(0);
    expect(timings[0].endTime).toBe(50);
  });

  it("enforces minimum segment duration of 3s", () => {
    // Give all captions to image 0 — image 1 would get 0s without clamping
    // index 9 is the last caption (start=45s), totalDuration=50s → image 1 gets only 5s ✓
    // But push index to 9 for a near-zero final segment:
    const captions = CASTLEMAN_CAPTIONS.slice(0, 5); // 5 captions, 0–25s
    // Force last image to start at caption 4 (start=20s), totalDuration=21s → raw duration=1s
    const timings = indicesToTimings([0, 4], captions, 21);
    const durationLast = timings[1].endTime - timings[1].startTime;
    expect(durationLast).toBeGreaterThanOrEqual(3.0);
  });

  it("segments sum exactly to totalDuration", () => {
    const timings = indicesToTimings([0, 3, 6, 8], CASTLEMAN_CAPTIONS, 50);
    const total = timings[timings.length - 1].endTime - timings[0].startTime;
    expect(total).toBeCloseTo(50, 5);
  });

  it("handles two images splitting near the middle", () => {
    // index 5 → caption[5].start = 25s, totalDuration = 50s
    const timings = indicesToTimings([0, 5], CASTLEMAN_CAPTIONS, 50);
    expect(timings[0].endTime).toBe(25);
    expect(timings[1].startTime).toBe(25);
    expect(timings[1].endTime).toBe(50);
  });
});
