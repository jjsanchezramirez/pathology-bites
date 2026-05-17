import { describe, it, expect } from "vitest";
import { createElementFromDrag } from "@/app/(admin)/admin/lesson-studio/canvas/element-factory";

describe("createElementFromDrag", () => {
  it("creates a rectangle shape with normalized rect", () => {
    const el = createElementFromDrag({
      tool: "shape",
      start: { x: 40, y: 30 },
      end: { x: 20, y: 50 },
      slideDuration: 10,
    });
    expect(el?.kind).toBe("shape");
    if (el?.kind === "shape") {
      expect(el.shape).toBe("rectangle");
      expect(el.rect.x).toBe(20);
      expect(el.rect.y).toBe(30);
      expect(el.rect.w).toBe(20);
      expect(el.rect.h).toBe(20);
    }
  });

  it("creates arrow using raw start→end endpoints", () => {
    const el = createElementFromDrag({
      tool: "arrow",
      start: { x: 10, y: 10 },
      end: { x: 80, y: 50 },
      slideDuration: 10,
    });
    expect(el?.kind).toBe("arrow");
    if (el?.kind === "arrow") {
      expect(el.from).toEqual({ x: 10, y: 10 });
      expect(el.to).toEqual({ x: 80, y: 50 });
    }
  });

  it("creates text with minimum-size rect", () => {
    const el = createElementFromDrag({
      tool: "text",
      start: { x: 50, y: 50 },
      end: { x: 52, y: 52 },
      slideDuration: 10,
    });
    if (el?.kind === "text") {
      expect(el.rect.w).toBeGreaterThanOrEqual(20);
      expect(el.rect.h).toBeGreaterThanOrEqual(8);
    }
  });

  it("returns null for non-canvas tools (select, svg, image)", () => {
    expect(
      createElementFromDrag({
        tool: "select",
        start: { x: 0, y: 0 },
        end: { x: 10, y: 10 },
        slideDuration: 10,
      })
    ).toBeNull();
    expect(
      createElementFromDrag({
        tool: "svg",
        start: { x: 0, y: 0 },
        end: { x: 10, y: 10 },
        slideDuration: 10,
      })
    ).toBeNull();
    expect(
      createElementFromDrag({
        tool: "image",
        start: { x: 0, y: 0 },
        end: { x: 10, y: 10 },
        slideDuration: 10,
      })
    ).toBeNull();
  });

  it("creates camera element at click point with default 2× scale", () => {
    const el = createElementFromDrag({
      tool: "camera",
      start: { x: 35, y: 42 },
      end: { x: 35, y: 42 },
      slideDuration: 10,
    });
    expect(el?.kind).toBe("camera");
    if (el?.kind === "camera") {
      expect(el.to).toEqual({ x: 35, y: 42, scale: 2 });
      expect(el.persistent).toBe(false);
    }
  });

  it("applies microscopy palette when category is microscopic", () => {
    const arrow = createElementFromDrag({
      tool: "arrow",
      start: { x: 10, y: 10 },
      end: { x: 20, y: 20 },
      slideDuration: 10,
      imageCategory: "microscopic",
    });
    if (arrow?.kind === "arrow") {
      expect(arrow.color).toBe("#ffcc00");
    }
  });

  it("applies presentation palette when category is figure/table/diagram", () => {
    const shape = createElementFromDrag({
      tool: "shape",
      start: { x: 10, y: 10 },
      end: { x: 50, y: 40 },
      slideDuration: 10,
      imageCategory: "figure",
    });
    if (shape?.kind === "shape") {
      expect(shape.stroke.color).toBe("#1d4ed8");
    }
  });

  it("clamps timing hold to slide duration", () => {
    const el = createElementFromDrag({
      tool: "shape",
      start: { x: 0, y: 0 },
      end: { x: 20, y: 20 },
      slideDuration: 2,
    });
    // slideDuration - 1 = 1, hold = max(1, min(3, 1)) = 1
    if (el?.kind === "shape") {
      expect(el.timing.hold).toBe(1);
    }
  });
});
