// Voiceover helpers shared by the narration API route and the lesson studio.
//
// The narration track is built one sentence at a time: each sentence is spoken
// by TTS as its own clip, trimmed of edge silence, and laid end to end with
// fixed pauses. Because we place every clip ourselves, each sentence's start
// and end are exact. Word times inside a sentence are estimated from syllable
// weight (no aligner needed), which is typically within ~0.2–0.3 s.
//
// Everything here is pure (no Node or browser APIs) so it can be unit tested
// and used on both sides.

import type { Lesson, NarrationLine, Slide, SlideElement, WordTiming } from "./types";

// ---------------------------------------------------------------------------
// Speech estimate
// ---------------------------------------------------------------------------

/** Speaking rate for estimates, words per second (~155 words a minute). */
const WORDS_PER_SECOND = 2.6;
const MIN_SENTENCE = 1.2;

/** Estimated seconds to speak a sentence, used to time lessons before any voice exists. */
export function estimateSpeech(text: string): number {
  const n = text.trim().split(/\s+/).filter(Boolean).length;
  if (n === 0) return 0;
  return Math.max(MIN_SENTENCE, n / WORDS_PER_SECOND);
}

// ---------------------------------------------------------------------------
// Script → lines
// ---------------------------------------------------------------------------

/** Split a paragraph into sentences, keeping abbreviations like "e.g." intact. */
export function splitSentences(script: string): string[] {
  const text = script.replace(/\s+/g, " ").trim();
  if (!text) return [];
  const out: string[] = [];
  let buf = "";
  const ABBREV = /\b(e\.g|i\.e|vs|etc|Dr|Fig|approx|cf)\.$/i;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    buf += ch;
    if (ch === "." || ch === "!" || ch === "?") {
      const next = text[i + 1];
      if (next !== undefined && next !== " ") continue;
      if (ch === "." && ABBREV.test(buf)) continue;
      out.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/**
 * Rebuild a slide's narration lines from an edited script, keeping each
 * existing line's id and element links when its text is unchanged (or when a
 * line at the same position was only lightly edited).
 */
export function linesFromScript(
  script: string,
  previous: NarrationLine[] = [],
  makeId: () => string
): NarrationLine[] {
  const sentences = splitSentences(script);
  const unused = new Set(previous);
  // Pass 1: exact text matches keep their line.
  const kept: (NarrationLine | undefined)[] = sentences.map((text) => {
    const hit = previous.find((l) => unused.has(l) && l.text === text);
    if (hit) unused.delete(hit);
    return hit;
  });
  // Pass 2: an edited sentence inherits the unmatched line at its position.
  sentences.forEach((_, i) => {
    if (kept[i]) return;
    const p = previous[i];
    if (p && unused.has(p)) {
      kept[i] = p;
      unused.delete(p);
    }
  });
  return sentences.map((text, i) => ({
    id: kept[i]?.id ?? makeId(),
    text,
    elementIds: kept[i]?.elementIds ?? [],
    // A sentence pinned on the timeline keeps its place while its text is unchanged.
    ...(kept[i]?.at != null && kept[i]?.text === text ? { at: kept[i]!.at } : {}),
  }));
}

export function scriptFromLines(lines: NarrationLine[] | undefined): string {
  return (lines ?? []).map((l) => l.text).join(" ");
}

// ---------------------------------------------------------------------------
// WAV / PCM (16-bit mono)
// ---------------------------------------------------------------------------

export interface Pcm16 {
  sampleRate: number;
  samples: Int16Array;
}

/** Parse a RIFF/WAVE file holding 16-bit PCM. Mixes down to mono if needed. */
export function parseWav(bytes: Uint8Array): Pcm16 {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) =>
    String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  if (bytes.length < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE") {
    throw new Error("Not a WAV file");
  }
  let off = 12;
  let sampleRate = 0;
  let channels = 1;
  let bits = 16;
  let dataStart = -1;
  let dataLen = 0;
  while (off + 8 <= bytes.length) {
    const id = tag(off);
    let size = dv.getUint32(off + 4, true);
    const body = off + 8;
    if (id === "fmt ") {
      const format = dv.getUint16(body, true);
      if (format !== 1 && format !== 0xfffe) throw new Error(`Unsupported WAV format ${format}`);
      channels = dv.getUint16(body + 2, true);
      sampleRate = dv.getUint32(body + 4, true);
      bits = dv.getUint16(body + 14, true);
    } else if (id === "data") {
      dataStart = body;
      // Streaming encoders sometimes write 0 or 0xFFFFFFFF; take the rest of the file.
      if (size === 0 || size === 0xffffffff || body + size > bytes.length)
        size = bytes.length - body;
      dataLen = size;
      break;
    }
    off = body + size + (size % 2);
  }
  if (dataStart < 0 || !sampleRate) throw new Error("WAV is missing fmt or data chunk");
  if (bits !== 16) throw new Error(`Expected 16-bit PCM, got ${bits}-bit`);
  const frames = Math.floor(dataLen / (2 * channels));
  const samples = new Int16Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += dv.getInt16(dataStart + (f * channels + c) * 2, true);
    samples[f] = Math.round(sum / channels);
  }
  return { sampleRate, samples };
}

/** Wrap raw little-endian 16-bit PCM bytes (Gemini's audio/L16 output) as Pcm16. */
export function pcmFromL16(bytes: Uint8Array, sampleRate: number): Pcm16 {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = Math.floor(bytes.length / 2);
  const samples = new Int16Array(n);
  for (let i = 0; i < n; i++) samples[i] = dv.getInt16(i * 2, true);
  return { sampleRate, samples };
}

/** Accept either a WAV file or raw L16 bytes (sniffed by the RIFF header). */
export function decodeTtsAudio(bytes: Uint8Array, mimeType: string | undefined): Pcm16 {
  const isRiff =
    bytes.length >= 4 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46;
  if (isRiff) return parseWav(bytes);
  const rate = Number(/rate=(\d+)/i.exec(mimeType ?? "")?.[1]) || 24000;
  return pcmFromL16(bytes, rate);
}

export function encodeWav(pcm: Pcm16): Uint8Array {
  const dataLen = pcm.samples.length * 2;
  const out = new Uint8Array(44 + dataLen);
  const dv = new DataView(out.buffer);
  const w = (o: number, s: string) => {
    for (let i = 0; i < 4; i++) out[o + i] = s.charCodeAt(i);
  };
  w(0, "RIFF");
  dv.setUint32(4, 36 + dataLen, true);
  w(8, "WAVE");
  w(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, pcm.sampleRate, true);
  dv.setUint32(28, pcm.sampleRate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  w(36, "data");
  dv.setUint32(40, dataLen, true);
  for (let i = 0; i < pcm.samples.length; i++) dv.setInt16(44 + i * 2, pcm.samples[i], true);
  return out;
}

/**
 * Trim leading/trailing silence. Uses 10 ms windows; a window is "voiced" when
 * its RMS exceeds `threshold` (fraction of full scale). Keeps a small margin so
 * consonants are not clipped.
 */
export function trimSilence(pcm: Pcm16, threshold = 0.01, marginSec = 0.03): Pcm16 {
  const { samples, sampleRate } = pcm;
  const win = Math.max(1, Math.round(sampleRate * 0.01));
  const limit = threshold * 32768;
  const voiced = (from: number) => {
    let sum = 0;
    const end = Math.min(samples.length, from + win);
    for (let i = from; i < end; i++) sum += samples[i] * samples[i];
    return Math.sqrt(sum / Math.max(1, end - from)) > limit;
  };
  let first = 0;
  while (first < samples.length && !voiced(first)) first += win;
  if (first >= samples.length) return { sampleRate, samples: new Int16Array(0) };
  let last = samples.length - win;
  while (last > first && !voiced(last)) last -= win;
  const margin = Math.round(marginSec * sampleRate);
  const start = Math.max(0, first - margin);
  const end = Math.min(samples.length, last + win + margin);
  return { sampleRate, samples: samples.slice(start, end) };
}

/** Resample (linear) when a clip comes back at a different rate than the track. */
export function resample(pcm: Pcm16, rate: number): Pcm16 {
  if (pcm.sampleRate === rate) return pcm;
  const ratio = pcm.sampleRate / rate;
  const n = Math.floor(pcm.samples.length / ratio);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * ratio;
    const i0 = Math.floor(x);
    const i1 = Math.min(pcm.samples.length - 1, i0 + 1);
    out[i] = Math.round(pcm.samples[i0] + (pcm.samples[i1] - pcm.samples[i0]) * (x - i0));
  }
  return { sampleRate: rate, samples: out };
}

// ---------------------------------------------------------------------------
// Word timing estimate
// ---------------------------------------------------------------------------

/** Rough spoken length of a word, in syllable units, plus pause weight for punctuation. */
export function wordWeight(word: string): number {
  const core = word.toLowerCase().replace(/[^a-z0-9]/g, "");
  let syl: number;
  if (/^\d+$/.test(core)) {
    syl = Math.max(1, core.length * 1.5); // digits read as words
  } else {
    const groups = core.replace(/e$/, "").match(/[aeiouy]+/g);
    syl = Math.max(1, groups?.length ?? 1);
    // Acronyms like "HGD", "IHC" are spelled out letter by letter.
    if (/^[A-Z]{2,5}$/.test(word.replace(/[^A-Za-z]/g, ""))) {
      syl = core.length;
    }
  }
  return syl;
}

function pauseAfter(word: string): number {
  if (/[.!?]["')\]]*$/.test(word)) return 0.6;
  if (/[,;:]["')\]]*$/.test(word)) return 0.45;
  if (/[—–-]$/.test(word)) return 0.35;
  return 0;
}

/**
 * Spread a sentence's words over [start, end] by syllable weight, leaving the
 * share a comma or dash would take as a gap after that word.
 */
export function estimateWordTimings(text: string, start: number, end: number): WordTiming[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length || end <= start) return [];
  const speech = words.map(wordWeight);
  const pauses = words.map((w, i) => (i === words.length - 1 ? 0 : pauseAfter(w)));
  const total = speech.reduce((a, b) => a + b, 0) + pauses.reduce((a, b) => a + b, 0);
  const unit = (end - start) / total;
  const out: WordTiming[] = [];
  let t = start;
  words.forEach((w, i) => {
    const s = t;
    const e = s + speech[i] * unit;
    out.push({ text: w, start: round3(s), end: round3(e) });
    t = e + pauses[i] * unit;
  });
  out[out.length - 1].end = round3(end);
  return out;
}

/**
 * Replace estimated word times with recognizer (e.g. Whisper) times where the
 * recognizer heard the same word nearby. The script's own spelling is kept;
 * words the recognizer missed or misheard keep their estimate, nudged so the
 * sequence stays in order.
 */
export function refineWordTimings(
  estimated: WordTiming[],
  recognized: WordTiming[],
  maxShift = 1.0
): { timings: WordTiming[]; matched: number } {
  const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");
  const rec = recognized.map((r) => ({ ...r, key: norm(r.text) }));
  let from = 0;
  let matched = 0;
  const out: WordTiming[] = estimated.map((w) => {
    const k = norm(w.text);
    let best = -1;
    for (let j = from; j < rec.length && rec[j].start <= w.start + maxShift; j++) {
      if (rec[j].key === k && Math.abs(rec[j].start - w.start) <= maxShift) {
        best = j;
        break;
      }
    }
    if (best < 0) return { ...w };
    from = best + 1;
    matched++;
    return {
      text: w.text,
      start: rec[best].start,
      end: Math.max(rec[best].end, rec[best].start + 0.05),
    };
  });
  // Keep order: an unmatched word sits between its matched neighbours.
  for (let i = 1; i < out.length; i++) {
    if (out[i].start < out[i - 1].start) out[i].start = out[i - 1].start;
    if (out[i].end < out[i].start) out[i].end = out[i].start + 0.05;
  }
  return {
    timings: out.map((w) => ({ ...w, start: round3(w.start), end: round3(w.end) })),
    matched,
  };
}

// ---------------------------------------------------------------------------
// Track assembly
// ---------------------------------------------------------------------------

export interface NarrationPacing {
  /** Silence at the start of every slide, before its first line. */
  leadIn: number;
  /** Pause between sentences on the same slide. */
  gap: number;
  /** Silence after a slide's last line (covers the next slide's transition). */
  tail: number;
}

export const DEFAULT_PACING: NarrationPacing = { leadIn: 0.4, gap: 0.35, tail: 0.9 };

export interface ClipInput {
  slideId: string;
  lineId: string;
  text: string;
  pcm: Pcm16;
}

export interface SlideCue {
  slideId: string;
  /** New slide duration, seconds. */
  duration: number;
  lines: { lineId: string; start: number; end: number }[];
}

export interface AssembledNarration {
  pcm: Pcm16;
  duration: number;
  slides: SlideCue[];
  wordTimings: WordTiming[];
  transcript: string;
}

/**
 * Lay clips end to end, slide by slide, in the given slide order. Slides with
 * no clips keep `fallbackDurations[slideId]` of silence so the track stays in
 * step with the lesson timeline.
 */
export function assembleNarration(
  slideOrder: string[],
  clips: ClipInput[],
  fallbackDurations: Record<string, number>,
  pacing: NarrationPacing = DEFAULT_PACING,
  sampleRate = 24000
): AssembledNarration {
  const sec = (n: number) => Math.round(n * sampleRate);
  const parts: Int16Array[] = [];
  let cursor = 0; // samples
  const push = (a: Int16Array) => {
    parts.push(a);
    cursor += a.length;
  };
  const silence = (s: number) => push(new Int16Array(sec(s)));

  const slides: SlideCue[] = [];
  const wordTimings: WordTiming[] = [];
  const transcript: string[] = [];

  for (const slideId of slideOrder) {
    const slideStart = cursor;
    const mine = clips.filter((c) => c.slideId === slideId);
    const lines: SlideCue["lines"] = [];
    if (!mine.length) {
      silence(fallbackDurations[slideId] ?? 3);
    } else {
      silence(pacing.leadIn);
      mine.forEach((clip, i) => {
        if (i > 0) silence(pacing.gap);
        const pcm = resample(clip.pcm, sampleRate).samples;
        const absStart = cursor / sampleRate;
        push(pcm);
        const absEnd = cursor / sampleRate;
        lines.push({
          lineId: clip.lineId,
          start: round3(absStart - slideStart / sampleRate),
          end: round3(absEnd - slideStart / sampleRate),
        });
        wordTimings.push(...estimateWordTimings(clip.text, absStart, absEnd));
        transcript.push(clip.text);
      });
      silence(pacing.tail);
    }
    slides.push({ slideId, duration: round3((cursor - slideStart) / sampleRate), lines });
  }

  const samples = new Int16Array(cursor);
  let o = 0;
  for (const p of parts) {
    samples.set(p, o);
    o += p.length;
  }
  return {
    pcm: { sampleRate, samples },
    duration: round3(cursor / sampleRate),
    slides,
    wordTimings,
    transcript: transcript.join(" "),
  };
}

// ---------------------------------------------------------------------------
// Long lessons: narrate in parts
// ---------------------------------------------------------------------------

/**
 * Group slides, in order, into requests of at most `maxLines` sentences each.
 * A slide is never split (its timing is laid out as one piece), so a single
 * slide with more sentences than `maxLines` can't be narrated: that's an error.
 * Slides with no sentences ride along with their neighbours (they become silence).
 */
export function batchNarration<T extends { lines: unknown[] }>(
  slides: T[],
  maxLines: number
): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let count = 0;
  for (const slide of slides) {
    const n = slide.lines.length;
    if (n > maxLines) {
      throw new Error(
        `One slide has ${n} sentences; the most one slide can have is ${maxLines}. Split it into two slides.`
      );
    }
    if (count + n > maxLines && current.length) {
      batches.push(current);
      current = [];
      count = 0;
    }
    current.push(slide);
    count += n;
  }
  if (current.length) batches.push(current);
  return batches;
}

export interface NarrationPart {
  pcm: Pcm16;
  /** Word times, seconds from the start of this part. */
  wordTimings: WordTiming[];
  transcript: string;
}

/**
 * Join parts narrated separately into one track. Each part holds whole slides,
 * and slide cues are slide-relative, so only the word times need moving: each
 * part's are shifted by the length of the parts before it.
 */
export function joinNarrationParts(parts: NarrationPart[]): AssembledTrack {
  if (!parts.length) throw new Error("No narration parts to join");
  const sampleRate = parts[0].pcm.sampleRate;
  const total = parts.reduce((n, p) => n + resample(p.pcm, sampleRate).samples.length, 0);
  const samples = new Int16Array(total);
  const wordTimings: WordTiming[] = [];
  let offset = 0;
  for (const part of parts) {
    const pcm = resample(part.pcm, sampleRate).samples;
    samples.set(pcm, offset);
    const shift = offset / sampleRate;
    for (const w of part.wordTimings) {
      wordTimings.push({
        text: w.text,
        start: round3(w.start + shift),
        end: round3(w.end + shift),
      });
    }
    offset += pcm.length;
  }
  return {
    pcm: { sampleRate, samples },
    duration: round3(total / sampleRate),
    wordTimings,
    transcript: parts
      .map((p) => p.transcript.trim())
      .filter(Boolean)
      .join(" "),
  };
}

export interface AssembledTrack {
  pcm: Pcm16;
  duration: number;
  wordTimings: WordTiming[];
  transcript: string;
}

// ---------------------------------------------------------------------------
// Apply cues to the lesson
// ---------------------------------------------------------------------------

const elementEnd = (el: SlideElement) =>
  el.timing.start + el.timing.fadeIn + el.timing.hold + el.timing.fadeOut;

/**
 * Retime a slide to its narration: the slide takes the narrated length, each
 * element linked to a line appears as that line starts, and unlinked elements
 * keep their relative position. Elements that ran to the old slide end still
 * run to the new one.
 */
export function retimeSlide(slide: Slide, cue: SlideCue): Slide {
  const oldDur = slide.duration;
  const newDur = Math.max(1, cue.duration);
  const scale = newDur / Math.max(0.001, oldDur);
  const lineById = new Map(cue.lines.map((l) => [l.lineId, l]));
  const firstLineFor = new Map<string, { start: number; end: number }>();
  for (const line of slide.narration?.lines ?? []) {
    const c = lineById.get(line.id);
    if (!c) continue;
    for (const id of line.elementIds) if (!firstLineFor.has(id)) firstLineFor.set(id, c);
  }

  const elements = slide.elements.map((el): SlideElement => {
    const t = el.timing;
    const ranToEnd = elementEnd(el) >= oldDur - 0.3;
    const linked = firstLineFor.get(el.id);
    const start = linked
      ? Math.max(0, linked.start - 0.1)
      : t.start <= 0.05
        ? t.start
        : t.start * scale;
    const visible = t.fadeIn + t.hold + t.fadeOut;
    let hold: number;
    if (ranToEnd) {
      hold = newDur - start - t.fadeIn - t.fadeOut;
    } else if (linked) {
      hold = Math.max(t.hold, linked.end - start - t.fadeIn);
    } else {
      hold = t.hold * (visible > 0 ? Math.min(scale, 3) : 1);
    }
    // Never run past the slide end.
    hold = Math.max(0.01, Math.min(hold, newDur - start - t.fadeIn - t.fadeOut));
    return { ...el, timing: { ...t, start: round3(start), hold: round3(hold) } } as SlideElement;
  });

  const narration = slide.narration
    ? {
        ...slide.narration,
        lines: slide.narration.lines.map((l) => {
          const c = lineById.get(l.id);
          return c ? { ...l, start: c.start, end: c.end } : l;
        }),
      }
    : undefined;

  return { ...slide, duration: round3(newDur), elements, ...(narration ? { narration } : {}) };
}

export function applyNarrationCues(lesson: Lesson, cues: SlideCue[]): Lesson {
  const byId = new Map(cues.map((c) => [c.slideId, c]));
  return {
    ...lesson,
    slides: lesson.slides.map((s) => {
      const c = byId.get(s.id);
      return c && c.lines.length ? retimeSlide(s, c) : s;
    }),
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
