import { describe, it, expect } from "vitest";
import {
  coverZoom,
  slideFromImage,
  blankSlide,
  svgElementFromAsset,
} from "@/app/(admin)/admin/lesson-studio/model/slide-factory";

describe("coverZoom", () => {
  it("returns >1 for wide images (crop sides)", () => {
    // 2:1 vs 16:9 (1.777) → 2/1.777 ≈ 1.125
    expect(coverZoom(2000, 1000)).toBeCloseTo(1.13, 1);
  });
  it("returns >1 for tall images (crop top/bottom)", () => {
    // 1:1 vs 16:9 → 1.777
    expect(coverZoom(1000, 1000)).toBeCloseTo(1.78, 1);
  });
  it("matches viewport exactly for 16:9", () => {
    expect(coverZoom(1920, 1080)).toBeCloseTo(1, 1);
  });
  it("clamps to 0.5..2", () => {
    expect(coverZoom(10000, 100)).toBe(2);
    expect(coverZoom(100, 100)).toBeLessThanOrEqual(2);
  });
  it("returns 1 for bad dimensions", () => {
    expect(coverZoom(0, 0)).toBe(1);
  });
});

describe("slideFromImage", () => {
  it("maps LibraryImage to a Slide with defaults", () => {
    const slide = slideFromImage({
      id: "img-1",
      url: "https://example.com/a.jpg",
      description: "test",
      category: "microscopic",
      width: 1920,
      height: 1080,
    });
    // Background is now an ImageElement at index 0 instead of backgroundImageUrl.
    const bgEl = slide.elements[0];
    expect(bgEl.kind).toBe("image");
    expect(bgEl.kind === "image" && bgEl.imageUrl).toBe("https://example.com/a.jpg");
    expect(slide.imageCategory).toBe("microscopic");
    expect(slide.imageWidth).toBe(1920);
    expect(slide.imageHeight).toBe(1080);
    expect(slide.duration).toBe(10);
    expect(slide.initialFraming.scale).toBeGreaterThan(0);
  });
  it("normalizes various category strings", () => {
    expect(
      slideFromImage({
        id: "1",
        url: "",
        category: "Gross pathology",
        width: 100,
        height: 100,
      }).imageCategory
    ).toBe("gross");
    expect(
      slideFromImage({
        id: "1",
        url: "",
        category: "Table",
        width: 100,
        height: 100,
      }).imageCategory
    ).toBe("table");
    expect(
      slideFromImage({
        id: "1",
        url: "",
        category: "something else",
        width: 100,
        height: 100,
      }).imageCategory
    ).toBeUndefined();
  });
});

describe("blankSlide", () => {
  it("builds a null-image slide with background color", () => {
    const s = blankSlide("#123456");
    expect(s.elements).toHaveLength(0);
    expect(s.backgroundColor).toBe("#123456");
    expect(s.imageCategory).toBe("blank");
    expect(s.initialFraming.scale).toBe(1);
  });
});

describe("svgElementFromAsset", () => {
  it("creates an svg element centered on canvas", () => {
    const el = svgElementFromAsset(
      { id: "svg-1", url: "https://example.com/x.svg", name: "arrow" },
      10
    );
    expect(el.kind).toBe("svg");
    expect(el.svgUrl).toBe("https://example.com/x.svg");
    expect(el.svgName).toBe("arrow");
    expect(el.rect.x + el.rect.w / 2).toBeCloseTo(50);
    expect(el.rect.y + el.rect.h / 2).toBeCloseTo(50);
    expect(el.timing.hold).toBeGreaterThan(0);
  });
});
