import { describe, it, expect } from "vitest";
import {
  opacityAt,
  isVisibleAt,
  computeSlideAt,
  cameraToCss,
} from "@/app/(admin)/admin/lesson-studio/model/runtime";
import type {
  Slide,
  ShapeElement,
  CameraElement,
} from "@/app/(admin)/admin/lesson-studio/model/types";
import {
  timing,
  DEFAULT_FRAMING,
  DEFAULT_TRANSITION,
} from "@/app/(admin)/admin/lesson-studio/model/types";

function makeSlide(elements: Slide["elements"] = []): Slide {
  return {
    id: "s1",
    duration: 10,
    transitionIn: { ...DEFAULT_TRANSITION },
    initialFraming: { ...DEFAULT_FRAMING },
    elements,
  };
}

describe("runtime.opacityAt / isVisibleAt", () => {
  it("matches the 4-phase model", () => {
    const t = timing(1, 0.5, 2, 0.5);
    expect(opacityAt(t, 0)).toBe(0);
    expect(opacityAt(t, 1)).toBe(0);
    expect(opacityAt(t, 1.25)).toBeCloseTo(0.5);
    expect(opacityAt(t, 1.5)).toBe(1);
    expect(opacityAt(t, 3.5)).toBe(1);
    expect(opacityAt(t, 3.75)).toBeCloseTo(0.5);
    expect(opacityAt(t, 4)).toBe(0);
    expect(opacityAt(t, 5)).toBe(0);
  });
  it("isVisibleAt is true within the span", () => {
    const t = timing(1, 0.5, 2, 0.5);
    expect(isVisibleAt(t, 1)).toBe(true);
    expect(isVisibleAt(t, 4)).toBe(true);
    expect(isVisibleAt(t, 0.5)).toBe(false);
    expect(isVisibleAt(t, 4.5)).toBe(false);
  });
});

describe("runtime.computeSlideAt", () => {
  const shape: ShapeElement = {
    id: "sh",
    kind: "shape",
    shape: "rectangle",
    rect: { x: 10, y: 10, w: 30, h: 30, rotation: 0 },
    stroke: { color: "#f00", width: 2, style: "solid" },
    timing: timing(0, 1, 2, 1),
  };

  it("returns correct opacity per element", () => {
    const slide = makeSlide([shape]);
    expect(computeSlideAt(slide, 0).elementOpacity.sh).toBe(0);
    expect(computeSlideAt(slide, 0.5).elementOpacity.sh).toBeCloseTo(0.5);
    expect(computeSlideAt(slide, 2).elementOpacity.sh).toBe(1);
    expect(computeSlideAt(slide, 3.5).elementOpacity.sh).toBeCloseTo(0.5);
    expect(computeSlideAt(slide, 5).elementOpacity.sh).toBe(0);
  });

  it("returns identity transform with default framing and no camera ops", () => {
    const slide = makeSlide([shape]);
    const rt = computeSlideAt(slide, 0);
    expect(rt.transform).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it("applies non-persistent camera element at peak", () => {
    const cam: CameraElement = {
      id: "z",
      kind: "camera",
      to: { x: 50, y: 50, scale: 2 },
      timing: timing(0, 0, 3, 0),
      persistent: false,
    };
    const slide = makeSlide([cam]);
    expect(computeSlideAt(slide, 1).transform.scale).toBe(2);
  });

  it("applies persistent camera that persists past fadeIn", () => {
    const cam: CameraElement = {
      id: "p",
      kind: "camera",
      to: { x: 70, y: 40, scale: 1.5 },
      timing: timing(1, 1, 0, 0),
      persistent: true,
    };
    const slide = makeSlide([cam]);
    // before pan: identity
    expect(computeSlideAt(slide, 0.5).transform).toEqual({ x: 0, y: 0, scale: 1 });
    // after pan completes: new base
    expect(computeSlideAt(slide, 5).transform).toEqual({ x: 20, y: -10, scale: 1.5 });
  });

  it("ignores camera elements when computing elementOpacity", () => {
    const cam: CameraElement = {
      id: "z",
      kind: "camera",
      to: { x: 50, y: 50, scale: 2 },
      timing: timing(0, 0, 3, 0),
      persistent: false,
    };
    const rt = computeSlideAt(makeSlide([cam]), 1);
    expect(rt.elementOpacity.z).toBeUndefined();
  });
});

describe("cameraToCss", () => {
  it("emits translate+scale", () => {
    expect(cameraToCss({ x: -10, y: 5, scale: 1.5 })).toBe("translate(-10%, 5%) scale(1.5)");
  });
});
