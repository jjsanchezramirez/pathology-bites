import { describe, it, expect } from "vitest";
import { batchNarration, joinNarrationParts, type Pcm16 } from "@/shared/lesson/narration";
import { isNarrationPartKey, narrationPartKey } from "@/shared/lesson/narration-parts";
import { encodeMp3 } from "@/shared/services/mp3";

const slide = (id: string, n: number) => ({
  slideId: id,
  duration: 4,
  lines: Array.from({ length: n }, (_, i) => ({ id: `${id}-${i}`, text: "A sentence." })),
});

const tone = (seconds: number, sampleRate = 24000): Pcm16 => {
  const samples = new Int16Array(Math.round(seconds * sampleRate));
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.round(6000 * Math.sin((i * 2 * Math.PI * 220) / sampleRate));
  }
  return { sampleRate, samples };
};

describe("batchNarration", () => {
  it("keeps everything in one request when it fits", () => {
    expect(batchNarration([slide("a", 3), slide("b", 4)], 10)).toHaveLength(1);
  });

  it("splits between slides, never inside one", () => {
    const batches = batchNarration(
      [slide("a", 20), slide("b", 20), slide("c", 0), slide("d", 10), slide("e", 30)],
      45
    );
    expect(batches.map((b) => b.map((s) => s.slideId))).toEqual([
      ["a", "b", "c"],
      ["d", "e"],
    ]);
    for (const b of batches) {
      expect(b.reduce((n, s) => n + s.lines.length, 0)).toBeLessThanOrEqual(45);
    }
  });

  it("says which slide is too long to narrate", () => {
    expect(() => batchNarration([slide("a", 50)], 45)).toThrow(/50 sentences.*45/);
  });
});

describe("joinNarrationParts", () => {
  it("joins audio in order and shifts word times by the parts before", () => {
    const joined = joinNarrationParts([
      { pcm: tone(2), wordTimings: [{ text: "one", start: 0.4, end: 0.8 }], transcript: "One." },
      { pcm: tone(1.5), wordTimings: [{ text: "two", start: 0.4, end: 0.9 }], transcript: "Two." },
    ]);
    expect(joined.duration).toBe(3.5);
    expect(joined.pcm.samples.length).toBe(24000 * 3.5);
    expect(joined.wordTimings).toEqual([
      { text: "one", start: 0.4, end: 0.8 },
      { text: "two", start: 2.4, end: 2.9 },
    ]);
    expect(joined.transcript).toBe("One. Two.");
  });

  it("refuses an empty run", () => {
    expect(() => joinNarrationParts([])).toThrow();
  });
});

describe("narration part keys", () => {
  const session = "5c1e7a52-9b3d-4f0e-8a61-2d4b7c9e0f13";
  it("accepts only this session's parts", () => {
    expect(isNarrationPartKey(narrationPartKey(session, 3), session)).toBe(true);
    expect(
      isNarrationPartKey(narrationPartKey(session, 3), "00000000-0000-4000-8000-000000000000")
    ).toBe(false);
    expect(isNarrationPartKey("audio/some-real-track.mp3", session)).toBe(false);
    expect(isNarrationPartKey(`narration-parts/${session}/../../x.wav`, session)).toBe(false);
  });
});

describe("encodeMp3", () => {
  it("makes an MP3 about an eighth the size of the WAV", () => {
    const pcm = tone(5);
    const mp3 = encodeMp3(pcm);
    // MPEG frame sync: 11 set bits.
    expect(mp3[0]).toBe(0xff);
    expect(mp3[1] & 0xe0).toBe(0xe0);
    const wavBytes = pcm.samples.length * 2;
    expect(mp3.length).toBeLessThan(wavBytes / 6);
    expect(mp3.length).toBeGreaterThan(wavBytes / 12);
  });
});
