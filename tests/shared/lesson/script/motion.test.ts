import { describe, it, expect } from "vitest";
import {
  fadeIn,
  fadeStyle,
  fadeWindow,
  lerpZoom,
  NO_ZOOM,
  zoomCss,
  zoomTarget,
  MOTION,
} from "@/shared/lesson/script/motion";

describe("fixed motion", () => {
  it("fades in once, over the fixed length", () => {
    expect(fadeIn(0, 1)).toBe(0);
    expect(fadeIn(1 + MOTION.fade / 2, 1)).toBeCloseTo(0.5);
    expect(fadeIn(1 + MOTION.fade, 1)).toBe(1);
  });

  it("fades a window back out", () => {
    expect(fadeWindow(2, 0, 3)).toBe(1);
    expect(fadeWindow(3 + MOTION.fade, 0, 3)).toBe(0);
    expect(fadeWindow(10, 0, null)).toBe(1);
  });

  it("drops the transform once visible", () => {
    expect(fadeStyle(1)).toEqual({ opacity: 1 });
    expect(fadeStyle(0).transform).toMatch(/translateY/);
  });

  it("frames a region without showing empty edges", () => {
    const z = zoomTarget({ x: 80, y: 80, w: 20, h: 20 });
    expect(z.scale).toBeLessThanOrEqual(MOTION.maxZoom);
    const lim = 50 - 50 / z.scale;
    expect(Math.abs(z.tx)).toBeLessThanOrEqual(lim + 1e-9);
    expect(Math.abs(z.ty)).toBeLessThanOrEqual(lim + 1e-9);
    expect(zoomTarget({ x: 0, y: 0, w: 100, h: 100 }).scale).toBe(1);
  });

  it("blends zooms and writes CSS", () => {
    const z = lerpZoom(NO_ZOOM, { scale: 3, tx: 10, ty: -10 }, 0.5);
    expect(z).toEqual({ scale: 2, tx: 5, ty: -5 });
    expect(zoomCss(NO_ZOOM)).toBe("none");
    expect(zoomCss(z)).toBe("scale(2.0000) translate(5.000%, -5.000%)");
  });
});
