import { describe, it, expect } from "vitest";
import { Easing, interpolate, animate, applyEase } from "@/shared/lesson/easing";

describe("Easing set", () => {
  it("all curves pass through 0 and 1 at the endpoints", () => {
    for (const [name, fn] of Object.entries(Easing)) {
      expect(fn(0), `${name}(0)`).toBeCloseTo(0, 5);
      expect(fn(1), `${name}(1)`).toBeCloseTo(1, 5);
    }
  });

  it("smoothstep matches the historical player default t*t*(3-2t)", () => {
    for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      expect(Easing.smoothstep(t)).toBeCloseTo(t * t * (3 - 2 * t), 10);
    }
  });

  it("easeOutBack overshoots above 1 before settling", () => {
    const peak = Math.max(
      ...Array.from({ length: 99 }, (_, i) => Easing.easeOutBack((i + 1) / 100))
    );
    expect(peak).toBeGreaterThan(1);
  });
});

describe("interpolate", () => {
  it("clamps at the endpoints", () => {
    const f = interpolate([0, 10], [100, 200]);
    expect(f(-5)).toBe(100);
    expect(f(0)).toBe(100);
    expect(f(10)).toBe(200);
    expect(f(15)).toBe(200);
  });

  it("is linear by default at the midpoint", () => {
    const f = interpolate([0, 10], [0, 100]);
    expect(f(5)).toBeCloseTo(50);
  });

  it("supports per-segment easing arrays", () => {
    // leg 0 linear, leg 1 easeOutBack — the array form is per-keyframe easing.
    const f = interpolate([0, 1, 2], [0, 10, 20], [Easing.linear, Easing.easeOutBack]);
    expect(f(0.5)).toBeCloseTo(5); // linear leg
    // easeOutBack overshoots, so the second leg can exceed its linear value
    expect(f(1.5)).toBeGreaterThan(15);
  });

  it("handles zero-width segments (hold/settle) without NaN", () => {
    const f = interpolate([0, 1, 1, 2], [0, 5, 5, 10]);
    expect(f(1)).toBe(5);
    expect(Number.isNaN(f(1))).toBe(false);
  });
});

describe("animate", () => {
  it("clamps outside [start,end] and eases inside", () => {
    const f = animate({ from: 0, to: 100, start: 1, end: 3, ease: Easing.linear });
    expect(f(0)).toBe(0);
    expect(f(1)).toBe(0);
    expect(f(2)).toBeCloseTo(50);
    expect(f(3)).toBe(100);
    expect(f(4)).toBe(100);
  });
});

describe("applyEase", () => {
  it("falls back when the name is unknown/undefined", () => {
    expect(applyEase(undefined, 0.5, "linear")).toBeCloseTo(0.5);
    expect(applyEase("easeInOutCubic", 0)).toBe(0);
    expect(applyEase("easeInOutCubic", 1)).toBe(1);
  });
});
