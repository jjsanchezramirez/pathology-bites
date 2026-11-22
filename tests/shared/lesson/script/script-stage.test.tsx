import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

vi.mock("@/shared/fonts/lesson-fonts", () => ({ lessonSans: { className: "lesson-sans" } }));

import { ScriptStage } from "@/shared/components/explainer/script-stage";
import { importScript } from "@/shared/lesson/script/import";
import { computeTimeline } from "@/shared/lesson/script/timeline";

const lesson = importScript(
  readFileSync(join(process.cwd(), "docs/lesson-studio/barrett-script-lesson.json"), "utf8")
).lesson!;
const timeline = computeTimeline(lesson);

const render = (time: number) =>
  renderToStaticMarkup(createElement(ScriptStage, { lesson, timeline, time }));

describe("ScriptStage with the Barrett lesson", () => {
  it("renders every scene from start to end without throwing", () => {
    for (let t = 0; t <= timeline.duration + 1; t += 0.25) expect(() => render(t)).not.toThrow();
  });

  it("shows each scene's words once its sentences have been spoken", () => {
    const end = (i: number) => timeline.scenes[i].start + timeline.scenes[i].duration - 0.6;
    expect(render(end(0))).toContain("Diagnosis and dysplasia grading");
    expect(render(end(1))).toContain("You need both. A biopsy alone cannot make the diagnosis.");
    expect(render(end(2))).toContain("Row of nuclei");
    expect(render(end(4))).toContain("Intramucosal carcinoma");
    expect(render(end(6))).toContain("Atypia that reaches the surface is dysplasia");
  });

  it("zooms the picture on the zoom sentence and not before", () => {
    const s = timeline.scenes[3];
    const before = render(s.start + s.beats[1].start + 0.9);
    const during = render(s.start + s.beats[2].start + 1.5);
    expect(before).not.toMatch(/scale\(/);
    expect(during).toMatch(/scale\(\d/);
  });

  it("uses no all-caps styling or text shadows", () => {
    const html = render(timeline.scenes[2].start + 6);
    expect(html).not.toMatch(/uppercase|text-shadow/i);
  });
});
