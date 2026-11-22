import { describe, it, expect } from "vitest";
import {
  applyScriptNarration,
  clearScriptNarration,
  computeTimeline,
  estimateSpeech,
  isNarrationStale,
  locate,
  narrationSlides,
  scriptCaptions,
  scriptHash,
  scriptImageUrls,
  scriptStepPoints,
} from "@/shared/lesson/script/timeline";
import { scriptLessonFromJson } from "@/shared/lesson/script/import";
import { DEFAULT_PACING } from "@/shared/lesson/narration";
import type { ScriptLesson } from "@/shared/lesson/script/types";

function lesson(): ScriptLesson {
  return scriptLessonFromJson({
    title: "T",
    scenes: [
      {
        id: "s1",
        template: "title",
        heading: "Hello",
        beats: [{ id: "b1", say: "One two three four five.", text: "Sub" }],
      },
      {
        id: "s2",
        template: "image",
        heading: "Pic",
        image: "https://example.com/p.jpg",
        beats: [
          {
            id: "b2",
            say: "Look here at this.",
            text: "Here",
            region: { x: 10, y: 10, w: 20, h: 20 },
          },
          { id: "b3", say: "And there.", text: "There" },
        ],
      },
      { id: "s3", template: "takehome", heading: "Bye", beats: [{ id: "b4", say: "" }] },
    ],
  }).lesson!;
}

describe("estimated timeline", () => {
  it("paces sentences like the narration does", () => {
    const tl = computeTimeline(lesson());
    const { leadIn, gap, tail } = DEFAULT_PACING;
    const s2 = tl.scenes[1];
    expect(s2.beats[0].start).toBeCloseTo(leadIn);
    expect(s2.beats[1].start).toBeCloseTo(s2.beats[0].end + gap, 2);
    expect(s2.duration).toBeCloseTo(s2.beats[1].end + tail, 2);
    expect(tl.scenes[1].start).toBeCloseTo(tl.scenes[0].duration, 2);
    expect(tl.duration).toBeCloseTo(
      tl.scenes.reduce((n, s) => n + s.duration, 0),
      2
    );
  });

  it("gives a scene with no narration a short fixed length", () => {
    const tl = computeTimeline(lesson());
    expect(tl.scenes[2].duration).toBe(3);
  });

  it("estimates speech from word count with a floor", () => {
    expect(estimateSpeech("")).toBe(0);
    expect(estimateSpeech("Hi.")).toBeCloseTo(1.2);
    expect(estimateSpeech(Array(26).fill("w").join(" "))).toBeCloseTo(10);
  });
});

describe("locate", () => {
  it("finds the scene and the last started beat", () => {
    const tl = computeTimeline(lesson());
    const s2 = tl.scenes[1];
    expect(locate(tl, 0).sceneIndex).toBe(0);
    const p = locate(tl, s2.start + s2.beats[1].start + 0.01);
    expect(p).toMatchObject({ sceneIndex: 1, beatIndex: 1 });
    expect(locate(tl, s2.start + 0.1).beatIndex).toBe(-1);
    expect(locate(tl, tl.duration + 10).sceneIndex).toBe(2);
  });
});

describe("narration", () => {
  it("builds one request slide per scene and skips empty sentences", () => {
    const slides = narrationSlides(lesson());
    expect(slides.map((s) => s.slideId)).toEqual(["s1", "s2", "s3"]);
    expect(slides[1].lines).toEqual([
      { id: "b2", text: "Look here at this." },
      { id: "b3", text: "And there." },
    ]);
    expect(slides[2].lines).toEqual([]);
  });

  it("applies cue times, then marks the narration stale when a sentence changes", () => {
    const l = lesson();
    const narrated = applyScriptNarration(
      l,
      [
        { slideId: "s1", duration: 4, lines: [{ lineId: "b1", start: 0.4, end: 2.6 }] },
        {
          slideId: "s2",
          duration: 6,
          lines: [
            { lineId: "b2", start: 0.4, end: 2 },
            { lineId: "b3", start: 2.5, end: 4.8 },
          ],
        },
      ],
      { url: "https://example.com/a.wav", duration: 13, voice: "Charon" } as never
    );
    const tl = computeTimeline(narrated);
    expect(tl.scenes[0].duration).toBe(4);
    expect(tl.scenes[1].beats[1]).toEqual({ start: 2.5, end: 4.8 });
    expect(isNarrationStale(narrated)).toBe(false);

    const edited: ScriptLesson = {
      ...narrated,
      scenes: narrated.scenes.map((s) =>
        s.id === "s2"
          ? { ...s, beats: s.beats.map((b) => (b.id === "b3" ? { ...b, say: "Changed." } : b)) }
          : s
      ),
    };
    expect(isNarrationStale(edited)).toBe(true);

    const cleared = clearScriptNarration(narrated);
    expect(cleared.audio).toBeNull();
    expect(cleared.scenes[1].beats[0].start).toBeUndefined();
    expect(cleared.scenes[1].duration).toBeUndefined();
  });

  it("keeps narrated sentences on the audio when a wordless beat sits between them", () => {
    const l = lesson();
    l.scenes[1].beats.splice(1, 0, { id: "bx", say: "", text: "Shown only" });
    const narrated = applyScriptNarration(
      l,
      [
        {
          slideId: "s2",
          duration: 6,
          lines: [
            { lineId: "b2", start: 0.4, end: 2 },
            { lineId: "b3", start: 2.35, end: 4.8 },
          ],
        },
      ],
      { url: "https://example.com/a.wav", duration: 13 } as never
    );
    const beats = computeTimeline(narrated).scenes[1].beats;
    expect(beats[1].start).toBeCloseTo(2);
    expect(beats[2]).toEqual({ start: 2.35, end: 4.8 });
  });

  it("ignores stored times when there is no audio", () => {
    const l = lesson();
    l.scenes[1].beats[0].start = 50;
    l.scenes[1].beats[0].end = 51;
    expect(computeTimeline(l).scenes[1].beats[0].start).toBeCloseTo(DEFAULT_PACING.leadIn);
  });

  it("hash changes with wording and order, not with on-screen words", () => {
    const l = lesson();
    const h = scriptHash(l);
    const shown = {
      ...l,
      scenes: l.scenes.map((s) => ({ ...s, beats: s.beats.map((b) => ({ ...b, text: "x" })) })),
    };
    expect(scriptHash(shown)).toBe(h);
    const reordered = { ...l, scenes: [l.scenes[1], l.scenes[0], l.scenes[2]] };
    expect(scriptHash(reordered)).not.toBe(h);
  });
});

describe("helpers", () => {
  it("collects image urls, step points and captions", () => {
    const l = lesson();
    const tl = computeTimeline(l);
    expect(scriptImageUrls(l)).toEqual(["https://example.com/p.jpg"]);
    const steps = scriptStepPoints(tl);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    const caps = scriptCaptions(l, tl);
    expect(caps[0].text).toBe("One two three four five.");
    expect(caps.every((c) => c.end > c.start)).toBe(true);
  });
});
