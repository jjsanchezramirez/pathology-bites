// Auto timing for canvas lessons: elements that follow the narration.
//
// Each slide's narration is a list of sentences. An element linked to a
// sentence (NarrationLine.elementIds) and marked with a `cue` is timed from
// that sentence: it fades in as the sentence starts, and either stays to the
// end of the slide ("build") or leaves when the next sentence starts ("beat").
// Sentence times come from the recorded voice when every sentence has them;
// otherwise they are estimated from word count with the narration's pacing, so
// a lesson is timed before any audio exists. A slide with `autoDuration` takes
// the narration's length. Editing an element's timing by hand clears its cue.
//
// Pure and idempotent: the editor runs it after every change.

import { DEFAULT_PACING } from "./narration";
import { estimateSpeech } from "./script/timeline";
import type { Lesson, Slide, SlideElement, Timing } from "./types";

/** The one motion set, in seconds (matches the script player). */
export const AUTO_MOTION = {
  fadeIn: 0.6,
  fadeOut: 0.4,
  /** Camera move into a zoom, and back out. */
  zoomIn: 1.1,
  zoomOut: 0.8,
  /** Elements lead their sentence slightly, so they land as it's heard. */
  lead: 0.1,
  /** Slide length when it has no narration. */
  silentSlide: 4,
} as const;

export interface LineWindow {
  start: number;
  end: number;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

const finite = (n: unknown): n is number => typeof n === "number" && isFinite(n);

/**
 * Sentence windows for a slide, seconds from slide start. Recorded times win
 * when every sentence has them; otherwise sentences run one after another from
 * the lead-in, each starting at its pinned `at` time if it has one.
 */
export function lineWindows(slide: Slide): LineWindow[] {
  const lines = slide.narration?.lines ?? [];
  if (!lines.length) return [];
  const recorded = lines.every((l) => finite(l.start) && finite(l.end) && l.end! >= l.start!);
  if (recorded) return lines.map((l) => ({ start: l.start!, end: l.end! }));
  const { leadIn, gap } = DEFAULT_PACING;
  let cursor = leadIn;
  return lines.map((l) => {
    const start = finite(l.at) ? Math.max(0, l.at) : cursor;
    const end = start + estimateSpeech(l.text);
    cursor = end + gap;
    return { start: round3(start), end: round3(end) };
  });
}

/** Slide length that fits its narration (spoken or estimated). */
export function narratedDuration(slide: Slide, windows = lineWindows(slide)): number {
  if (!windows.length) return slide.duration || AUTO_MOTION.silentSlide;
  const lastEnd = Math.max(...windows.map((w) => w.end));
  return round3(Math.max(2, lastEnd + DEFAULT_PACING.tail));
}

function sameTiming(a: Timing, b: Timing): boolean {
  return (
    a.start === b.start && a.fadeIn === b.fadeIn && a.hold === b.hold && a.fadeOut === b.fadeOut
  );
}

/** Timing for one cued element, given its sentence (or none: whole slide). */
function cueTiming(
  el: SlideElement,
  lineIndex: number,
  windows: LineWindow[],
  duration: number
): Timing {
  const isCamera = el.kind === "camera";
  const fadeIn = isCamera ? AUTO_MOTION.zoomIn : AUTO_MOTION.fadeIn;
  const line = lineIndex >= 0 ? windows[lineIndex] : null;
  // Unlinked elements (headings, pictures, panels) are there from the start.
  if (!line) {
    return { start: 0, fadeIn: 0, hold: round3(Math.max(0.01, duration)), fadeOut: 0 };
  }
  const start = round3(Math.max(0, line.start - AUTO_MOTION.lead));
  if (el.cue === "beat") {
    const next = windows[lineIndex + 1];
    const fadeOut = isCamera ? AUTO_MOTION.zoomOut : AUTO_MOTION.fadeOut;
    const end = Math.min(duration, next ? next.start - AUTO_MOTION.lead : duration);
    const hold = Math.max(0.01, end - start - fadeIn - fadeOut);
    return { start, fadeIn, hold: round3(hold), fadeOut };
  }
  return { start, fadeIn, hold: round3(Math.max(0.01, duration - start - fadeIn)), fadeOut: 0 };
}

/** Apply auto timing to one slide. Returns the same slide when nothing changes. */
export function autoTimeSlide(slide: Slide): Slide {
  const cued = slide.elements.some((e) => e.cue);
  if (!cued && !slide.autoDuration) return slide;
  const windows = lineWindows(slide);
  const duration = slide.autoDuration ? narratedDuration(slide, windows) : slide.duration;
  const lineOf = new Map<string, number>();
  (slide.narration?.lines ?? []).forEach((l, i) => {
    for (const id of l.elementIds) if (!lineOf.has(id)) lineOf.set(id, i);
  });
  let changed = duration !== slide.duration;
  const elements = slide.elements.map((el) => {
    if (!el.cue) return el;
    const timing = cueTiming(el, lineOf.get(el.id) ?? -1, windows, duration);
    if (sameTiming(timing, el.timing)) return el;
    changed = true;
    return { ...el, timing } as SlideElement;
  });
  return changed ? { ...slide, duration, elements } : slide;
}

/** Apply auto timing across a lesson. Returns the same lesson when nothing changes. */
export function autoTimeLesson(lesson: Lesson): Lesson {
  let changed = false;
  const slides = lesson.slides.map((s) => {
    const next = autoTimeSlide(s);
    if (next !== s) changed = true;
    return next;
  });
  return changed ? { ...lesson, slides } : lesson;
}

/** Which sentence (0-based) an element follows, or -1. */
export function cueLineIndex(slide: Slide, elementId: string): number {
  return (slide.narration?.lines ?? []).findIndex((l) => l.elementIds.includes(elementId));
}
