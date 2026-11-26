import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  importScript,
  lintScriptLesson,
  scriptLessonFromJson,
  scriptLessonFromText,
} from "@/shared/lesson/script/import";
import { isScriptLesson } from "@/shared/lesson/script/types";

const barrett = readFileSync(
  join(process.cwd(), "docs/lesson-studio/barrett-script-lesson.json"),
  "utf8"
);

describe("scriptLessonFromJson", () => {
  it("accepts plain-string beats and fills ids", () => {
    const r = scriptLessonFromJson({
      title: "T",
      scenes: [{ template: "ladder", heading: "H", beats: ["One.", { say: "Two.", text: "Two" }] }],
    });
    expect(r.error).toBeUndefined();
    const s = r.lesson!.scenes[0];
    expect(s.beats.map((b) => b.say)).toEqual(["One.", "Two."]);
    expect(s.beats.every((b) => b.id.startsWith("beat-"))).toBe(true);
    expect(isScriptLesson(r.lesson)).toBe(true);
  });

  it("de-duplicates repeated ids", () => {
    const r = scriptLessonFromJson({
      scenes: [
        {
          id: "a",
          template: "takehome",
          heading: "x",
          beats: [
            { id: "b", say: "1" },
            { id: "b", say: "2" },
          ],
        },
        { id: "a", template: "takehome", heading: "y", beats: ["3"] },
      ],
    });
    const ids = r.lesson!.scenes.map((s) => s.id);
    expect(new Set(ids).size).toBe(2);
    const beatIds = r.lesson!.scenes[0].beats.map((b) => b.id);
    expect(beatIds[0]).toBe("b");
    expect(beatIds[1]).not.toBe("b");
  });

  it("turns an image URL string into an image object", () => {
    const r = scriptLessonFromJson({
      scenes: [
        { template: "image", heading: "x", image: "https://example.com/a.jpg", beats: ["Look."] },
      ],
    });
    expect(r.lesson!.scenes[0].image).toEqual({ url: "https://example.com/a.jpg" });
  });

  it("reports where a bad template is", () => {
    const r = scriptLessonFromJson({ scenes: [{ template: "carousel", beats: [] }] });
    expect(r.lesson).toBeNull();
    expect(r.error).toMatch(/scenes\.0\.template/);
  });
});

describe("scriptLessonFromText", () => {
  it("reads scenes, pipes and sentences", () => {
    const r = scriptLessonFromText(
      [
        "# ladder: The ladder",
        "Then grade it. Start at the bottom.",
        "Negative: matures. | Negative | Matures",
      ].join("\n")
    );
    const s = r.lesson!.scenes[0];
    expect(s.template).toBe("ladder");
    expect(s.heading).toBe("The ladder");
    expect(s.beats.map((b) => b.say)).toEqual([
      "Then grade it.",
      "Start at the bottom.",
      "Negative: matures.",
    ]);
    expect(s.beats[2]).toMatchObject({ text: "Negative", detail: "Matures" });
  });

  it("accepts take-home with a hyphen and rejects an empty script", () => {
    expect(scriptLessonFromText("# take-home: Done\nBye.").lesson!.scenes[0].template).toBe(
      "takehome"
    );
    expect(scriptLessonFromText("   ").error).toBeTruthy();
  });
});

describe("importScript and export", () => {
  it("imports the Barrett lesson with no warnings", () => {
    const r = importScript(barrett);
    expect(r.error).toBeUndefined();
    expect(r.lesson!.scenes.map((s) => s.template)).toEqual([
      "title",
      "compare",
      "image",
      "image",
      "ladder",
      "ladder",
      "takehome",
    ]);
    expect(r.warnings).toEqual([]);
  });

  it("says when JSON is broken", () => {
    expect(importScript("{ nope").error).toMatch(/valid JSON/);
  });
});

describe("lintScriptLesson", () => {
  it("flags crowding, missing pictures and zooms without a region", () => {
    const r = scriptLessonFromJson({
      scenes: [
        { template: "image", heading: "", beats: [{ say: "Zoom.", mark: "zoom" }] },
        {
          template: "ladder",
          heading: "L",
          beats: Array.from({ length: 7 }, (_, i) => ({ say: `S${i}.`, text: `S${i}` })),
        },
      ],
    });
    const w = r.warnings.join("\n");
    expect(w).toMatch(/no picture/);
    expect(w).toMatch(/no heading/);
    expect(w).toMatch(/zooms but has no region/);
    expect(w).toMatch(/7 steps/);
    expect(lintScriptLesson(importScript(barrett).lesson!)).toEqual([]);
  });
});
