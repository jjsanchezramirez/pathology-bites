import { describe, it, expect } from "vitest";
import {
  pointInRect,
  distanceToSegment,
  pointOnSegment,
  computeHandles,
  hitHandle,
  resizeRect,
  applyRotation,
  rectCenter,
  rotate,
} from "@/app/(admin)/admin/lesson-studio/canvas/geometry";
import type { Rect } from "@/app/(admin)/admin/lesson-studio/model/types";

const R = (x: number, y: number, w: number, h: number, rotation = 0): Rect => ({
  x,
  y,
  w,
  h,
  rotation,
});

describe("pointInRect", () => {
  it("hits axis-aligned rect interior", () => {
    const r = R(10, 10, 20, 20);
    expect(pointInRect({ x: 20, y: 20 }, r)).toBe(true);
    expect(pointInRect({ x: 9, y: 20 }, r)).toBe(false);
    expect(pointInRect({ x: 30.1, y: 20 }, r)).toBe(false);
  });
  it("respects rotation", () => {
    // 20x20 rect centered at (50,50), rotated 45°.
    const r = R(40, 40, 20, 20, 45);
    // Center is always inside.
    expect(pointInRect({ x: 50, y: 50 }, r)).toBe(true);
    // A point at world (45, 45): rotate -45° around center (50,50) → (?, ?)
    // It should be inside a rotated square.
    expect(pointInRect({ x: 45, y: 45 }, r)).toBe(true);
    // Corner of unrotated bbox — outside the rotated square.
    expect(pointInRect({ x: 40, y: 40 }, r)).toBe(false);
  });
});

describe("distanceToSegment / pointOnSegment", () => {
  it("measures perpendicular distance", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    expect(distanceToSegment({ x: 5, y: 3 }, a, b)).toBeCloseTo(3);
    expect(distanceToSegment({ x: 5, y: -4 }, a, b)).toBeCloseTo(4);
  });
  it("clamps to endpoints", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    expect(distanceToSegment({ x: -3, y: 0 }, a, b)).toBeCloseTo(3);
    expect(distanceToSegment({ x: 14, y: 0 }, a, b)).toBeCloseTo(4);
  });
  it("pointOnSegment uses tolerance", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    expect(pointOnSegment({ x: 5, y: 1.5 }, a, b, 2)).toBe(true);
    expect(pointOnSegment({ x: 5, y: 3 }, a, b, 2)).toBe(false);
  });
});

describe("computeHandles / hitHandle", () => {
  it("places handles correctly for unrotated rect", () => {
    const r = R(10, 10, 20, 20);
    const handles = computeHandles(r, 5);
    const get = (id: string) => handles.find((h) => h.id === id)!.pos;
    expect(get("nw")).toEqual({ x: 10, y: 10 });
    expect(get("ne")).toEqual({ x: 30, y: 10 });
    expect(get("se")).toEqual({ x: 30, y: 30 });
    expect(get("sw")).toEqual({ x: 10, y: 30 });
    expect(get("n")).toEqual({ x: 20, y: 10 });
    expect(get("s")).toEqual({ x: 20, y: 30 });
    expect(get("e")).toEqual({ x: 30, y: 20 });
    expect(get("w")).toEqual({ x: 10, y: 20 });
    expect(get("rotate").x).toBeCloseTo(20);
    expect(get("rotate").y).toBeCloseTo(5); // 10 - 5 offset
  });
  it("hitHandle returns nearest within tolerance", () => {
    const r = R(10, 10, 20, 20);
    const handles = computeHandles(r, 5);
    expect(hitHandle(handles, { x: 30.5, y: 10.2 }, 1)?.id).toBe("ne");
    expect(hitHandle(handles, { x: 100, y: 100 }, 1)).toBeNull();
  });
});

describe("resizeRect", () => {
  it("SE handle grows width and height", () => {
    const r = R(0, 0, 10, 10);
    const next = resizeRect(r, "se", { x: 5, y: 5 });
    expect(next.w).toBeCloseTo(15);
    expect(next.h).toBeCloseTo(15);
    // NW corner stays fixed
    expect(next.x).toBeCloseTo(0);
    expect(next.y).toBeCloseTo(0);
  });
  it("NW handle shrinks width/height and moves origin", () => {
    const r = R(0, 0, 10, 10);
    const next = resizeRect(r, "nw", { x: 3, y: 2 });
    expect(next.x).toBeCloseTo(3);
    expect(next.y).toBeCloseTo(2);
    expect(next.w).toBeCloseTo(7);
    expect(next.h).toBeCloseTo(8);
  });
  it("E handle only changes width", () => {
    const r = R(0, 0, 10, 10);
    const next = resizeRect(r, "e", { x: 4, y: 10 });
    expect(next.w).toBeCloseTo(14);
    expect(next.h).toBeCloseTo(10);
  });
  it("preserves aspect on corner drags when flag set", () => {
    const r = R(0, 0, 10, 5); // 2:1
    const next = resizeRect(r, "se", { x: 10, y: 2 }, true);
    // Aspect 2:1 preserved; the drag with larger dx should win.
    expect(next.w / next.h).toBeCloseTo(2, 1);
  });
  it("flips rect when dragging past opposite edge", () => {
    const r = R(0, 0, 10, 10);
    const next = resizeRect(r, "e", { x: -20, y: 0 });
    expect(next.w).toBeGreaterThan(0);
    expect(next.h).toBeGreaterThan(0);
  });
  it("rotation is preserved", () => {
    const r = R(0, 0, 10, 10, 45);
    const next = resizeRect(r, "se", { x: 2, y: 2 });
    expect(next.rotation).toBe(45);
  });
});

describe("applyRotation", () => {
  it("rotates by angle delta between start and current pointer", () => {
    const r = R(40, 40, 20, 20, 0);
    // Start pointer above center → nowAngle = 0. Current pointer right of center → 90°.
    const next = applyRotation(r, { x: 50, y: 30 }, { x: 70, y: 50 });
    expect(next.rotation).toBeCloseTo(90);
  });
  it("wraps rotation to 0–360", () => {
    const r = R(40, 40, 20, 20, 350);
    const next = applyRotation(r, { x: 50, y: 30 }, { x: 70, y: 50 });
    expect(next.rotation).toBeGreaterThanOrEqual(0);
    expect(next.rotation).toBeLessThan(360);
    expect(next.rotation).toBeCloseTo(80); // 350 + 90 = 440 → 80
  });
});

describe("rectCenter / rotate", () => {
  it("center is correct", () => {
    expect(rectCenter(R(10, 20, 30, 40))).toEqual({ x: 25, y: 40 });
  });
  it("rotate by 90° maps +x to +y (scaled by canvas aspect)", () => {
    const CANVAS_ASPECT = 16 / 9;
    const p = rotate({ x: 1, y: 0 }, { x: 0, y: 0 }, 90);
    expect(p.x).toBeCloseTo(0);
    // y is scaled by CANVAS_ASPECT because the function works in isotropic pixel-space
    expect(p.y).toBeCloseTo(CANVAS_ASPECT);
  });
});
