import { describe, it, expect } from "vitest";
import { evaluate, scaleAt } from "@/shared/lesson/evaluate";
import {
  timing,
  DEFAULT_FRAMING,
  DEFAULT_TRANSITION,
  type Lesson,
  type Slide,
  type ShapeElement,
  type CameraElement,
  type ImageElement,
} from "@/shared/lesson/types";

function slide(elements: Slide["elements"], over: Partial<Slide> = {}): Slide {
  return {
    id: "s1",
    duration: 5,
    transitionIn: { ...DEFAULT_TRANSITION },
    initialFraming: { ...DEFAULT_FRAMING },
    elements,
    ...over,
  };
}

function lesson(slides: Slide[]): Lesson {
  return {
    id: null,
    title: "t",
    description: "",
    aspectRatio: "16:9",
    audio: null,
    slides,
  };
}

const shape: ShapeElement = {
  id: "sh",
  kind: "shape",
  shape: "rectangle",
  rect: { x: 10, y: 20, w: 30, h: 40, rotation: 0 },
  stroke: { color: "#f00", width: 2, style: "solid" },
  timing: timing(0, 1, 2, 1),
};

describe("evaluate — overlays", () => {
  it("returns an empty frame for a lesson with no slides", () => {
    const f = evaluate(lesson([]), 0);
    expect(f.currentSlide).toBeNull();
    expect(f.highlights).toHaveLength(0);
  });

  it("emits a highlight from a shape element at hold time", () => {
    const f = evaluate(lesson([slide([shape])]), 2);
    expect(f.highlights).toHaveLength(1);
    const h = f.highlights[0];
    expect(h.id).toBe("sh");
    expect(h.position).toEqual({ x: 25, y: 40 }); // center of the rect
    expect(h.opacity).toBeCloseTo(1);
    expect(h.computedScale).toBeCloseTo(1); // held → no pop
  });

  it("pops the overlay in during fade-in (computedScale != 1)", () => {
    const f = evaluate(lesson([slide([shape])]), 0.5); // mid fade-in
    const h = f.highlights[0];
    expect(h.opacity).toBeGreaterThan(0);
    expect(h.opacity).toBeLessThan(1);
    expect(h.computedScale).not.toBeCloseTo(1);
  });

  it("excludes the background image element from overlays and resolves imageUrl", () => {
    const bg: ImageElement = {
      id: "image-bg-1",
      kind: "image",
      imageUrl: "https://r2/x.jpg",
      rect: { x: 0, y: 0, w: 100, h: 100, rotation: 0 },
      timing: timing(0, 0, 5, 0),
    };
    const f = evaluate(lesson([slide([bg, shape])]), 2);
    expect(f.imageUrl).toBe("https://r2/x.jpg");
    expect(f.svgOverlays.find((o) => o.id === "image-bg-1")).toBeUndefined();
    expect(f.highlights).toHaveLength(1);
  });
});

describe("evaluate — camera + motion", () => {
  const zoom: CameraElement = {
    id: "z",
    kind: "camera",
    to: { x: 50, y: 50, scale: 2 },
    timing: timing(0, 1, 2, 0),
    persistent: false,
  };

  it("eases a transient zoom toward its target", () => {
    const f = evaluate(lesson([slide([zoom])]), 1); // peak
    expect(f.transform.scale).toBeCloseTo(2);
  });

  it("motion=0 pins the camera to the slide-start transform", () => {
    const f = evaluate(lesson([slide([zoom])]), 1, { motion: 0 });
    expect(f.transform.scale).toBeCloseTo(1); // start scale, not 2
  });

  it("motion=0 damps overlay scale-pop to 1", () => {
    // scaleAt during fade-in is < 1 normally; motion 0 → exactly 1
    expect(scaleAt(timing(0, 1, 2, 1), 0.5, 1)).not.toBeCloseTo(1);
    expect(scaleAt(timing(0, 1, 2, 1), 0.5, 0)).toBeCloseTo(1);
  });
});

describe("evaluate — transitions", () => {
  it("crossfades into the next slide near the boundary", () => {
    const a = slide([shape], { id: "a", duration: 4 });
    const b = slide([shape], { id: "b", transitionIn: { kind: "crossfade", duration: 1 } });
    // transition window for slide a is [3,4); sample at 3.5
    const f = evaluate(lesson([a, b]), 3.5);
    expect(f.currentSlide?.id).toBe("a");
    expect(f.incomingSlide?.id).toBe("b");
    expect(f.incomingOpacity).toBeGreaterThan(0);
    expect(f.incomingOpacity).toBeLessThan(1);
  });
});
