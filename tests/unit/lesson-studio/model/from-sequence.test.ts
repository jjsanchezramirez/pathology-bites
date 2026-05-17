import { describe, it, expect } from "vitest";
import { lessonToSequence } from "@/app/(admin)/admin/lesson-studio/model/to-sequence";
import { sequenceToLesson, _internal } from "@/app/(admin)/admin/lesson-studio/model/from-sequence";
import type { Lesson, Slide, ImageElement } from "@/app/(admin)/admin/lesson-studio/model/types";
import {
  timing,
  DEFAULT_FRAMING,
  DEFAULT_TRANSITION,
} from "@/app/(admin)/admin/lesson-studio/model/types";

const { recoverTiming } = _internal;

function makeBgElement(url = "https://example.com/img.jpg", duration = 10): ImageElement {
  return {
    id: "image-bg-s1",
    kind: "image",
    imageUrl: url,
    rect: { x: 0, y: 0, w: 100, h: 100, rotation: 0 },
    opacity: 1,
    timing: { start: 0, fadeIn: 0, hold: duration, fadeOut: 0 },
  };
}

function makeSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    id: "s1",
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
    title: "",
    description: "",
    aspectRatio: "16:9",
    audio: null,
    slides,
  };
}

describe("recoverTiming", () => {
  it("recovers canonical 4-point timing", () => {
    // start=1, fadeIn=0.5, hold=1, fadeOut=0.5 → entries at 1(0), 1.5(1), 2.5(1), 3(0)
    const entries = [
      { time: 1, opacity: 0 },
      { time: 1.5, opacity: 1 },
      { time: 2.5, opacity: 1 },
      { time: 3, opacity: 0 },
    ];
    const t = recoverTiming(entries);
    expect(t.start).toBeCloseTo(1);
    expect(t.fadeIn).toBeCloseTo(0.5);
    expect(t.hold).toBeCloseTo(1);
    expect(t.fadeOut).toBeCloseTo(0.5);
  });
});

describe("sequenceToLesson — editorState fast path", () => {
  it("round-trips a lesson losslessly", () => {
    const original = makeLesson([
      makeSlide({
        id: "a",
        duration: 5,
        elements: [
          {
            id: "sh1",
            kind: "shape",
            shape: "circle",
            rect: { x: 40, y: 40, w: 20, h: 20, rotation: 0 },
            stroke: { color: "#f00", width: 3, style: "solid" },
            timing: timing(1, 0.5, 1, 0.5),
          },
        ],
      }),
    ]);
    const seq = lessonToSequence(original)!;
    const restored = sequenceToLesson(seq);
    expect(restored).toEqual(original);
  });
});

describe("sequenceToLesson — fallback path (no editorState)", () => {
  it("reconstructs a shape element from keyframes", () => {
    const lesson = makeLesson([
      makeSlide({
        id: "a",
        duration: 5,
        elements: [
          {
            id: "sh1",
            kind: "shape",
            shape: "rectangle",
            rect: { x: 30, y: 30, w: 40, h: 20, rotation: 0 },
            stroke: { color: "#f00", width: 3, style: "solid" },
            timing: timing(1, 0.5, 1, 0.5),
          },
        ],
      }),
    ]);
    const seq = lessonToSequence(lesson)!;
    // Strip editorState to force fallback path.
    delete seq.editorState;

    const restored = sequenceToLesson(seq);
    expect(restored.slides).toHaveLength(1);
    const el = restored.slides[0].elements.find((e) => e.id === "sh1");
    expect(el).toBeDefined();
    expect(el?.kind).toBe("shape");
    if (el?.kind === "shape") {
      expect(el.shape).toBe("rectangle");
      expect(el.rect.x).toBeCloseTo(30);
      expect(el.rect.y).toBeCloseTo(30);
      expect(el.rect.w).toBeCloseTo(40);
      expect(el.rect.h).toBeCloseTo(20);
      expect(el.timing.start).toBeCloseTo(1);
      expect(el.timing.fadeIn).toBeCloseTo(0.5);
      expect(el.timing.hold).toBeCloseTo(1);
      expect(el.timing.fadeOut).toBeCloseTo(0.5);
    }
  });
});
