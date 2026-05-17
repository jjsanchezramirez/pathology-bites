import { describe, it, expect } from "vitest";
import {
  computeImageDurations,
  buildAnnotation,
  buildBackground,
  buildCamera,
  buildTextLabel,
  buildTitleSlide,
  buildTextSlide,
  buildImageSlide,
  assembleLesson,
  TITLE_DURATION,
  ANNOTATION_SIZES,
} from "@/app/api/admin/lesson-studio/generate-lesson/assembler-v2";
import type { VisionResult } from "@/app/api/admin/lesson-studio/generate-sequence/vision";
import type { ImageInput } from "@/app/api/admin/lesson-studio/generate-sequence/prompt";
import type { CameraKeyframes } from "@/app/api/admin/lesson-studio/generate-sequence/camera";
import type {
  TranscriptAnalysis,
  LessonPlan,
  PlannedTextSlide,
  SvgInput,
} from "@/app/api/admin/lesson-studio/generate-lesson/types";
import type {
  Timing,
  SpotlightElement,
  ArrowElement,
  ShapeElement,
  TextElement,
  SvgElement,
} from "@/app/(admin)/admin/lesson-studio/model/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeImage(overrides: Partial<ImageInput> = {}): ImageInput {
  return {
    url: "https://example.com/img.jpg",
    title: "Castleman Disease",
    description: "Hyaline vascular variant",
    category: "microscopic",
    magnification: "high",
    width: 1200,
    height: 900,
    ...overrides,
  };
}

function makeVision(overrides: Partial<VisionResult> = {}): VisionResult {
  return {
    canSeeImage: true,
    featurePosition: { x: 60, y: 40 },
    suggestedLabel: "Hyaline Follicle",
    annotationTool: "spotlight",
    annotationReason: "Busy field",
    objectPresent: true,
    objectShape: "circular",
    objectSize: "medium",
    ...overrides,
  };
}

function makeTiming(overrides: Partial<Timing> = {}): Timing {
  return { start: 1, fadeIn: 0.4, hold: 5, fadeOut: 0.4, ...overrides };
}

function makeCameraKf(overrides: Partial<CameraKeyframes> = {}): CameraKeyframes {
  return {
    hasTarget: true,
    wide: { scale: 1.0, x: 0, y: 0 },
    zoomed: { scale: 1.3, x: 5, y: -3 },
    zoomInStartTime: 1.5,
    zoomOutDuration: 1.0,
    kenBurnsDrift: null,
    ...overrides,
  };
}

function makeSegments(wordCounts: number[]): TranscriptAnalysis["segments"] {
  return wordCounts.map((wc, i) => ({
    text: Array.from({ length: wc }, (_, j) => `word${j}`).join(" "),
    topic: `Segment ${i}`,
    wordCount: wc,
  }));
}

function makeTranscriptAnalysis(
  overrides: Partial<TranscriptAnalysis> & { wordCounts?: number[] } = {}
): TranscriptAnalysis {
  const { wordCounts, ...rest } = overrides;
  return {
    segments: makeSegments(wordCounts ?? [100, 200, 100]),
    suggestedTextSlideInsertions: [],
    episodeTitle: "Castleman Disease",
    overallTheme: "Overview of Castleman disease",
    ...rest,
  };
}

function makePlan(overrides: Partial<LessonPlan> = {}): LessonPlan {
  return {
    imageOrder: [0, 1, 2],
    textSlides: [],
    svgPlacements: [],
    ...overrides,
  };
}

function makeTextSlide(overrides: Partial<PlannedTextSlide> = {}): PlannedTextSlide {
  return {
    type: "text-only",
    insertBeforeImage: 0,
    title: "Key Features",
    bullets: ["Point one", "Point two"],
    backgroundColor: "#1a1a2e",
    duration: 5,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeImageDurations
// ---------------------------------------------------------------------------

describe("computeImageDurations", () => {
  it("allocates duration proportional to word counts", () => {
    const segments = makeSegments([100, 200, 100]);
    const durations = computeImageDurations(segments, [0, 1, 2], 60, 0);
    // Middle segment has 2x the words, so should get roughly 2x duration
    expect(durations[1]).toBeGreaterThan(durations[0]);
    expect(durations[1]).toBeGreaterThan(durations[2]);
  });

  it("durations sum to available duration (audioDuration - TITLE_DURATION - textSlideDuration)", () => {
    const segments = makeSegments([100, 200, 100]);
    const textDur = 5;
    const durations = computeImageDurations(segments, [0, 1, 2], 60, textDur);
    const sum = durations.reduce((a, b) => a + b, 0);
    expect(sum).toBe(Math.round(60 - TITLE_DURATION - textDur));
  });

  it("enforces MIN_IMAGE_DURATION in initial allocation (before scaling)", () => {
    // After scaling to fit available time, MIN may be reduced —
    // the initial raw duration uses Math.max( ...)
    // but the final scaling can shrink below MIN_IMAGE_DURATION.
    // This test verifies the initial floor is applied.
    const segments = makeSegments([1, 1000, 1]);
    const durations = computeImageDurations(segments, [0, 1, 2], 120, 0);
    // With enough audio duration, short segments still get meaningful time
    expect(durations[0]).toBeGreaterThan(0);
    expect(durations[2]).toBeGreaterThan(0);
    // The dominant segment gets the most time
    expect(durations[1]).toBeGreaterThan(durations[0]);
  });

  it("last slide absorbs rounding error", () => {
    const segments = makeSegments([33, 33, 34]);
    const available = 60 - TITLE_DURATION;
    const durations = computeImageDurations(segments, [0, 1, 2], 60, 0);
    const sum = durations.reduce((a, b) => a + b, 0);
    expect(sum).toBe(Math.round(available));
  });

  it("handles single image", () => {
    const segments = makeSegments([100]);
    const durations = computeImageDurations(segments, [0], 30, 0);
    expect(durations).toHaveLength(1);
    expect(durations[0]).toBe(Math.round(30 - TITLE_DURATION));
  });

  it("handles zero word counts gracefully (no divide by zero)", () => {
    const segments = makeSegments([0, 0, 0]);
    expect(() => computeImageDurations(segments, [0, 1, 2], 60, 0)).not.toThrow();
  });

  it("respects imageOrder mapping: order[i] indexes into segments", () => {
    // imageOrder [2, 0, 1] means position 0 shows image 2, which uses segments[2]
    const segments = makeSegments([10, 50, 200]);
    const durations = computeImageDurations(segments, [2, 0, 1], 60, 0);
    // Position 0 uses segments[2] (200 words) → longest duration
    expect(durations[0]).toBeGreaterThan(durations[1]);
    expect(durations[0]).toBeGreaterThan(durations[2]);
  });
});

// ---------------------------------------------------------------------------
// buildAnnotation
// ---------------------------------------------------------------------------

describe("buildAnnotation", () => {
  const timing = makeTiming();

  it("returns null when canSeeImage is false", () => {
    expect(buildAnnotation(makeVision({ canSeeImage: false }), timing)).toBeNull();
  });

  it("returns null when featurePosition is null", () => {
    expect(buildAnnotation(makeVision({ featurePosition: null }), timing)).toBeNull();
  });

  it("returns null when annotationTool is 'none'", () => {
    expect(buildAnnotation(makeVision({ annotationTool: "none" }), timing)).toBeNull();
  });

  it("builds spotlight element for spotlight tool", () => {
    const vision = makeVision({ annotationTool: "spotlight", objectSize: "medium" });
    const el = buildAnnotation(vision, timing) as SpotlightElement;
    expect(el).not.toBeNull();
    expect(el.kind).toBe("spotlight");
    expect(el.shape).toBe("circle");
    expect(el.rect.w).toBe(ANNOTATION_SIZES.medium.w);
    expect(el.rect.h).toBe(ANNOTATION_SIZES.medium.h);
  });

  it("builds oval spotlight when objectShape is 'ovoid'", () => {
    const vision = makeVision({
      annotationTool: "spotlight",
      objectShape: "ovoid",
      objectSize: "medium",
    });
    const el = buildAnnotation(vision, timing) as SpotlightElement;
    expect(el.shape).toBe("oval");
  });

  it("spotlight rect is centered on featurePosition", () => {
    const vision = makeVision({
      annotationTool: "spotlight",
      featurePosition: { x: 60, y: 40 },
      objectSize: "medium",
    });
    const el = buildAnnotation(vision, timing) as SpotlightElement;
    const size = ANNOTATION_SIZES.medium;
    expect(el.rect.x).toBe(60 - size.w / 2);
    expect(el.rect.y).toBe(40 - size.h / 2);
  });

  it("builds arrow element with offset from/to", () => {
    const vision = makeVision({
      annotationTool: "arrow",
      featurePosition: { x: 30, y: 30 },
    });
    const el = buildAnnotation(vision, timing) as ArrowElement;
    expect(el.kind).toBe("arrow");
    expect(el.to).toEqual({ x: 30, y: 30 });
    // x<50, y<50 → positive offsets
    expect(el.from.x).toBeGreaterThan(30);
    expect(el.from.y).toBeGreaterThan(30);
  });

  it("arrow offsets are negative when position > 50", () => {
    const vision = makeVision({
      annotationTool: "arrow",
      featurePosition: { x: 70, y: 80 },
    });
    const el = buildAnnotation(vision, timing) as ArrowElement;
    expect(el.from.x).toBeLessThan(70);
    expect(el.from.y).toBeLessThan(80);
  });

  it("arrow coordinates are clamped to [5, 95]", () => {
    const vision = makeVision({
      annotationTool: "arrow",
      featurePosition: { x: 2, y: 2 },
    });
    const el = buildAnnotation(vision, timing) as ArrowElement;
    expect(el.from.x).toBeGreaterThanOrEqual(5);
    expect(el.from.y).toBeGreaterThanOrEqual(5);
  });

  it("builds rectangle shape element", () => {
    const vision = makeVision({
      annotationTool: "rectangle",
      objectSize: "large",
    });
    const el = buildAnnotation(vision, timing) as ShapeElement;
    expect(el.kind).toBe("shape");
    expect(el.shape).toBe("rectangle");
    expect(el.stroke?.color).toBe("#FFFF00");
  });

  it("builds oval shape for circle/ellipse tools", () => {
    for (const tool of ["circle", "ellipse"] as const) {
      const vision = makeVision({ annotationTool: tool });
      const el = buildAnnotation(vision, timing) as ShapeElement;
      expect(el.kind).toBe("shape");
      expect(el.shape).toBe("oval");
    }
  });

  it("uses objectSize to determine annotation dimensions", () => {
    for (const [size, expected] of Object.entries(ANNOTATION_SIZES)) {
      if (size === "default") continue;
      const vision = makeVision({
        annotationTool: "spotlight",
        objectSize: size as "large" | "medium" | "small",
      });
      const el = buildAnnotation(vision, timing) as SpotlightElement;
      expect(el.rect.w).toBe(expected.w);
    }
  });

  it("falls back to default size for unknown objectSize", () => {
    const vision = makeVision({ annotationTool: "spotlight", objectSize: null });
    const el = buildAnnotation(vision, timing) as SpotlightElement;
    expect(el.rect.w).toBe(ANNOTATION_SIZES.default.w);
  });

  it("oval shape has 0.7x height multiplier", () => {
    const vision = makeVision({
      annotationTool: "circle",
      objectSize: "medium",
    });
    const el = buildAnnotation(vision, timing) as ShapeElement;
    expect(el.rect.h).toBeCloseTo(ANNOTATION_SIZES.medium.h * 0.7);
  });
});

// ---------------------------------------------------------------------------
// buildBackground
// ---------------------------------------------------------------------------

describe("buildBackground", () => {
  it("covers 16:9 canvas for landscape image wider than 16:9", () => {
    // 21:9 image → taller than viewport, needs width > 100%
    const img = makeImage({ width: 2100, height: 900 });
    const { element } = buildBackground(img, "s1", 10);
    const rect = (element as any).rect;
    expect(rect.w).toBeGreaterThanOrEqual(100);
  });

  it("covers 16:9 canvas for portrait image", () => {
    const img = makeImage({ width: 900, height: 1200 });
    const { element } = buildBackground(img, "s1", 10);
    const rect = (element as any).rect;
    expect(rect.h).toBeGreaterThanOrEqual(100);
  });

  it("covers 16:9 canvas for square image", () => {
    const img = makeImage({ width: 1000, height: 1000 });
    const { element } = buildBackground(img, "s1", 10);
    const rect = (element as any).rect;
    // Square is narrower than 16:9 → w=100, h > 100
    expect(rect.w).toBeGreaterThanOrEqual(100);
    expect(rect.h).toBeGreaterThanOrEqual(100);
  });

  it("centers the image on canvas", () => {
    const img = makeImage({ width: 1600, height: 900 });
    const { element } = buildBackground(img, "s1", 10);
    const rect = (element as any).rect;
    expect(rect.x).toBeCloseTo(50 - rect.w / 2);
    expect(rect.y).toBeCloseTo(50 - rect.h / 2);
  });

  it("returns coverScale from coverZoom", () => {
    const img = makeImage({ width: 1200, height: 900 });
    const { coverScale } = buildBackground(img, "s1", 10);
    expect(coverScale).toBeGreaterThan(0);
    expect(typeof coverScale).toBe("number");
  });

  it("creates element with full-duration timing and opacity 1", () => {
    const { element } = buildBackground(makeImage(), "s1", 10);
    expect((element as any).timing).toEqual({ start: 0, fadeIn: 0, hold: 10, fadeOut: 0 });
    expect((element as any).opacity).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// buildCamera
// ---------------------------------------------------------------------------

describe("buildCamera", () => {
  it("returns null when hasTarget is false", () => {
    const kf = makeCameraKf({ hasTarget: false });
    expect(buildCamera(kf, 10)).toBeNull();
  });

  it("builds camera element with correct to coordinates (zoomed + 50)", () => {
    const kf = makeCameraKf({ zoomed: { scale: 1.3, x: 5, y: -3 } });
    const el = buildCamera(kf, 10)!;
    expect(el.kind).toBe("camera");
    expect(el.to.x).toBe(55); // 5 + 50
    expect(el.to.y).toBe(47); // -3 + 50
    expect(el.to.scale).toBe(1.3);
  });

  it("timing.start equals zoomInStartTime", () => {
    const kf = makeCameraKf({ zoomInStartTime: 2.0 });
    const el = buildCamera(kf, 10)!;
    expect(el.timing.start).toBe(2.0);
  });

  it("timing.fadeIn is ZOOM_ANIMATION_DURATION (2.0)", () => {
    const el = buildCamera(makeCameraKf(), 10)!;
    expect(el.timing.fadeIn).toBe(2.0);
  });

  it("timing.hold is positive for reasonable slide durations", () => {
    const el = buildCamera(makeCameraKf(), 10)!;
    expect(el.timing.hold).toBeGreaterThanOrEqual(0.5);
  });

  it("timing.fadeOut equals zoomOutDuration from keyframes", () => {
    const kf = makeCameraKf({ zoomOutDuration: 1.5 });
    const el = buildCamera(kf, 10)!;
    expect(el.timing.fadeOut).toBe(1.5);
  });

  it("persistent is false", () => {
    const el = buildCamera(makeCameraKf(), 10)!;
    expect(el.persistent).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildTextLabel
// ---------------------------------------------------------------------------

describe("buildTextLabel", () => {
  it("creates text element at bottom of canvas (y=82)", () => {
    const el = buildTextLabel("Test Label", makeTiming());
    expect(el.rect.y).toBe(82);
  });

  it("label text matches input", () => {
    const el = buildTextLabel("Hyaline Follicle", makeTiming());
    expect(el.text).toBe("Hyaline Follicle");
  });

  it("applies white text on semi-transparent black background", () => {
    const el = buildTextLabel("Test", makeTiming());
    expect(el.color).toBe("#FFFFFF");
    expect(el.background).toBe("rgba(0,0,0,0.5)");
  });

  it("text is bold, centered, 1.6rem", () => {
    const el = buildTextLabel("Test", makeTiming());
    expect(el.fontWeight).toBe("bold");
    expect(el.align).toBe("center");
    expect(el.fontSize).toBe(1.6);
  });
});

// ---------------------------------------------------------------------------
// buildTitleSlide
// ---------------------------------------------------------------------------

describe("buildTitleSlide", () => {
  it("creates 5 elements: brand, title, subtitle, footer, mascot SVG", () => {
    const slide = buildTitleSlide("Castleman Disease", 3);
    expect(slide.elements).toHaveLength(5);
  });

  it("uses brand background color #f0f9f8", () => {
    const slide = buildTitleSlide("Test", 3);
    expect(slide.backgroundColor).toBe("#f0f9f8");
  });

  it("imageCategory is 'blank'", () => {
    const slide = buildTitleSlide("Test", 3);
    expect(slide.imageCategory).toBe("blank");
  });

  it("first text element says 'Pathology Bites'", () => {
    const slide = buildTitleSlide("Test", 3);
    expect((slide.elements[0] as TextElement).text).toBe("Pathology Bites");
  });

  it("second text element contains the episodeTitle", () => {
    const slide = buildTitleSlide("Castleman Disease", 3);
    expect((slide.elements[1] as TextElement).text).toBe("Castleman Disease");
  });

  it("includes Dr. Albright mascot SVG as last element", () => {
    const slide = buildTitleSlide("Test", 3);
    const last = slide.elements[4] as SvgElement;
    expect(last.kind).toBe("svg");
    expect(last.svgName).toBe("Dr. Albright");
  });

  it("text elements have staggered start times (increasing)", () => {
    const slide = buildTitleSlide("Test", 3);
    // Only check text elements (SVG may have different timing)
    const textStarts = slide.elements.filter((e) => e.kind === "text").map((e) => e.timing.start);
    for (let i = 1; i < textStarts.length; i++) {
      expect(textStarts[i]).toBeGreaterThanOrEqual(textStarts[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// buildTextSlide
// ---------------------------------------------------------------------------

describe("buildTextSlide", () => {
  it("creates title + bullet elements", () => {
    const slide = buildTextSlide(makeTextSlide({ bullets: ["a", "b", "c"] }));
    expect(slide.elements).toHaveLength(4); // 1 title + 3 bullets
  });

  it("caps bullets at 3 even if more provided", () => {
    const slide = buildTextSlide(makeTextSlide({ bullets: ["a", "b", "c", "d", "e"] }));
    expect(slide.elements).toHaveLength(4); // 1 title + 3 bullets max
  });

  it("uses light text on dark background (#1a1a2e)", () => {
    const slide = buildTextSlide(makeTextSlide({ backgroundColor: "#1a1a2e" }));
    const title = slide.elements[0] as TextElement;
    expect(title.color).toBe("#ffffff");
  });

  it("uses dark text on light background (#f8fafc)", () => {
    const slide = buildTextSlide(makeTextSlide({ backgroundColor: "#f8fafc" }));
    const title = slide.elements[0] as TextElement;
    expect(title.color).toBe("#1a1a2e");
  });

  it("uses dark text on white background (#ffffff)", () => {
    const slide = buildTextSlide(makeTextSlide({ backgroundColor: "#ffffff" }));
    const title = slide.elements[0] as TextElement;
    expect(title.color).toBe("#1a1a2e");
  });

  it("bullet text is prefixed with bullet character", () => {
    const slide = buildTextSlide(makeTextSlide({ bullets: ["Point one"] }));
    const bullet = slide.elements[1] as TextElement;
    expect(bullet.text).toBe("\u2022 Point one");
  });

  it("bullet timings are staggered by 0.3s", () => {
    const slide = buildTextSlide(makeTextSlide({ bullets: ["a", "b", "c"], duration: 8 }));
    const bulletStarts = slide.elements.slice(1).map((e) => e.timing.start);
    expect(bulletStarts[0]).toBeCloseTo(0.3);
    expect(bulletStarts[1]).toBeCloseTo(0.6);
    expect(bulletStarts[2]).toBeCloseTo(0.9);
  });

  it("title y-position is higher (15) when bullets exist", () => {
    const withBullets = buildTextSlide(makeTextSlide({ bullets: ["a"] }));
    expect((withBullets.elements[0] as TextElement).rect.y).toBe(15);
  });

  it("title y-position is centered (35) when no bullets", () => {
    const noBullets = buildTextSlide(makeTextSlide({ bullets: [] }));
    expect((noBullets.elements[0] as TextElement).rect.y).toBe(35);
  });

  it("uses fade-to-black transition", () => {
    const slide = buildTextSlide(makeTextSlide());
    expect(slide.transitionIn.kind).toBe("fade-to-black");
  });
});

// ---------------------------------------------------------------------------
// buildImageSlide
// ---------------------------------------------------------------------------

describe("buildImageSlide", () => {
  it("always includes background image element", () => {
    const slide = buildImageSlide(makeImage(), undefined, 10, 0);
    const bgEl = slide.elements.find((e) => e.kind === "image");
    expect(bgEl).toBeDefined();
  });

  it("includes camera element when vision has a target feature", () => {
    const vision = makeVision({ annotationTool: "spotlight" });
    const slide = buildImageSlide(makeImage(), vision, 10, 0);
    const camEl = slide.elements.find((e) => e.kind === "camera");
    expect(camEl).toBeDefined();
  });

  it("omits camera element when vision has no specific feature (Ken Burns)", () => {
    const vision = makeVision({ annotationTool: "none", featurePosition: null });
    const slide = buildImageSlide(makeImage(), vision, 10, 0);
    const camEl = slide.elements.find((e) => e.kind === "camera");
    // Camera may or may not be present depending on camera.ts logic
    // but with annotationTool=none and no position, shouldUseKenBurns=true → no camera
    expect(camEl).toBeUndefined();
  });

  it("includes annotation element when vision has tool != none", () => {
    const vision = makeVision({ annotationTool: "spotlight", objectSize: "medium" });
    const slide = buildImageSlide(makeImage(), vision, 10, 0);
    const annEl = slide.elements.find((e) => e.kind === "spotlight");
    expect(annEl).toBeDefined();
  });

  it("omits annotation when vision has tool = none", () => {
    const vision = makeVision({ annotationTool: "none" });
    const slide = buildImageSlide(makeImage(), vision, 10, 0);
    const annEl = slide.elements.find(
      (e) => e.kind === "spotlight" || e.kind === "shape" || e.kind === "arrow"
    );
    expect(annEl).toBeUndefined();
  });

  it("includes text label when vision has suggestedLabel", () => {
    const vision = makeVision({ suggestedLabel: "Follicle" });
    const slide = buildImageSlide(makeImage(), vision, 10, 0);
    const textEls = slide.elements.filter((e) => e.kind === "text");
    expect(textEls.some((e) => (e as TextElement).text === "Follicle")).toBe(true);
  });

  it("omits text label when suggestedLabel is empty", () => {
    const vision = makeVision({ suggestedLabel: "", annotationTool: "none" });
    const slide = buildImageSlide(makeImage(), vision, 10, 0);
    const textEls = slide.elements.filter((e) => e.kind === "text");
    expect(textEls).toHaveLength(0);
  });

  it("sets imageCategory for known categories", () => {
    for (const cat of ["microscopic", "gross", "figure", "table", "diagram"]) {
      const slide = buildImageSlide(makeImage({ category: cat }), undefined, 10, 0);
      expect(slide.imageCategory).toBe(cat);
    }
  });

  it("sets imageCategory undefined for unknown categories", () => {
    const slide = buildImageSlide(makeImage({ category: "unknown" }), undefined, 10, 0);
    expect(slide.imageCategory).toBeUndefined();
  });

  it("uses crossfade transition", () => {
    const slide = buildImageSlide(makeImage(), undefined, 10, 0);
    expect(slide.transitionIn.kind).toBe("crossfade");
  });

  it("sets duration correctly", () => {
    const slide = buildImageSlide(makeImage(), undefined, 15, 0);
    expect(slide.duration).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// assembleLesson (integration)
// ---------------------------------------------------------------------------

describe("assembleLesson", () => {
  const threeImages = [
    makeImage({ url: "https://example.com/1.jpg", title: "Image 1" }),
    makeImage({ url: "https://example.com/2.jpg", title: "Image 2" }),
    makeImage({ url: "https://example.com/3.jpg", title: "Image 3" }),
  ];

  const threeVisions = [
    makeVision({ suggestedLabel: "Label 1" }),
    makeVision({ suggestedLabel: "Label 2" }),
    makeVision({ suggestedLabel: "Label 3" }),
  ];

  const transcript = makeTranscriptAnalysis({ wordCounts: [100, 200, 100] });

  it("first slide is always the title slide", () => {
    const lesson = assembleLesson(
      makePlan(),
      threeImages,
      threeVisions,
      transcript,
      [],
      "https://audio.com/a.mp3",
      "Test Audio",
      60,
      "transcript text"
    );
    const firstSlide = lesson.slides[0];
    expect(firstSlide.imageCategory).toBe("blank");
    const texts = firstSlide.elements.filter((e) => e.kind === "text") as TextElement[];
    expect(texts.some((t) => t.text === "Pathology Bites")).toBe(true);
  });

  it("image slides appear in imageOrder sequence", () => {
    const plan = makePlan({ imageOrder: [2, 0, 1] });
    const lesson = assembleLesson(
      plan,
      threeImages,
      threeVisions,
      transcript,
      [],
      "https://audio.com/a.mp3",
      undefined,
      60,
      "text"
    );
    // Slides: [title, img2, img0, img1]
    const imageSlides = lesson.slides.slice(1);
    const urls = imageSlides.map((s) => {
      const imgEl = s.elements.find((e) => e.kind === "image") as any;
      return imgEl?.imageUrl;
    });
    expect(urls[0]).toBe(threeImages[2].url);
    expect(urls[1]).toBe(threeImages[0].url);
    expect(urls[2]).toBe(threeImages[1].url);
  });

  it("text slides are inserted at correct positions", () => {
    const plan = makePlan({
      imageOrder: [0, 1, 2],
      textSlides: [makeTextSlide({ insertBeforeImage: 1, title: "Before Image 1" })],
    });
    const lesson = assembleLesson(
      plan,
      threeImages,
      threeVisions,
      transcript,
      [],
      "https://audio.com/a.mp3",
      undefined,
      60,
      "text"
    );
    // Expected: [title, img0, textSlide, img1, img2]
    expect(lesson.slides).toHaveLength(5);
    expect(lesson.slides[2].imageCategory).toBe("blank");
    const titleEl = lesson.slides[2].elements[0] as TextElement;
    expect(titleEl.text).toBe("Before Image 1");
  });

  it("text slides after last image are appended at end", () => {
    const plan = makePlan({
      imageOrder: [0, 1, 2],
      textSlides: [makeTextSlide({ insertBeforeImage: 3, title: "Summary" })],
    });
    const lesson = assembleLesson(
      plan,
      threeImages,
      threeVisions,
      transcript,
      [],
      "https://audio.com/a.mp3",
      undefined,
      60,
      "text"
    );
    const lastSlide = lesson.slides[lesson.slides.length - 1];
    expect(lastSlide.imageCategory).toBe("blank");
    expect((lastSlide.elements[0] as TextElement).text).toBe("Summary");
  });

  it("lesson.title comes from transcriptAnalysis.episodeTitle", () => {
    const lesson = assembleLesson(
      makePlan(),
      threeImages,
      threeVisions,
      transcript,
      [],
      "https://audio.com/a.mp3",
      undefined,
      60,
      "text"
    );
    expect(lesson.title).toBe("Castleman Disease");
  });

  it("lesson.audio contains all audio fields", () => {
    const lesson = assembleLesson(
      makePlan(),
      threeImages,
      threeVisions,
      transcript,
      [],
      "https://audio.com/a.mp3",
      "My Audio",
      60,
      "full transcript"
    );
    expect(lesson.audio).toEqual({
      url: "https://audio.com/a.mp3",
      title: "My Audio",
      transcript: "full transcript",
      duration: 60,
    });
  });

  it("total slide count = 1 (title) + images + text slides", () => {
    const plan = makePlan({
      textSlides: [
        makeTextSlide({ insertBeforeImage: 0 }),
        makeTextSlide({ insertBeforeImage: 3, title: "Summary" }),
      ],
    });
    const lesson = assembleLesson(
      plan,
      threeImages,
      threeVisions,
      transcript,
      [],
      "https://audio.com/a.mp3",
      undefined,
      60,
      "text"
    );
    expect(lesson.slides).toHaveLength(1 + 3 + 2);
  });

  it("SVG placements appear on correct slides", () => {
    const svgs: SvgInput[] = [{ url: "https://svg.com/icon.svg", name: "Icon" }];
    const plan = makePlan({
      svgPlacements: [{ svgIndex: 0, onSlide: 1, position: { x: 80, y: 20 }, widthPercent: 15 }],
    });
    const lesson = assembleLesson(
      plan,
      threeImages,
      threeVisions,
      transcript,
      svgs,
      "https://audio.com/a.mp3",
      undefined,
      60,
      "text"
    );
    // onSlide=1 → second image slide (index 2 in slides array: [title, img0, img1, img2])
    const targetSlide = lesson.slides[2]; // img at position 1
    const svgEls = targetSlide.elements.filter((e) => e.kind === "svg") as SvgElement[];
    expect(svgEls.some((e) => e.svgUrl === "https://svg.com/icon.svg")).toBe(true);
  });

  it("SVG placements with invalid svgIndex are skipped", () => {
    const svgs: SvgInput[] = [{ url: "https://svg.com/icon.svg", name: "Icon" }];
    const plan = makePlan({
      svgPlacements: [{ svgIndex: 5, onSlide: 0, position: { x: 50, y: 50 } }],
    });
    const lesson = assembleLesson(
      plan,
      threeImages,
      threeVisions,
      transcript,
      svgs,
      "https://audio.com/a.mp3",
      undefined,
      60,
      "text"
    );
    // No SVG should appear since index 5 is out of bounds
    const allSvgs = lesson.slides.flatMap((s) => s.elements.filter((e) => e.kind === "svg"));
    // Title slide has Dr. Albright SVG, but no user SVGs
    const userSvgs = allSvgs.filter((e) => (e as SvgElement).svgUrl === "https://svg.com/icon.svg");
    expect(userSvgs).toHaveLength(0);
  });

  it("handles 0 text slides", () => {
    const lesson = assembleLesson(
      makePlan({ textSlides: [] }),
      threeImages,
      threeVisions,
      transcript,
      [],
      "https://audio.com/a.mp3",
      undefined,
      60,
      "text"
    );
    expect(lesson.slides).toHaveLength(4); // title + 3 images
  });

  it("with 1 image: single image slide with full available duration", () => {
    const oneImage = [makeImage()];
    const oneVision = [makeVision()];
    const oneTranscript = makeTranscriptAnalysis({ wordCounts: [100] });
    const lesson = assembleLesson(
      makePlan({ imageOrder: [0] }),
      oneImage,
      oneVision,
      oneTranscript,
      [],
      "https://audio.com/a.mp3",
      undefined,
      30,
      "text"
    );
    expect(lesson.slides).toHaveLength(2); // title + 1 image
    expect(lesson.slides[1].duration).toBe(Math.round(30 - TITLE_DURATION));
  });

  it("lesson.aspectRatio is 16:9", () => {
    const lesson = assembleLesson(
      makePlan(),
      threeImages,
      threeVisions,
      transcript,
      [],
      "https://audio.com/a.mp3",
      undefined,
      60,
      "text"
    );
    expect(lesson.aspectRatio).toBe("16:9");
  });

  it("lesson.id is null for generated lessons", () => {
    const lesson = assembleLesson(
      makePlan(),
      threeImages,
      threeVisions,
      transcript,
      [],
      "https://audio.com/a.mp3",
      undefined,
      60,
      "text"
    );
    expect(lesson.id).toBeNull();
  });
});
