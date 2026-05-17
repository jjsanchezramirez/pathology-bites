import { describe, it, expect } from "vitest";
import {
  hitElement,
  moveElement,
  selectionBounds,
} from "@/app/(admin)/admin/lesson-studio/canvas/hit-testing";
import type {
  ShapeElement,
  ArrowElement,
  CameraElement,
} from "@/app/(admin)/admin/lesson-studio/model/types";
import { timing } from "@/app/(admin)/admin/lesson-studio/model/types";

const shape = (id: string, x: number, y: number, w: number, h: number): ShapeElement => ({
  id,
  kind: "shape",
  shape: "rectangle",
  rect: { x, y, w, h, rotation: 0 },
  stroke: { color: "#f00", width: 2, style: "solid" },
  timing: timing(0, 0, 1, 0),
});

const arrow = (id: string, x1: number, y1: number, x2: number, y2: number): ArrowElement => ({
  id,
  kind: "arrow",
  from: { x: x1, y: y1 },
  to: { x: x2, y: y2 },
  color: "#fff",
  strokeWidth: 3,
  headSize: 12,
  timing: timing(0, 0, 1, 0),
});

describe("hitElement", () => {
  it("returns topmost element when stacked", () => {
    const a = shape("bottom", 0, 0, 50, 50);
    const b = shape("top", 10, 10, 30, 30);
    const hit = hitElement([a, b], { x: 20, y: 20 });
    expect(hit?.id).toBe("top");
  });
  it("misses when no element contains point", () => {
    const a = shape("a", 0, 0, 10, 10);
    expect(hitElement([a], { x: 50, y: 50 })).toBeNull();
  });
  it("hits arrow along its line with tolerance", () => {
    const arr = arrow("a", 0, 0, 10, 0);
    expect(hitElement([arr], { x: 5, y: 1.5 }, 2)?.id).toBe("a");
    expect(hitElement([arr], { x: 5, y: 5 }, 2)).toBeNull();
  });
  it("ignores camera elements", () => {
    const cam: CameraElement = {
      id: "z",
      kind: "camera",
      to: { x: 50, y: 50, scale: 2 },
      timing: timing(0, 0, 1, 0),
      persistent: false,
    };
    expect(hitElement([cam], { x: 50, y: 50 })).toBeNull();
  });
});

describe("moveElement", () => {
  it("translates rect-based elements", () => {
    const s = shape("s", 10, 10, 20, 20);
    const moved = moveElement(s, { x: 5, y: -3 });
    expect(moved.kind === "shape" && moved.rect.x).toBe(15);
    expect(moved.kind === "shape" && moved.rect.y).toBe(7);
  });
  it("translates arrows by delta on both endpoints", () => {
    const a = arrow("a", 0, 0, 10, 10);
    const moved = moveElement(a, { x: 3, y: 4 });
    expect(moved.kind === "arrow" && moved.from).toEqual({ x: 3, y: 4 });
    expect(moved.kind === "arrow" && moved.to).toEqual({ x: 13, y: 14 });
  });
  it("passes camera elements through unchanged", () => {
    const cam: CameraElement = {
      id: "z",
      kind: "camera",
      to: { x: 50, y: 50, scale: 2 },
      timing: timing(0, 0, 1, 0),
      persistent: false,
    };
    expect(moveElement(cam, { x: 5, y: 5 })).toBe(cam);
  });
});

describe("selectionBounds", () => {
  it("returns union bbox for mixed selection", () => {
    const s = shape("s", 10, 10, 10, 10);
    const a = arrow("a", 50, 50, 60, 80);
    const bbox = selectionBounds([s, a])!;
    expect(bbox.x).toBe(10);
    expect(bbox.y).toBe(10);
    expect(bbox.w).toBe(50);
    expect(bbox.h).toBe(70);
  });
  it("uses rotated corners for bbox", () => {
    const s: ShapeElement = {
      ...shape("s", 40, 40, 20, 20),
      rect: { x: 40, y: 40, w: 20, h: 20, rotation: 45 },
    };
    const bbox = selectionBounds([s])!;
    // A 20x20 rotated 45° has an inscribed bbox of ~28.28 x 28.28
    expect(bbox.w).toBeCloseTo(28.28, 0);
    expect(bbox.h).toBeCloseTo(28.28, 0);
  });
  it("returns null for camera-only selection", () => {
    const cam: CameraElement = {
      id: "z",
      kind: "camera",
      to: { x: 50, y: 50, scale: 2 },
      timing: timing(0, 0, 1, 0),
      persistent: false,
    };
    expect(selectionBounds([cam])).toBeNull();
  });
});
