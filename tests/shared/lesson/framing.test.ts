import { describe, it, expect } from "vitest";
import { frameTransformForRegion, clampFraming } from "@/shared/lesson/framing";
import type { Rect } from "@/shared/lesson/types";

const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h, rotation: 0 });

describe("clampFraming", () => {
  it("never lets the scaled image expose black edges", () => {
    for (let scale = 1; scale <= 4; scale += 0.25) {
      const c = clampFraming({ x: 0, y: 200, scale });
      const half = 50 / scale;
      // The visible window [x-half, x+half] must stay within [0,100].
      expect(c.x - half).toBeGreaterThanOrEqual(-1e-6);
      expect(c.x + half).toBeLessThanOrEqual(100 + 1e-6);
      expect(c.y - half).toBeGreaterThanOrEqual(-1e-6);
      expect(c.y + half).toBeLessThanOrEqual(100 + 1e-6);
    }
  });

  it("pins to center at scale 1", () => {
    const c = clampFraming({ x: 10, y: 90, scale: 1 });
    expect(c.x).toBe(50);
    expect(c.y).toBe(50);
  });
});

describe("frameTransformForRegion", () => {
  it("centers on the region", () => {
    const f = frameTransformForRegion(rect(20, 30, 20, 20), { coverage: 0.6 });
    // region center is (30,40); at this scale the framing isn't pinned, so it
    // should land on the center (within guardrails).
    expect(f.x).toBeGreaterThan(20);
    expect(f.y).toBeGreaterThan(30);
  });

  it("zooms in for small regions and clamps to maxScale", () => {
    const f = frameTransformForRegion(rect(48, 48, 4, 4), { coverage: 0.6, maxScale: 4 });
    expect(f.scale).toBe(4);
  });

  it("never returns scale below 1", () => {
    const f = frameTransformForRegion(rect(0, 0, 100, 100));
    expect(f.scale).toBeGreaterThanOrEqual(1);
  });

  it("output covers the viewport (clamped)", () => {
    const f = frameTransformForRegion(rect(0, 0, 10, 10));
    const half = 50 / f.scale;
    expect(f.x - half).toBeGreaterThanOrEqual(-1e-6);
    expect(f.x + half).toBeLessThanOrEqual(100 + 1e-6);
  });
});
