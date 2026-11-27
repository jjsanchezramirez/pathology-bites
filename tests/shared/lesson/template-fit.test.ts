import { describe, it, expect } from "vitest";
import { fitScene, headingSize, slideFromScene } from "@/shared/lesson/templates";
import type { Scene, TemplateKind } from "@/shared/lesson/script/types";
import type { SlideElement } from "@/shared/lesson/types";
import { fitScale, MIN_TEXT_SCALE } from "@/shared/lesson/fit";

const LONG =
  "Intramucosal adenocarcinoma invades the lamina propria or muscularis mucosae without reaching the submucosa";

function scene(template: TemplateKind, n: number, text: string, extra: Partial<Scene> = {}): Scene {
  return {
    id: "s",
    template,
    heading: "Heading",
    beats: Array.from({ length: n }, (_, k) => ({
      id: `b${k}`,
      say: `Sentence ${k}.`,
      text,
      detail: template === "takehome" || template === "image" ? undefined : text,
      ...(template === "image" ? { region: { x: 10 + k * 5, y: 10, w: 10, h: 10 } } : {}),
      ...(template === "compare" ? { side: k % 2 ? ("right" as const) : ("left" as const) } : {}),
    })),
    ...extra,
  };
}

const bottom = (els: SlideElement[]) =>
  Math.max(
    ...els
      .filter((e) => e.kind !== "camera" && e.kind !== "spotlight" && "rect" in e)
      .map(
        (e) =>
          (e as { rect: { y: number; h: number } }).rect.y + (e as { rect: { h: number } }).rect.h
      )
  );

const textRows = (els: SlideElement[]) =>
  els
    .filter((e) => e.kind === "text")
    .map((e) => (e as { rect: { x: number; y: number; w: number; h: number } }).rect);

describe("templates fit the frame", () => {
  it("keeps a short scene at full size", () => {
    expect(fitScene(scene("takehome", 3, "Short point")).textScale).toBe(1);
  });

  it.each([
    ["image", 6],
    ["ladder", 6],
    ["takehome", 5],
    ["compare", 6],
  ] as const)("shrinks a crowded %s scene until it fits", (kind, n) => {
    const full = scene(
      kind,
      n,
      LONG,
      kind === "image" ? { image: { url: "https://x/y.jpg", width: 800, height: 600 } } : {}
    );
    const fitted = fitScene(full);
    expect(fitted.textScale).toBeLessThan(1);
    expect(bottom(fitted.elements)).toBeLessThanOrEqual(100);
  });

  it("never stacks one text box over another in a column", () => {
    const s = scene("image", 6, LONG, {
      image: { url: "https://x/y.jpg", width: 800, height: 600 },
    });
    const rows = textRows(slideFromScene(s).elements).filter((r) => r.x > 60 && r.h > 4);
    const sorted = [...rows].sort((a, b) => a.y - b.y);
    for (let i = 1; i < sorted.length; i++) {
      if (Math.abs(sorted[i].x - sorted[i - 1].x) > 1) continue;
      expect(sorted[i].y).toBeGreaterThanOrEqual(sorted[i - 1].y + sorted[i - 1].h - 0.01);
    }
  });

  it("shrinks a long heading to two lines above the content", () => {
    expect(headingSize("Four lines")).toBe(3.3);
    const long =
      "Barrett esophagus: how the four lines of the surface epithelium separate reactive maturation from low-grade and high-grade dysplasia";
    const size = headingSize(long);
    expect(size).toBeLessThan(3.3);
    const heading = slideFromScene(scene("takehome", 1, "x", { heading: long })).elements.find(
      (e) => e.kind === "text" && (e as { text: string }).text === long
    ) as { rect: { y: number; h: number } };
    // Content starts at 13 width units = 23.1% of the frame height.
    expect(heading.rect.y + heading.rect.h).toBeLessThanOrEqual(23.2);
  });
});

describe("fitScale", () => {
  it("keeps full size when it fits", () => {
    expect(fitScale(() => true)).toBe(1);
  });
  it("finds the largest size that fits", () => {
    const k = fitScale((s) => s <= 0.7);
    expect(k).toBeLessThanOrEqual(0.7);
    expect(k).toBeGreaterThan(0.69);
  });
  it("stops at the floor", () => {
    expect(fitScale(() => false)).toBe(MIN_TEXT_SCALE);
  });
});
