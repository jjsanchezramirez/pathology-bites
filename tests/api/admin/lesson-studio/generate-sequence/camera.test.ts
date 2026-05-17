// dev/test/lesson-studio/camera.test.ts
import { describe, it, expect } from "vitest";
import {
  maxSafePan,
  clamp,
  featureToCameraPan,
  kenBurnsDriftFor,
  computeCameraKeyframes,
  computeAllCameraKeyframes,
  formatCameraKeyframesForPrompt,
  describeAnnotationForPrompt,
} from "@/app/api/admin/lesson-studio/generate-sequence/camera";
import type { VisionResult } from "@/app/api/admin/lesson-studio/generate-sequence/vision";
import type { ImageInput } from "@/app/api/admin/lesson-studio/generate-sequence/prompt";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeImage(category = "microscopic"): ImageInput {
  return {
    url: "https://example.com/img.jpg",
    title: "Castleman Disease",
    description: "Hyaline vascular variant",
    category,
    magnification: "high",
    width: 1200,
    height: 900,
  };
}

function makeVision(overrides: Partial<VisionResult> = {}): VisionResult {
  return {
    canSeeImage: true,
    featurePosition: { x: 60, y: 40 },
    suggestedLabel: "Hyaline Follicle",
    annotationTool: "circle",
    annotationReason: "Large circular follicle",
    objectPresent: true,
    objectShape: "circular",
    objectSize: "large",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// maxSafePan()
// ---------------------------------------------------------------------------

describe("maxSafePan()", () => {
  it("returns 0 at scale=1.0 (no zoom = no pan)", () => {
    expect(maxSafePan(1.0)).toBeCloseTo(0);
  });

  it("returns ~4.5 at scale=1.1", () => {
    expect(maxSafePan(1.1)).toBeCloseTo((0.1 / 1.1) * 50, 1);
  });

  it("returns ~11.5 at scale=1.3", () => {
    expect(maxSafePan(1.3)).toBeCloseTo((0.3 / 1.3) * 50, 1);
  });

  it("returns 25 at scale=2.0 (50% of viewport)", () => {
    expect(maxSafePan(2.0)).toBeCloseTo(25, 1);
  });

  it("increases monotonically with scale", () => {
    expect(maxSafePan(1.2)).toBeLessThan(maxSafePan(1.4));
    expect(maxSafePan(1.4)).toBeLessThan(maxSafePan(1.6));
  });
});

// ---------------------------------------------------------------------------
// clamp()
// ---------------------------------------------------------------------------

describe("clamp()", () => {
  it("passes through values within range", () => {
    expect(clamp(5, 10)).toBe(5);
    expect(clamp(-5, 10)).toBe(-5);
    expect(clamp(0, 10)).toBe(0);
  });

  it("clamps positive overflow", () => {
    expect(clamp(15, 10)).toBe(10);
  });

  it("clamps negative overflow", () => {
    expect(clamp(-15, 10)).toBe(-10);
  });

  it("clamps to exact limit", () => {
    expect(clamp(10, 10)).toBe(10);
    expect(clamp(-10, 10)).toBe(-10);
  });
});

// ---------------------------------------------------------------------------
// featureToCameraPan()
// ---------------------------------------------------------------------------

describe("featureToCameraPan()", () => {
  it("returns 0 for feature at centre (50)", () => {
    expect(featureToCameraPan(50, 1.3)).toBeCloseTo(0);
  });

  it("returns positive offset for feature right of centre", () => {
    // Feature at x=70 (right of centre) → camera pans right (positive x)
    expect(featureToCameraPan(70, 1.3)).toBeGreaterThan(0);
  });

  it("returns negative offset for feature left of centre", () => {
    // Feature at x=30 (left of centre) → camera pans left (negative x)
    expect(featureToCameraPan(30, 1.3)).toBeLessThan(0);
  });

  it("is clamped to safe pan range", () => {
    // Feature at extreme position (x=100) should not exceed safe pan
    const result = featureToCameraPan(100, 1.3);
    expect(Math.abs(result)).toBeLessThanOrEqual(maxSafePan(1.3) + 0.001);
  });

  it("is symmetric: feature at 70 and 30 give opposite signs", () => {
    const right = featureToCameraPan(70, 1.3);
    const left = featureToCameraPan(30, 1.3);
    expect(right).toBeCloseTo(-left, 5);
  });

  it("produces larger pan for same feature at higher zoom", () => {
    const pan13 = Math.abs(featureToCameraPan(70, 1.3));
    const pan15 = Math.abs(featureToCameraPan(70, 1.5));
    expect(pan15).toBeGreaterThan(pan13);
  });
});

// ---------------------------------------------------------------------------
// kenBurnsDriftFor()
// ---------------------------------------------------------------------------

describe("kenBurnsDriftFor()", () => {
  it("returns a valid anchor with scale > 1", () => {
    const drift = kenBurnsDriftFor(0);
    expect(drift.scale).toBeGreaterThan(1.0);
  });

  it("cycles through different presets for different segment indices", () => {
    const drifts = Array.from({ length: 8 }, (_, i) => kenBurnsDriftFor(i));
    // Not all should be identical
    const unique = new Set(drifts.map((d) => `${d.x},${d.y}`));
    expect(unique.size).toBeGreaterThan(1);
  });

  it("wraps around — index 8 equals index 0", () => {
    const d0 = kenBurnsDriftFor(0);
    const d8 = kenBurnsDriftFor(8);
    expect(d0).toEqual(d8);
  });

  it("pan values stay within safe range for its scale", () => {
    for (let i = 0; i < 8; i++) {
      const d = kenBurnsDriftFor(i);
      expect(Math.abs(d.x)).toBeLessThanOrEqual(maxSafePan(d.scale) + 0.001);
      expect(Math.abs(d.y)).toBeLessThanOrEqual(maxSafePan(d.scale) + 0.001);
    }
  });
});

// ---------------------------------------------------------------------------
// computeCameraKeyframes()
// ---------------------------------------------------------------------------

describe("computeCameraKeyframes()", () => {
  describe("figure / table images", () => {
    it("returns hasTarget=false and no Ken Burns for figure", () => {
      const kf = computeCameraKeyframes(makeImage("figure"), undefined, 0);
      expect(kf.hasTarget).toBe(false);
      expect(kf.kenBurnsDrift).toBeNull();
      expect(kf.wide.x).toBe(0);
      expect(kf.wide.y).toBe(0);
      expect(kf.wide.scale).toBeGreaterThanOrEqual(1);
    });

    it("returns hasTarget=false for table", () => {
      const kf = computeCameraKeyframes(makeImage("table"), undefined, 0);
      expect(kf.hasTarget).toBe(false);
    });
  });

  describe("no vision / can't see image", () => {
    it("returns Ken Burns drift when no vision result", () => {
      const kf = computeCameraKeyframes(makeImage(), undefined, 0);
      expect(kf.hasTarget).toBe(false);
      expect(kf.kenBurnsDrift).not.toBeNull();
    });

    it("returns Ken Burns drift when model couldn't see the image", () => {
      const kf = computeCameraKeyframes(
        makeImage(),
        makeVision({ canSeeImage: false, featurePosition: null }),
        0
      );
      expect(kf.hasTarget).toBe(false);
      expect(kf.kenBurnsDrift).not.toBeNull();
    });

    it("returns Ken Burns drift when tool is none", () => {
      const kf = computeCameraKeyframes(makeImage(), makeVision({ annotationTool: "none" }), 0);
      expect(kf.hasTarget).toBe(false);
      expect(kf.kenBurnsDrift).not.toBeNull();
    });
  });

  describe("with usable vision target", () => {
    it("returns hasTarget=true when feature position and non-none tool available", () => {
      const kf = computeCameraKeyframes(makeImage(), makeVision(), 0);
      expect(kf.hasTarget).toBe(true);
      expect(kf.kenBurnsDrift).toBeNull();
    });

    it("wide anchor is always centred (x=0, y=0) with cover-zoom scale", () => {
      const kf = computeCameraKeyframes(makeImage(), makeVision(), 0);
      expect(kf.wide.x).toBe(0);
      expect(kf.wide.y).toBe(0);
      expect(kf.wide.scale).toBeGreaterThanOrEqual(1);
    });

    it("zoomed anchor has scale > 1", () => {
      const kf = computeCameraKeyframes(makeImage(), makeVision(), 0);
      expect(kf.zoomed.scale).toBeGreaterThan(1.0);
    });

    it("zoomed anchor camera pan is non-zero for off-centre feature", () => {
      // Feature at x=70 (right of centre)
      const kf = computeCameraKeyframes(
        makeImage(),
        makeVision({ featurePosition: { x: 70, y: 50 } }),
        0
      );
      expect(kf.zoomed.x).toBeGreaterThan(0);
    });

    it("zoomed anchor camera pan stays within safe range", () => {
      // Feature at extreme position (x=5, y=95)
      const kf = computeCameraKeyframes(
        makeImage(),
        makeVision({ featurePosition: { x: 5, y: 95 } }),
        0
      );
      expect(Math.abs(kf.zoomed.x)).toBeLessThanOrEqual(maxSafePan(kf.zoomed.scale) + 0.001);
      expect(Math.abs(kf.zoomed.y)).toBeLessThanOrEqual(maxSafePan(kf.zoomed.scale) + 0.001);
    });

    it("zoomed anchor is (0, 0) for feature at exact centre", () => {
      const kf = computeCameraKeyframes(
        makeImage(),
        makeVision({ featurePosition: { x: 50, y: 50 } }),
        0
      );
      expect(kf.zoomed.x).toBeCloseTo(0, 5);
      expect(kf.zoomed.y).toBeCloseTo(0, 5);
    });

    it("zoomInStartTime is positive", () => {
      const kf = computeCameraKeyframes(makeImage(), makeVision(), 0);
      expect(kf.zoomInStartTime).toBeGreaterThan(0);
    });

    it("zoomOutDuration is positive", () => {
      const kf = computeCameraKeyframes(makeImage(), makeVision(), 0);
      expect(kf.zoomOutDuration).toBeGreaterThan(0);
    });
  });

  describe("Ken Burns drift cycling", () => {
    it("different segment indices produce different drift directions", () => {
      const drifts = Array.from({ length: 8 }, (_, i) =>
        computeCameraKeyframes(makeImage(), undefined, i)
      ).map((kf) => kf.kenBurnsDrift);
      const unique = new Set(drifts.map((d) => `${d?.x},${d?.y}`));
      expect(unique.size).toBeGreaterThan(1);
    });
  });
});

// ---------------------------------------------------------------------------
// computeAllCameraKeyframes()
// ---------------------------------------------------------------------------

describe("computeAllCameraKeyframes()", () => {
  it("returns one keyframe set per image", () => {
    const images = [makeImage(), makeImage("figure"), makeImage()];
    const visions = [makeVision(), makeVision(), makeVision({ canSeeImage: false })];
    const results = computeAllCameraKeyframes(images, visions);
    expect(results).toHaveLength(3);
  });

  it("third segment (no vision) gets Ken Burns", () => {
    const images = [makeImage(), makeImage("figure"), makeImage()];
    const visions = [
      makeVision(),
      makeVision(),
      makeVision({ canSeeImage: false, featurePosition: null }),
    ];
    const results = computeAllCameraKeyframes(images, visions);
    expect(results[2].hasTarget).toBe(false);
    expect(results[2].kenBurnsDrift).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// formatCameraKeyframesForPrompt()
// ---------------------------------------------------------------------------

describe("formatCameraKeyframesForPrompt()", () => {
  it("Ken Burns output contains 'Ken Burns' and two keyframe lines", () => {
    const kf = computeCameraKeyframes(makeImage(), undefined, 2);
    const text = formatCameraKeyframesForPrompt(kf, 15);
    expect(text).toContain("Ken Burns");
    expect(text).toContain("t=0:");
    expect(text).toContain("t=15.00:");
  });

  it("zoom-to-feature output contains 5 keyframe lines", () => {
    const kf = computeCameraKeyframes(makeImage(), makeVision(), 0);
    const text = formatCameraKeyframesForPrompt(kf, 20);
    // Should have: t=0, t=zoomInStart, t=zoomInStart+2, t=holdEnd, t=duration
    const lineCount = (text.match(/t=\d/g) ?? []).length;
    expect(lineCount).toBe(5);
  });

  it("figure/table returns model discretion string", () => {
    const kf = computeCameraKeyframes(makeImage("figure"), undefined, 0);
    const text = formatCameraKeyframesForPrompt(kf, 10);
    expect(text).toContain("model discretion");
  });
});

// ---------------------------------------------------------------------------
// describeAnnotationForPrompt()
// ---------------------------------------------------------------------------

describe("describeAnnotationForPrompt()", () => {
  const pos = { x: 60, y: 40 };

  it("none → text overlay only", () => {
    const text = describeAnnotationForPrompt("none", pos, "Label");
    expect(text).toContain("none");
    expect(text).toContain("text overlay only");
  });

  it("null position → text overlay only regardless of tool", () => {
    const text = describeAnnotationForPrompt("circle", null, "Label");
    expect(text).toContain("none");
  });

  it("spotlight includes position and size", () => {
    const text = describeAnnotationForPrompt("spotlight", pos, "Pattern");
    expect(text).toContain("spotlight");
    expect(text).toContain("x=60");
    expect(text).toContain("Pattern");
  });

  it("circle includes position, size, and yellow border", () => {
    const text = describeAnnotationForPrompt("circle", pos, "Follicle");
    expect(text).toContain("circle");
    expect(text).toContain("FFFF00");
    expect(text).toContain("Follicle");
  });

  it("ellipse includes position and label", () => {
    const text = describeAnnotationForPrompt("ellipse", pos, "Gland Pair");
    expect(text).toContain("ellipse");
    expect(text).toContain("Gland Pair");
  });

  it("arrow includes position and yellow color", () => {
    const text = describeAnnotationForPrompt("arrow", pos, "Mitotic Figure");
    expect(text).toContain("arrow");
    expect(text).toContain("FFFF00");
    expect(text).toContain("Mitotic Figure");
  });
});
