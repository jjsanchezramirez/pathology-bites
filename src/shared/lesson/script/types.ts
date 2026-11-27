// The script format: a lesson written as narration, one sentence at a time.
//
// Sentences are grouped into scenes; each scene uses one of five templates, and
// each sentence (a "beat") reveals one thing on that template. This is the
// import format for the canvas editor (File → Import script, and the AI
// generator's output): templates.ts turns every scene into editable canvas
// elements that time themselves from the narration.
//
// The retired script studio also stored this shape in
// interactive_sequences.sequence_data (`format: "script-lesson"`); such rows are
// converted to canvas on read by normalizeStoredSequence.

import type { LessonAudio } from "../types";

export const SCRIPT_FORMAT = "script-lesson" as const;
export const SCRIPT_VERSION = 1 as const;

export type TemplateKind = "title" | "image" | "compare" | "ladder" | "takehome";

/** Region on an image, in 0–100 percent of the image's own width and height. */
export interface ImageRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneImage {
  url: string;
  /** Image library id, when it came from the library. */
  id?: string;
  alt?: string;
  width?: number;
  height?: number;
}

/** How an image-template beat points at its region. */
export type BeatMark = "ring" | "spotlight" | "zoom";

export interface Beat {
  id: string;
  /** The narration sentence. */
  say: string;
  /** On-screen words this beat reveals (callout label, rung, point, panel title). */
  text?: string;
  /** Smaller second line under `text`. */
  detail?: string;
  /** compare: which panel this beat fills; none = the closing line under both. */
  side?: "left" | "right";
  /** compare: picture for the panel. */
  image?: SceneImage;
  /** image: the part of the scene image this beat points at. */
  region?: ImageRegion;
  /** image: ring (default), spotlight, or zoom into the region. */
  mark?: BeatMark;
  /** Seconds from scene start, filled in by narration. */
  start?: number;
  end?: number;
}

export interface Scene {
  id: string;
  template: TemplateKind;
  /** Shown from the start of the scene (title template: the big title). */
  heading?: string;
  /** image template: the picture. */
  image?: SceneImage;
  /** image template: small credit line under the picture. */
  credit?: string;
  beats: Beat[];
  /** Seconds, filled in by narration. */
  duration?: number;
}

export interface ScriptAudio extends LessonAudio {
  /** Fingerprint of the narration text when the audio was made (see scriptHash). */
  scriptHash?: string;
}

export interface ScriptLesson {
  format: typeof SCRIPT_FORMAT;
  version: typeof SCRIPT_VERSION;
  id: string | null;
  title: string;
  description: string;
  aspectRatio: "16:9";
  audio: ScriptAudio | null;
  scenes: Scene[];
}

export interface TemplateInfo {
  kind: TemplateKind;
  label: string;
  /** One line for the editor: what each sentence does on this template. */
  hint: string;
  /** Beat fields the editor shows for this template. */
  fields: Array<"text" | "detail" | "side" | "image" | "region" | "mark">;
}

export const TEMPLATES: Record<TemplateKind, TemplateInfo> = {
  title: {
    kind: "title",
    label: "Title",
    hint: "The heading is the big title. A sentence with words adds a subtitle line.",
    fields: ["text"],
  },
  image: {
    kind: "image",
    label: "Image with callouts",
    hint: "Each sentence can point at part of the picture and add a label beside it.",
    fields: ["text", "region", "mark"],
  },
  compare: {
    kind: "compare",
    label: "Side by side",
    hint: "Sentences fill the left panel, then the right; one without a side adds the closing line.",
    fields: ["side", "text", "detail", "image"],
  },
  ladder: {
    kind: "ladder",
    label: "Step ladder",
    hint: "Each sentence with words adds the next step.",
    fields: ["text", "detail"],
  },
  takehome: {
    kind: "takehome",
    label: "Take-home",
    hint: "Each sentence with words adds a point.",
    fields: ["text", "detail"],
  },
};

export const TEMPLATE_ORDER: TemplateKind[] = ["title", "image", "compare", "ladder", "takehome"];

export function isScriptLesson(v: unknown): v is ScriptLesson {
  if (!v || typeof v !== "object") return false;
  const l = v as { format?: unknown; scenes?: unknown };
  return l.format === SCRIPT_FORMAT && Array.isArray(l.scenes);
}

let idCounter = 0;
/** Short unique id for scenes and beats. */
export function newId(prefix: "scene" | "beat"): string {
  idCounter = (idCounter + 1) % 1_000_000;
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${Date.now().toString(36)}${idCounter.toString(36)}${rand}`;
}

export function emptyBeat(say = ""): Beat {
  return { id: newId("beat"), say };
}

export function emptyScene(template: TemplateKind = "takehome"): Scene {
  return { id: newId("scene"), template, heading: "", beats: [emptyBeat()] };
}

export function emptyScriptLesson(): ScriptLesson {
  return {
    format: SCRIPT_FORMAT,
    version: SCRIPT_VERSION,
    id: null,
    title: "",
    description: "",
    aspectRatio: "16:9",
    audio: null,
    scenes: [emptyScene("title")],
  };
}
