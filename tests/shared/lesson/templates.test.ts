import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import {
  lessonFromScript,
  slideFromScene,
  starterScene,
  estimateLines,
  cameraFor,
} from "@/shared/lesson/templates";
import { autoTimeLesson } from "@/shared/lesson/auto-timing";
import { evaluate } from "@/shared/lesson/evaluate";
import { TEMPLATE_ORDER } from "@/shared/lesson/script/types";
import { importScript } from "@/shared/lesson/script/import";

describe("templates", () => {
  it.each(TEMPLATE_ORDER)(
    "%s: every element is tied to the narration, nothing timed by hand",
    (kind) => {
      const slide = slideFromScene(starterScene(kind));
      expect(slide.look).toBe("clean");
      expect(slide.autoDuration).toBe(true);
      expect(slide.elements.length).toBeGreaterThan(0);
      for (const el of slide.elements) expect(el.cue).toBeDefined();
      // Every id a narration line points at exists on the slide.
      const ids = new Set(slide.elements.map((e) => e.id));
      for (const line of slide.narration!.lines)
        for (const id of line.elementIds) expect(ids.has(id)).toBe(true);
      // Elements stay on the frame.
      for (const el of slide.elements) {
        if (!("rect" in el)) continue;
        expect(el.rect.x).toBeGreaterThanOrEqual(-1);
        expect(el.rect.x + el.rect.w).toBeLessThanOrEqual(101);
        expect(el.rect.y).toBeGreaterThanOrEqual(-1);
        expect(el.rect.y + el.rect.h).toBeLessThanOrEqual(101);
      }
    }
  );

  it("image template: rings come and go with their sentence, labels stay", () => {
    const slide = slideFromScene(starterScene("image"));
    const [l1, l2] = slide.narration!.lines;
    const ring = slide.elements.find((e) => e.kind === "shape" && e.shape === "oval")!;
    expect(l1.elementIds).toContain(ring.id);
    expect(ring.cue).toBe("beat");
    const end = ring.timing.start + ring.timing.fadeIn + ring.timing.hold + ring.timing.fadeOut;
    expect(end).toBeLessThanOrEqual(slide.duration);
    const label = slide.elements.find((e) => e.kind === "text" && e.text === "First feature")!;
    expect(label.cue).toBe("build");
    expect(l2.elementIds).not.toContain(label.id);
  });

  it("zoom marks become a camera move that stays inside the frame", () => {
    const to = cameraFor({ x: 50, y: 20, w: 20, h: 15 });
    expect(to.scale).toBeGreaterThan(1);
    expect(to.scale).toBeLessThanOrEqual(3);
    const lim = 50 * (to.scale - 1);
    expect(Math.abs(to.x - 50)).toBeLessThanOrEqual(lim + 1e-6);
    expect(Math.abs(to.y - 50)).toBeLessThanOrEqual(lim + 1e-6);
  });

  it("estimates wrapping", () => {
    expect(estimateLines("short", 2, 400, 50)).toBe(1);
    expect(estimateLines("word ".repeat(60), 2, 400, 30)).toBeGreaterThan(3);
  });

  it("evaluates a template lesson as clean frames", () => {
    const lesson = lessonFromScript({
      format: "script-lesson",
      version: 1,
      id: null,
      title: "T",
      description: "",
      aspectRatio: "16:9",
      audio: null,
      scenes: TEMPLATE_ORDER.map(starterScene),
    });
    expect(autoTimeLesson(lesson)).toBe(lesson);
    const f = evaluate(lesson, 1.5);
    expect(f.clean).not.toBeNull();
    expect(f.highlights).toHaveLength(0);
    expect(f.clean!.items.length).toBeGreaterThan(0);
    // Crossfade into the next slide draws the incoming slide's content too.
    const end = lesson.slides[0].duration;
    const fade = evaluate(lesson, end - 0.2);
    expect(fade.incomingClean?.items.length).toBeGreaterThan(0);
  });

  const barrett = "/mnt/project-files/pathology-bites/lesson-studio-v2/barrett-script-lesson.json";
  it.runIf(existsSync(barrett))("rebuilds Barrett with no manual timing", () => {
    const res = importScript(readFileSync(barrett, "utf8"));
    expect(res.lesson).toBeTruthy();
    const lesson = lessonFromScript(res.lesson!);
    expect(lesson.slides).toHaveLength(7);
    for (const s of lesson.slides) for (const el of s.elements) expect(el.cue).toBeDefined();
    expect(lesson.slides.some((s) => s.elements.some((e) => e.kind === "camera"))).toBe(true);
    expect(lesson.slides.some((s) => s.elements.some((e) => e.kind === "spotlight"))).toBe(true);
  });
});
