// Timing for script lessons. Each beat (sentence) gets a start and end inside
// its scene. With narration audio, those come from the audio itself; before
// there is audio, they are estimated from word count with the same pacing the
// narration uses, so the preview already feels like the finished lesson.

import type { CaptionChunk } from "@/shared/types/explainer";
import { captionsForAudio } from "../captions";
import { DEFAULT_PACING, type SlideCue } from "../narration";
import type { Beat, ScriptAudio, ScriptLesson } from "./types";

/** Speaking rate for estimates, words per second (~155 words a minute). */
const WORDS_PER_SECOND = 2.6;
const MIN_BEAT = 1.2;
/** Scene length when it has no narration at all. */
const SILENT_SCENE = 3;
const CAPTION_WORDS = 10;

export interface BeatTiming {
  start: number;
  end: number;
}

export interface SceneTiming {
  /** Absolute start, seconds. */
  start: number;
  duration: number;
  /** Scene-local beat windows. */
  beats: BeatTiming[];
}

export interface ScriptTimeline {
  scenes: SceneTiming[];
  duration: number;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Estimated seconds to speak a sentence. */
export function estimateSpeech(text: string): number {
  const n = wordCount(text);
  if (n === 0) return 0;
  return Math.max(MIN_BEAT, n / WORDS_PER_SECOND);
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

function hasStored(b: Beat): b is Beat & { start: number; end: number } {
  return (
    typeof b.start === "number" &&
    typeof b.end === "number" &&
    isFinite(b.start) &&
    isFinite(b.end) &&
    b.end >= b.start
  );
}

/**
 * Beat windows and scene lengths. Stored narration times are used only when
 * the lesson has audio; beats added since then are estimated after the last
 * narrated one, so the preview stays in step with the audio that exists.
 */
export function computeTimeline(lesson: ScriptLesson): ScriptTimeline {
  const useStored = !!lesson.audio?.url;
  const { leadIn, gap, tail } = DEFAULT_PACING;
  const scenes: SceneTiming[] = [];
  let absolute = 0;

  for (const scene of lesson.scenes) {
    const beats: BeatTiming[] = [];
    let cursor = leadIn;
    let spoken = false;
    for (const beat of scene.beats) {
      if (useStored && hasStored(beat) && beat.start >= cursor - gap - 0.05) {
        beats.push({ start: beat.start, end: beat.end });
        cursor = beat.end + gap;
        spoken = true;
        continue;
      }
      const speech = estimateSpeech(beat.say);
      if (speech === 0) {
        // A beat with no words still reveals its item. With narration it shows
        // right after the previous sentence and takes no time, so the sentences
        // after it stay on the audio; before narration it gets a short pause.
        if (useStored) {
          const at = round3(Math.max(leadIn, cursor - gap));
          beats.push({ start: at, end: at });
          continue;
        }
        beats.push({ start: cursor, end: cursor + MIN_BEAT });
        cursor += MIN_BEAT + gap;
        continue;
      }
      beats.push({ start: round3(cursor), end: round3(cursor + speech) });
      cursor += speech + gap;
      spoken = true;
    }
    const lastEnd = beats.length ? beats[beats.length - 1].end : 0;
    let duration = spoken ? lastEnd + tail : Math.max(SILENT_SCENE, lastEnd + tail);
    if (useStored && typeof scene.duration === "number" && scene.duration > duration) {
      duration = scene.duration;
    }
    duration = round3(duration);
    scenes.push({ start: round3(absolute), duration, beats });
    absolute += duration;
  }
  return { scenes, duration: round3(absolute) };
}

export interface ScriptPosition {
  sceneIndex: number;
  /** Seconds from the start of the scene. */
  local: number;
  /** Beat whose window holds `local` (the last one that has started), or -1. */
  beatIndex: number;
}

/** Which scene and beat is on screen at absolute time `t`. */
export function locate(timeline: ScriptTimeline, t: number): ScriptPosition {
  const { scenes } = timeline;
  if (!scenes.length) return { sceneIndex: -1, local: 0, beatIndex: -1 };
  let i = scenes.length - 1;
  for (let k = 0; k < scenes.length; k++) {
    if (t < scenes[k].start + scenes[k].duration) {
      i = k;
      break;
    }
  }
  const local = Math.max(0, t - scenes[i].start);
  let beatIndex = -1;
  scenes[i].beats.forEach((b, k) => {
    if (local >= b.start) beatIndex = k;
  });
  return { sceneIndex: i, local, beatIndex };
}

/** Scene boundaries for the scrubber (absolute seconds, excluding 0). */
export function sceneMarkers(timeline: ScriptTimeline): number[] {
  return timeline.scenes.slice(1).map((s) => s.start);
}

/** Times a learner can step between: every scene start and every beat start. */
export function scriptStepPoints(timeline: ScriptTimeline): number[] {
  const set = new Set<number>();
  for (const s of timeline.scenes) {
    set.add(s.start);
    for (const b of s.beats) set.add(round3(s.start + b.start));
  }
  return [...set].filter((t) => t >= 0 && t < timeline.duration).sort((a, b) => a - b);
}

/** Every picture the lesson shows, for preloading. */
export function scriptImageUrls(lesson: ScriptLesson): string[] {
  const urls = new Set<string>();
  for (const s of lesson.scenes) {
    if (s.image?.url) urls.add(s.image.url);
    for (const b of s.beats) if (b.image?.url) urls.add(b.image.url);
  }
  return [...urls];
}

/**
 * Captions. Word timings from the narration are used when present; otherwise
 * each sentence is split into short chunks spread across its window.
 */
export function scriptCaptions(lesson: ScriptLesson, timeline: ScriptTimeline): CaptionChunk[] {
  if (lesson.audio?.wordTimings?.length && !isNarrationStale(lesson)) {
    return captionsForAudio(lesson.audio) ?? [];
  }
  const out: CaptionChunk[] = [];
  lesson.scenes.forEach((scene, si) => {
    const st = timeline.scenes[si];
    scene.beats.forEach((beat, bi) => {
      const words = beat.say.trim().split(/\s+/).filter(Boolean);
      if (!words.length) return;
      const w = st.beats[bi];
      const start = st.start + w.start;
      const per = (w.end - w.start) / words.length;
      for (let i = 0; i < words.length; i += CAPTION_WORDS) {
        const slice = words.slice(i, i + CAPTION_WORDS);
        out.push({
          text: slice.join(" "),
          start: round3(start + i * per),
          end: round3(start + (i + slice.length) * per),
        });
      }
    });
  });
  return out;
}

// ---- Narration ---------------------------------------------------------------

/** Fingerprint of everything the voice says, in order. Changes when any sentence does. */
export function scriptHash(lesson: ScriptLesson): string {
  let h = 0x811c9dc5;
  const feed = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  };
  for (const scene of lesson.scenes) {
    feed(`§${scene.id}`);
    for (const beat of scene.beats) feed(`¶${beat.id}:${beat.say.trim()}`);
  }
  return h.toString(36);
}

/** True when the lesson has narration but the script changed after it was made. */
export function isNarrationStale(lesson: ScriptLesson): boolean {
  if (!lesson.audio?.url) return false;
  if (!lesson.audio.scriptHash) return false;
  return lesson.audio.scriptHash !== scriptHash(lesson);
}

/** Request body slides for the narration route: one slide per scene, one line per sentence. */
export function narrationSlides(lesson: ScriptLesson) {
  const timeline = computeTimeline({ ...lesson, audio: null });
  return lesson.scenes.map((scene, i) => ({
    slideId: scene.id,
    duration: timeline.scenes[i].duration,
    lines: scene.beats.filter((b) => b.say.trim()).map((b) => ({ id: b.id, text: b.say.trim() })),
  }));
}

/** Put the narration's times onto the scenes and beats, and attach the audio. */
export function applyScriptNarration(
  lesson: ScriptLesson,
  cues: SlideCue[],
  audio: ScriptAudio
): ScriptLesson {
  const byScene = new Map(cues.map((c) => [c.slideId, c]));
  const scenes = lesson.scenes.map((scene) => {
    const cue = byScene.get(scene.id);
    if (!cue) return scene;
    const lines = new Map(cue.lines.map((l) => [l.lineId, l]));
    return {
      ...scene,
      duration: cue.duration,
      beats: scene.beats.map((b) => {
        const l = lines.get(b.id);
        if (!l) {
          const { start: _s, end: _e, ...rest } = b;
          return rest;
        }
        return { ...b, start: l.start, end: l.end };
      }),
    };
  });
  const next: ScriptLesson = { ...lesson, scenes };
  return { ...next, audio: { ...audio, scriptHash: scriptHash(next) } };
}

/** Remove the narration and its stored times (back to estimated timing). */
export function clearScriptNarration(lesson: ScriptLesson): ScriptLesson {
  return {
    ...lesson,
    audio: null,
    scenes: lesson.scenes.map(({ duration: _d, ...scene }) => ({
      ...scene,
      beats: scene.beats.map(({ start: _s, end: _e, ...b }) => b),
    })),
  };
}
