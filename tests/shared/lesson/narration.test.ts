import { describe, it, expect } from "vitest";
import {
  splitSentences,
  linesFromScript,
  parseWav,
  encodeWav,
  decodeTtsAudio,
  trimSilence,
  resample,
  estimateWordTimings,
  refineWordTimings,
  assembleNarration,
  retimeSlide,
  applyNarrationCues,
  type Pcm16,
} from "@/shared/lesson/narration";
import type { Lesson, Slide, TextElement } from "@/shared/lesson/types";

const tone = (sec: number, rate = 24000, amp = 8000): Int16Array =>
  Int16Array.from({ length: Math.round(sec * rate) }, (_, i) => Math.round(amp * Math.sin(i / 5)));
const silence = (sec: number, rate = 24000) => new Int16Array(Math.round(sec * rate));
const cat = (...parts: Int16Array[]) => {
  const out = new Int16Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

describe("splitSentences", () => {
  it("splits on terminal punctuation and keeps abbreviations", () => {
    expect(
      splitSentences("Barrett is metaplasia. It needs goblet cells, e.g. on H&E! Right?")
    ).toEqual(["Barrett is metaplasia.", "It needs goblet cells, e.g. on H&E!", "Right?"]);
  });
  it("does not split decimals", () => {
    expect(splitSentences("Risk is 0.5 percent a year.")).toEqual(["Risk is 0.5 percent a year."]);
  });
  it("keeps a trailing fragment", () => {
    expect(splitSentences("One. Two without stop")).toEqual(["One.", "Two without stop"]);
  });
});

describe("linesFromScript", () => {
  it("keeps ids and element links for unchanged sentences", () => {
    let n = 0;
    const id = () => `n${++n}`;
    const prev = [
      { id: "a", text: "First.", elementIds: ["e1"] },
      { id: "b", text: "Second.", elementIds: ["e2"] },
    ];
    const next = linesFromScript("New opener. Second. First.", prev, id);
    expect(next.map((l) => [l.text, l.id, l.elementIds])).toEqual([
      ["New opener.", "n1", []],
      ["Second.", "b", ["e2"]],
      ["First.", "a", ["e1"]],
    ]);
  });
  it("keeps a lightly edited sentence's links by position", () => {
    const prev = [{ id: "a", text: "Low grade dysplasia.", elementIds: ["e1"] }];
    const next = linesFromScript("Low-grade dysplasia.", prev, () => "x");
    expect(next[0]).toMatchObject({ id: "a", elementIds: ["e1"] });
  });
});

describe("WAV round trip", () => {
  it("encodes and parses 16-bit mono", () => {
    const pcm: Pcm16 = {
      sampleRate: 24000,
      samples: Int16Array.from([0, 1000, -1000, 32767, -32768]),
    };
    const back = parseWav(encodeWav(pcm));
    expect(back.sampleRate).toBe(24000);
    expect(Array.from(back.samples)).toEqual(Array.from(pcm.samples));
  });
  it("sniffs raw L16 and reads its rate from the mime type", () => {
    const raw = new Uint8Array([0x10, 0x00, 0xf0, 0xff]);
    const pcm = decodeTtsAudio(raw, "audio/L16;codec=pcm;rate=16000");
    expect(pcm.sampleRate).toBe(16000);
    expect(Array.from(pcm.samples)).toEqual([16, -16]);
  });
  it("tolerates a streaming data size of 0xFFFFFFFF", () => {
    const wav = encodeWav({ sampleRate: 24000, samples: Int16Array.from([5, 6, 7]) });
    new DataView(wav.buffer).setUint32(40, 0xffffffff, true);
    expect(Array.from(parseWav(wav).samples)).toEqual([5, 6, 7]);
  });
});

describe("trimSilence", () => {
  it("drops edge silence but keeps a short margin", () => {
    const pcm = { sampleRate: 24000, samples: cat(silence(0.5), tone(1), silence(0.7)) };
    const t = trimSilence(pcm);
    const sec = t.samples.length / 24000;
    expect(sec).toBeGreaterThan(1.0);
    expect(sec).toBeLessThan(1.12);
  });
  it("returns empty for pure silence", () => {
    expect(trimSilence({ sampleRate: 24000, samples: silence(1) }).samples.length).toBe(0);
  });
});

describe("resample", () => {
  it("changes length by the rate ratio", () => {
    const r = resample({ sampleRate: 48000, samples: tone(1, 48000) }, 24000);
    expect(r.samples.length).toBe(24000);
  });
});

describe("estimateWordTimings", () => {
  it("covers the window in order and gives longer words more time", () => {
    const w = estimateWordTimings("Barrett esophagus is metaplasia.", 2, 4);
    expect(w).toHaveLength(4);
    expect(w[0].start).toBe(2);
    expect(w[3].end).toBe(4);
    for (let i = 1; i < w.length; i++) expect(w[i].start).toBeGreaterThanOrEqual(w[i - 1].end);
    const dur = (i: number) => w[i].end - w[i].start;
    expect(dur(3)).toBeGreaterThan(dur(2)); // "metaplasia." vs "is"
  });
  it("leaves a gap after a comma", () => {
    const w = estimateWordTimings("Goblet cells, not pseudogoblets", 0, 3);
    expect(w[2].start - w[1].end).toBeGreaterThan(0.1);
  });
});

describe("refineWordTimings", () => {
  it("takes recognizer times for matching words and keeps script spelling", () => {
    const est = estimateWordTimings("High grade dysplasia", 0, 1.5);
    const heard = [
      { text: "high", start: 0.1, end: 0.3 },
      { text: "grade", start: 0.35, end: 0.6 },
      { text: "displasia", start: 0.7, end: 1.4 },
    ];
    const { timings, matched } = refineWordTimings(est, heard);
    expect(matched).toBe(2);
    expect(timings[0]).toEqual({ text: "High", start: 0.1, end: 0.3 });
    expect(timings[2].text).toBe("dysplasia");
    expect(timings[2].start).toBeGreaterThanOrEqual(timings[1].start);
  });
});

describe("assembleNarration", () => {
  it("lays clips out per slide with exact cues and slide durations", () => {
    const clip = (sec: number) => ({ sampleRate: 24000, samples: tone(sec) });
    const out = assembleNarration(
      ["s1", "s2", "s3"],
      [
        { slideId: "s1", lineId: "a", text: "One two.", pcm: clip(1) },
        { slideId: "s1", lineId: "b", text: "Three.", pcm: clip(0.5) },
        { slideId: "s3", lineId: "c", text: "Four five six.", pcm: clip(2) },
      ],
      { s2: 5 },
      { leadIn: 0.4, gap: 0.35, tail: 0.9 }
    );
    expect(out.slides[0]).toEqual({
      slideId: "s1",
      duration: 0.4 + 1 + 0.35 + 0.5 + 0.9,
      lines: [
        { lineId: "a", start: 0.4, end: 1.4 },
        { lineId: "b", start: 1.75, end: 2.25 },
      ],
    });
    expect(out.slides[1]).toEqual({ slideId: "s2", duration: 5, lines: [] });
    expect(out.slides[2].lines[0]).toEqual({ lineId: "c", start: 0.4, end: 2.4 });
    const total = out.slides.reduce((n, s) => n + s.duration, 0);
    expect(out.duration).toBeCloseTo(total, 3);
    expect(out.pcm.samples.length).toBe(Math.round(out.duration * 24000));
    // Word times are absolute: slide 3 starts after 3.15 + 5 s.
    const four = out.wordTimings.find((w) => w.text === "Four")!;
    expect(four.start).toBeCloseTo(3.15 + 5 + 0.4, 3);
    expect(out.transcript).toBe("One two. Three. Four five six.");
  });
});

const text = (id: string, start: number, visible: number): TextElement =>
  ({
    id,
    kind: "text",
    text: id,
    rect: { x: 0, y: 0, w: 10, h: 10 },
    timing: { start, fadeIn: 0.5, hold: visible - 0.9, fadeOut: 0.4 },
  }) as TextElement;

const slide = (): Slide => ({
  id: "s1",
  duration: 10,
  transitionIn: { kind: "crossfade", duration: 0.5 },
  initialFraming: { x: 50, y: 50, scale: 1 },
  elements: [text("title", 0, 10), text("label", 4, 3), text("later", 6, 4)],
  narration: {
    lines: [
      { id: "a", text: "Intro.", elementIds: [] },
      { id: "b", text: "Here is the label.", elementIds: ["label"] },
    ],
  },
});

const end = (el: { timing: { start: number; fadeIn: number; hold: number; fadeOut: number } }) =>
  el.timing.start + el.timing.fadeIn + el.timing.hold + el.timing.fadeOut;

describe("retimeSlide", () => {
  const cue = {
    slideId: "s1",
    duration: 14,
    lines: [
      { lineId: "a", start: 0.4, end: 3 },
      { lineId: "b", start: 3.4, end: 9 },
    ],
  };
  const out = retimeSlide(slide(), cue);

  it("takes the narrated duration", () => {
    expect(out.duration).toBe(14);
  });
  it("brings a linked element in as its line starts and holds it through the line", () => {
    const label = out.elements[1];
    expect(label.timing.start).toBeCloseTo(3.3, 3);
    expect(end(label)).toBeGreaterThanOrEqual(9);
  });
  it("keeps full-length elements full length", () => {
    expect(out.elements[0].timing.start).toBe(0);
    expect(end(out.elements[0])).toBeCloseTo(14, 3);
  });
  it("scales unlinked elements and keeps them inside the slide", () => {
    const later = out.elements[2];
    expect(later.timing.start).toBeCloseTo(6 * 1.4, 3);
    expect(end(later)).toBeLessThanOrEqual(14 + 1e-6);
  });
  it("writes line times back to the script", () => {
    expect(out.narration?.lines[1]).toMatchObject({ start: 3.4, end: 9 });
  });
});

describe("applyNarrationCues", () => {
  it("leaves slides without narrated lines alone", () => {
    const lesson = {
      id: null,
      title: "t",
      description: "",
      aspectRatio: "16:9",
      audio: null,
      slides: [slide()],
    } as Lesson;
    const same = applyNarrationCues(lesson, [{ slideId: "s1", duration: 3, lines: [] }]);
    expect(same.slides[0].duration).toBe(10);
  });
});
