import { describe, it, expect } from "vitest";
import { isLessonShape, normalizeStoredSequence } from "@/shared/lesson/normalize";
import { emptyScriptLesson, type ScriptLesson } from "@/shared/lesson/script/types";
import { emptyLesson } from "@/shared/lesson/types";
import { slideStarts } from "@/shared/lesson/evaluate";
import { retryDelaySeconds } from "@/shared/services/gemini-tts";

describe("stored sequences", () => {
  it("passes canvas lessons through and rejects unknown shapes", () => {
    const c = emptyLesson();
    expect(isLessonShape(c)).toBe(true);
    expect(normalizeStoredSequence(c)).not.toBeNull();
    expect(normalizeStoredSequence({ foo: 1 })).toBeNull();
  });

  it("converts rows from the retired script studio to canvas lessons", () => {
    const s: ScriptLesson = {
      ...emptyScriptLesson(),
      title: "Barrett",
      scenes: [
        {
          id: "s1",
          template: "takehome",
          heading: "Take-home",
          beats: [{ id: "b1", say: "Goblet cells make the diagnosis.", text: "Goblet cells" }],
        },
      ],
    };
    const out = normalizeStoredSequence(s)!;
    expect(isLessonShape(out)).toBe(true);
    expect(out.title).toBe("Barrett");
    expect(out.slides).toHaveLength(1);
    expect(out.slides[0].look).toBe("clean");
    expect(out.audio).toBeNull();
  });

  it("keeps a narrated script's audio and recorded sentence times", () => {
    const s: ScriptLesson = {
      ...emptyScriptLesson(),
      audio: { url: "https://audio.example/a.wav", duration: 5.4, scriptHash: "x" },
      scenes: [
        {
          id: "s1",
          template: "takehome",
          heading: "Points",
          duration: 5.4,
          beats: [
            { id: "b1", say: "One.", text: "One", start: 0.4, end: 1.6 },
            { id: "b2", say: "Two.", text: "Two", start: 2.1, end: 4.5 },
          ],
        },
      ],
    };
    const out = normalizeStoredSequence(s)!;
    expect(out.audio?.url).toBe("https://audio.example/a.wav");
    expect(out.audio).not.toHaveProperty("scriptHash");
    const lines = out.slides[0].narration!.lines;
    expect(lines.map((l) => [l.start, l.end])).toEqual([
      [0.4, 1.6],
      [2.1, 4.5],
    ]);
    // Slide length follows the recorded narration, so the track stays in step.
    expect(slideStarts(out).duration).toBeCloseTo(5.4, 2);
  });
});

describe("Gemini retry delay", () => {
  it("reads the delay Gemini asks for", () => {
    expect(retryDelaySeconds('"retryDelay": "23s"')).toBe(23);
    expect(retryDelaySeconds("Please retry in 7.5s.")).toBe(7.5);
    expect(retryDelaySeconds("quota exceeded")).toBeNull();
  });
});
