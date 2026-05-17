import { describe, it, expect } from "vitest";
import { lessonToSequence, _internal } from "@/app/(admin)/admin/lesson-studio/model/to-sequence";
import type {
  Lesson,
  Slide,
  ShapeElement,
  SpotlightElement,
  ArrowElement,
  TextElement,
  ImageElement,
  CameraElement,
} from "@/app/(admin)/admin/lesson-studio/model/types";
import {
  timing,
  DEFAULT_FRAMING,
  DEFAULT_TRANSITION,
} from "@/app/(admin)/admin/lesson-studio/model/types";

const { opacityAt, collectBreakpoints, baseTransformAt, buildKeyframe } = _internal;

function makeBgElement(url = "https://example.com/img.jpg"): ImageElement {
  return {
    id: "image-bg-slide-1",
    kind: "image",
    imageUrl: url,
    rect: { x: 0, y: 0, w: 100, h: 100, rotation: 0 },
    opacity: 1,
    timing: { start: 0, fadeIn: 0, hold: 10, fadeOut: 0 },
  };
}

function makeSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    id: "slide-1",
    imageCategory: "microscopic",
    imageWidth: 1920,
    imageHeight: 1080,
    duration: 10,
    transitionIn: { ...DEFAULT_TRANSITION },
    initialFraming: { ...DEFAULT_FRAMING },
    elements: [makeBgElement()],
    ...overrides,
  };
}

function makeLesson(slides: Slide[]): Lesson {
  return {
    id: null,
    title: "Test",
    description: "",
    aspectRatio: "16:9",
    audio: null,
    slides,
  };
}

describe("opacityAt", () => {
  it("is 0 before start and after end", () => {
    const t = timing(2, 0.5, 1, 0.5);
    expect(opacityAt(t, 1)).toBe(0);
    expect(opacityAt(t, 4.1)).toBe(0);
  });
  it("ramps linearly during fadeIn", () => {
    const t = timing(0, 1, 0, 0);
    expect(opacityAt(t, 0)).toBe(0);
    expect(opacityAt(t, 0.5)).toBe(0.5);
    expect(opacityAt(t, 1)).toBe(1);
  });
  it("is 1 during hold", () => {
    const t = timing(0, 0.5, 2, 0.5);
    expect(opacityAt(t, 1)).toBe(1);
    expect(opacityAt(t, 2.5)).toBe(1);
  });
  it("ramps down during fadeOut", () => {
    const t = timing(0, 0, 0, 1);
    expect(opacityAt(t, 0)).toBe(1);
    expect(opacityAt(t, 0.5)).toBe(0.5);
    expect(opacityAt(t, 1)).toBe(0);
  });
  it("instant snap when fade=0", () => {
    const t = timing(1, 0, 0, 0);
    expect(opacityAt(t, 1)).toBe(1);
    expect(opacityAt(t, 1.1)).toBe(0);
  });
});

describe("collectBreakpoints", () => {
  it("always includes 0 and slide duration", () => {
    const slide = makeSlide({ duration: 5, elements: [] });
    expect(collectBreakpoints(slide)).toEqual([0, 5]);
  });
  it("adds the 4 phase points of each element, sorted & deduped, clipped", () => {
    const el: ShapeElement = {
      id: "s1",
      kind: "shape",
      shape: "circle",
      rect: { x: 30, y: 30, w: 20, h: 20, rotation: 0 },
      stroke: { color: "#f00", width: 2, style: "solid" },
      timing: timing(1, 0.5, 1, 0.5),
    };
    const slide = makeSlide({ duration: 5, elements: [el] });
    expect(collectBreakpoints(slide)).toEqual([0, 1, 1.5, 2.5, 3, 5]);
  });
  it("drops breakpoints beyond slide duration", () => {
    const el: ShapeElement = {
      id: "s1",
      kind: "shape",
      shape: "circle",
      rect: { x: 30, y: 30, w: 20, h: 20, rotation: 0 },
      stroke: { color: "#f00", width: 2, style: "solid" },
      timing: timing(8, 1, 5, 1),
    };
    const slide = makeSlide({ duration: 10, elements: [el] });
    const bps = collectBreakpoints(slide);
    expect(bps.every((b) => b <= 10)).toBe(true);
    expect(bps).toContain(8);
    expect(bps).toContain(9);
    expect(bps).toContain(10);
  });
});

describe("baseTransformAt", () => {
  it("returns initial framing (converted to -50..50) when no pans have completed", () => {
    const base = baseTransformAt({ x: 50, y: 50, scale: 1.2 }, [], 0);
    expect(base).toEqual({ x: 0, y: 0, scale: 1.2 });
  });
  it("applies completed persistent cameras in order", () => {
    const cam1: CameraElement = {
      id: "p1",
      kind: "camera",
      to: { x: 70, y: 50, scale: 1.5 },
      timing: timing(1, 1, 0, 0),
      persistent: true,
    };
    const cam2: CameraElement = {
      id: "p2",
      kind: "camera",
      to: { x: 30, y: 40, scale: 2 },
      timing: timing(4, 1, 0, 0),
      persistent: true,
    };
    // time=0.5: no pan completed
    expect(baseTransformAt({ x: 50, y: 50, scale: 1 }, [cam1, cam2], 0.5)).toEqual({
      x: 0,
      y: 0,
      scale: 1,
    });
    // time=3: cam1 completed (end=2), cam2 not yet
    expect(baseTransformAt({ x: 50, y: 50, scale: 1 }, [cam1, cam2], 3)).toEqual({
      x: 20, // 70-50
      y: 0,
      scale: 1.5,
    });
    // time=6: both completed
    expect(baseTransformAt({ x: 50, y: 50, scale: 1 }, [cam1, cam2], 6)).toEqual({
      x: -20,
      y: -10,
      scale: 2,
    });
  });
});

describe("buildKeyframe — camera element (non-persistent)", () => {
  const cam: CameraElement = {
    id: "z1",
    kind: "camera",
    to: { x: 50, y: 50, scale: 2 },
    timing: timing(1, 1, 2, 1), // start=1, fadeIn=1, hold=2, fadeOut=1
    persistent: false,
  };
  const slide = makeSlide({ duration: 10, elements: [cam] });

  it("is at base before start", () => {
    const kf = buildKeyframe(slide, 0);
    expect(kf.transform.scale).toBe(1);
  });
  it("interpolates during fadeIn", () => {
    const kf = buildKeyframe(slide, 1.5); // halfway through fadeIn
    expect(kf.transform.scale).toBeCloseTo(1.5);
  });
  it("is at target during hold", () => {
    const kf = buildKeyframe(slide, 3);
    expect(kf.transform.scale).toBe(2);
  });
  it("returns to base during fadeOut", () => {
    const kf = buildKeyframe(slide, 4.5); // halfway through fadeOut (hold ends at 4)
    expect(kf.transform.scale).toBeCloseTo(1.5);
  });
  it("is back at base after fadeOut ends", () => {
    const kf = buildKeyframe(slide, 5);
    expect(kf.transform.scale).toBe(1);
  });
});

describe("buildKeyframe — overlay opacities", () => {
  const shape: ShapeElement = {
    id: "sh1",
    kind: "shape",
    shape: "circle",
    rect: { x: 40, y: 40, w: 20, h: 20, rotation: 0 },
    stroke: { color: "#f00", width: 3, style: "solid" },
    timing: timing(0, 1, 1, 1),
  };
  const spot: SpotlightElement = {
    id: "sp1",
    kind: "spotlight",
    shape: "oval",
    rect: { x: 30, y: 30, w: 30, h: 30, rotation: 0 },
    dimOpacity: 0.6,
    timing: timing(0, 0.5, 2, 0.5),
  };
  const arrow: ArrowElement = {
    id: "a1",
    kind: "arrow",
    from: { x: 10, y: 10 },
    to: { x: 30, y: 30 },
    color: "#fff",
    strokeWidth: 4,
    headSize: 12,
    timing: timing(0, 0, 2, 0),
  };
  const text: TextElement = {
    id: "t1",
    kind: "text",
    text: "hi",
    rect: { x: 20, y: 20, w: 40, h: 10, rotation: 0 },
    fontSize: 2,
    fontWeight: "bold",
    color: "#fff",
    align: "center",
    timing: timing(1, 0.5, 1, 0.5),
  };
  const slide = makeSlide({ duration: 5, elements: [shape, spot, arrow, text] });

  it("emits shape highlight with correct converted center for circle", () => {
    const kf = buildKeyframe(slide, 1); // shape fully visible (end of fadeIn)
    const h = kf.highlights.find((x) => x.id === "sh1")!;
    expect(h.spotlight).toBe(false);
    expect(h.position).toEqual({ x: 50, y: 50 });
    expect(h.opacity).toBe(1);
  });

  it("emits spotlight with spotlight=true", () => {
    const kf = buildKeyframe(slide, 1);
    const sp = kf.highlights.find((x) => x.id === "sp1")!;
    expect(sp.spotlight).toBe(true);
    expect(sp.opacity).toBe(1);
  });

  it("emits arrow with original endpoints", () => {
    const kf = buildKeyframe(slide, 1);
    const a = kf.arrows.find((x) => x.id === "a1")!;
    expect(a.startPosition).toEqual({ x: 10, y: 10 });
    expect(a.endPosition).toEqual({ x: 30, y: 30 });
    expect(a.opacity).toBe(1);
  });

  it("emits text at correct center with fade opacity", () => {
    const kf = buildKeyframe(slide, 1.25); // text fade-in halfway (start=1, fadeIn=0.5)
    const t = kf.textOverlays.find((x) => x.id === "t1")!;
    expect(t.computedOpacity).toBeCloseTo(0.5);
    expect(t.position).toEqual({ x: 40, y: 25 });
  });

  it("excludes overlays with 0 opacity", () => {
    const kf = buildKeyframe(slide, 0); // text hasn't started, arrow has
    expect(kf.textOverlays.find((x) => x.id === "t1")).toBeUndefined();
    expect(kf.arrows.find((x) => x.id === "a1")).toBeDefined();
  });
});

describe("lessonToSequence", () => {
  it("returns null for empty lessons", () => {
    expect(lessonToSequence(makeLesson([]))).toBeNull();
  });

  it("computes cumulative segment times", () => {
    const s1 = makeSlide({ id: "a", duration: 3, elements: [] });
    const s2 = makeSlide({ id: "b", duration: 4, elements: [] });
    const seq = lessonToSequence(makeLesson([s1, s2]))!;
    expect(seq.segments[0].startTime).toBe(0);
    expect(seq.segments[0].endTime).toBe(3);
    expect(seq.segments[1].startTime).toBe(3);
    expect(seq.segments[1].endTime).toBe(7);
    expect(seq.duration).toBe(7);
  });

  it("last segment has cut transition with 0 duration", () => {
    const s1 = makeSlide({ id: "a" });
    const s2 = makeSlide({ id: "b" });
    const seq = lessonToSequence(makeLesson([s1, s2]))!;
    expect(seq.segments[0].transition).toBe("crossfade");
    expect(seq.segments[1].transition).toBe("cut");
    expect(seq.segments[1].transitionDuration).toBe(0);
  });

  it("embeds the lesson in editorState for round-trip", () => {
    const lesson = makeLesson([makeSlide()]);
    const seq = lessonToSequence(lesson)!;
    expect(seq.editorState?.selectedImages?.[0]).toEqual(lesson);
  });

  it("emits blank-slide background color when no image", () => {
    const blank = makeSlide({
      elements: [],
      backgroundColor: "#123456",
    });
    const seq = lessonToSequence(makeLesson([blank]))!;
    expect(seq.segments[0].imageUrl).toBe("");
    expect(seq.segments[0].backgroundColor).toBe("#123456");
  });

  it("adds audioUrl when audio is set", () => {
    const lesson = makeLesson([makeSlide()]);
    lesson.audio = { url: "https://example.com/audio.mp3" };
    const seq = lessonToSequence(lesson)!;
    expect(seq.audioUrl).toBe("https://example.com/audio.mp3");
  });

  it("builds caption chunks when transcript + duration present", () => {
    const lesson = makeLesson([makeSlide()]);
    lesson.audio = {
      url: "https://example.com/a.mp3",
      transcript: "one two three four five six",
      duration: 6,
    };
    const seq = lessonToSequence(lesson)!;
    expect(seq.captions).toBeDefined();
    expect(seq.captions!.length).toBeGreaterThan(0);
  });
});
