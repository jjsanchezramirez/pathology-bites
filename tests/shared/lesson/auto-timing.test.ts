import { describe, it, expect } from "vitest";
import {
  autoTimeLesson,
  autoTimeSlide,
  lineWindows,
  narratedDuration,
} from "@/shared/lesson/auto-timing";
import type { Lesson, Slide, SlideElement } from "@/shared/lesson/types";

const t0 = { start: 0, fadeIn: 0, hold: 1, fadeOut: 0 };

function shape(id: string, cue?: "build" | "beat"): SlideElement {
  return {
    id,
    kind: "shape",
    shape: "rect",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    timing: { ...t0 },
    ...(cue ? { cue } : {}),
  } as SlideElement;
}

function slide(extra: Partial<Slide> = {}): Slide {
  return {
    id: "s1",
    duration: 5,
    elements: [shape("bg"), shape("a", "build"), shape("b", "beat"), shape("c", "beat")],
    narration: {
      lines: [
        { id: "l1", text: "One two three four five six seven eight nine ten.", elementIds: ["a"] },
        { id: "l2", text: "Eleven twelve thirteen fourteen fifteen.", elementIds: ["b"] },
        { id: "l3", text: "Sixteen seventeen eighteen nineteen twenty.", elementIds: ["c"] },
      ],
    },
    autoDuration: true,
    ...extra,
  } as Slide;
}

describe("lineWindows", () => {
  it("estimates sentences one after another from the lead-in", () => {
    const w = lineWindows(slide());
    expect(w[0].start).toBeCloseTo(0.4);
    expect(w[1].start).toBeCloseTo(w[0].end + 0.35);
    expect(w[2].start).toBeCloseTo(w[1].end + 0.35);
  });

  it("uses recorded times when every sentence has them", () => {
    const s = slide();
    s.narration!.lines = s.narration!.lines.map((l, i) => ({ ...l, start: i * 3, end: i * 3 + 2 }));
    expect(lineWindows(s)).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 5 },
      { start: 6, end: 8 },
    ]);
  });

  it("honours a sentence pinned by hand and shifts the ones after it", () => {
    const s = slide();
    s.narration!.lines[1].at = 10;
    const w = lineWindows(s);
    expect(w[1].start).toBe(10);
    expect(w[2].start).toBeCloseTo(w[1].end + 0.35);
  });
});

describe("autoTimeSlide", () => {
  it("sizes the slide to its narration", () => {
    const s = autoTimeSlide(slide());
    const w = lineWindows(slide());
    expect(s.duration).toBeCloseTo(w[2].end + 0.9);
  });

  it("builds stay to the end, beats leave when the next sentence starts", () => {
    const s = autoTimeSlide(slide());
    const w = lineWindows(s);
    const [, a, b, c] = s.elements;
    const end = (e: SlideElement) =>
      e.timing.start + e.timing.fadeIn + e.timing.hold + e.timing.fadeOut;
    expect(a.timing.start).toBeCloseTo(w[0].start - 0.1);
    expect(end(a)).toBeCloseTo(s.duration);
    expect(b.timing.start).toBeCloseTo(w[1].start - 0.1);
    expect(end(b)).toBeCloseTo(w[2].start - 0.1);
    expect(end(c)).toBeCloseTo(s.duration);
  });

  it("leaves elements without a cue alone", () => {
    const s = autoTimeSlide(slide());
    expect(s.elements[0].timing).toEqual(t0);
  });

  it("returns the same object when nothing changes, so the editor doesn't loop", () => {
    const once = autoTimeSlide(slide());
    expect(autoTimeSlide(once)).toBe(once);
  });

  it("is a no-op for classic slides with no cues and no auto duration", () => {
    const s = slide({ autoDuration: false, elements: [shape("x")] });
    expect(autoTimeSlide(s)).toBe(s);
  });

  it("uses a silent default length with no narration", () => {
    const s = slide({ narration: undefined });
    expect(narratedDuration(s)).toBe(5);
  });
});

describe("autoTimeLesson", () => {
  it("keeps the lesson object when no slide changes", () => {
    const lesson = {
      id: "x",
      title: "t",
      slides: [slide({ autoDuration: false, elements: [shape("x")] })],
    } as unknown as Lesson;
    expect(autoTimeLesson(lesson)).toBe(lesson);
  });
});
