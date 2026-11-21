import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { importScript } from "@/shared/lesson/script/import";
import { computeTimeline, scriptCaptions } from "@/shared/lesson/script/timeline";
import {
  drawScriptFrame,
  scriptImageUrls,
  type Ctx2D,
  type DrawableImage,
} from "@/shared/lesson/script/draw";

const lesson = importScript(
  readFileSync(join(process.cwd(), "docs/lesson-studio/barrett-script-lesson.json"), "utf8")
).lesson!;
const timeline = computeTimeline(lesson);

/** A stand-in 2D context that records calls and measures text at 0.5em a character. */
function fakeCtx() {
  const calls: Array<{ name: string; args: unknown[]; alpha: number }> = [];
  const state: Record<string, unknown> = { globalAlpha: 1, font: "10px sans-serif" };
  const stack: Record<string, unknown>[] = [];
  const ctx = new Proxy(state, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === "save") return () => stack.push({ ...target });
      if (prop === "restore")
        return () => {
          const s = stack.pop();
          if (s) Object.assign(target, s);
        };
      if (prop === "measureText")
        return (t: string) => {
          const px = Number(/(\d+(?:\.\d+)?)px/.exec(String(target.font))?.[1] ?? 10);
          return { width: t.length * px * 0.5 };
        };
      return (...args: unknown[]) => {
        calls.push({ name: prop, args, alpha: Number(target.globalAlpha) });
      };
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as Ctx2D, calls, stack };
}

const fakeImage = (w: number, h: number) => ({ width: w, height: h }) as unknown as DrawableImage;
const images = new Map(scriptImageUrls(lesson).map((u) => [u, fakeImage(1000, 600)]));

describe("drawScriptFrame", () => {
  it("lists every picture the lesson shows", () => {
    expect(scriptImageUrls(lesson)).toHaveLength(2);
  });

  it("draws every frame of Barrett without throwing and leaves the context balanced", () => {
    const { ctx, stack } = fakeCtx();
    const captions = scriptCaptions(lesson, timeline);
    for (let t = 0; t <= timeline.duration; t += 0.25) {
      drawScriptFrame(ctx, 1280, lesson, timeline, t, images, { captions });
      expect(stack).toHaveLength(0);
    }
  });

  it("paints the warm background and the title at the start", () => {
    const { ctx, calls } = fakeCtx();
    drawScriptFrame(ctx, 1920, lesson, timeline, 4, images);
    expect(calls[0]).toMatchObject({ name: "fillRect", args: [0, 0, 1920, 1080] });
    const texts = calls.filter((c) => c.name === "fillText").map((c) => c.args[0]);
    // The title is drawn letter by letter (tracking), so compare without spaces.
    expect(texts.join("").replace(/\s/g, "")).toContain("Barrettesophagus");
  });

  it("draws the scene picture on an image scene and skips it when the picture is missing", () => {
    const t = timeline.scenes[2].start + 2;
    const withImg = fakeCtx();
    drawScriptFrame(withImg.ctx, 1920, lesson, timeline, t, images);
    expect(withImg.calls.some((c) => c.name === "drawImage")).toBe(true);
    const without = fakeCtx();
    drawScriptFrame(without.ctx, 1920, lesson, timeline, t, new Map());
    expect(without.calls.some((c) => c.name === "drawImage")).toBe(false);
  });

  it("burns in the caption for the sentence being spoken", () => {
    const captions = scriptCaptions(lesson, timeline);
    const c = captions[3];
    const { ctx, calls } = fakeCtx();
    drawScriptFrame(ctx, 1920, lesson, timeline, (c.start + c.end) / 2, images, { captions });
    const texts = calls.filter((x) => x.name === "fillText").map((x) => String(x.args[0]));
    expect(texts.join(" ")).toContain(c.text.split(" ")[0]);
  });

  it("crossfades into the next scene over the last half second", () => {
    const s0 = timeline.scenes[0];
    const { ctx, calls } = fakeCtx();
    drawScriptFrame(ctx, 1920, lesson, timeline, s0.start + s0.duration - 0.2, images);
    const next = lesson.scenes[1].heading!;
    const faded = calls.filter((c) => c.name === "fillText" && String(c.args[0]).length === 1);
    // The heading is drawn letter by letter (tracking) with partial opacity.
    expect(next.length).toBeGreaterThan(0);
    expect(faded.some((c) => c.alpha > 0 && c.alpha < 1)).toBe(true);
  });
});
