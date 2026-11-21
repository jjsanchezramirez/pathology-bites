// Import a script lesson from JSON or from a plain-text script, so whole
// lessons can be drafted outside the studio (by hand or by Claude) and then
// edited in it. Input is checked strictly enough to catch typos, and loosely
// enough that a hand-written draft doesn't need ids or every field.
//
// JSON (ids optional; a beat can be just its sentence):
//   { "title": "...", "scenes": [
//       { "template": "ladder", "heading": "The dysplasia ladder",
//         "beats": ["Then grade it on a ladder.",
//                   { "say": "Negative: ...", "text": "Negative", "detail": "..." }] } ] }
//
// Plain text: "# template: heading" starts a scene; every other line is one
// sentence, optionally followed by "| on-screen words | smaller line".

import { z } from "zod";
import { splitSentences } from "../narration";
import {
  SCRIPT_FORMAT,
  SCRIPT_VERSION,
  TEMPLATE_ORDER,
  newId,
  type Beat,
  type ImageRegion,
  type Scene,
  type SceneImage,
  type ScriptLesson,
  type TemplateKind,
} from "./types";

const pct = z.number().min(-5).max(105);

const imageSchema = z.union([
  z.string().url(),
  z.object({
    url: z.string().url(),
    id: z.string().optional(),
    alt: z.string().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
  }),
]);

const beatSchema = z.union([
  z.string(),
  z.object({
    id: z.string().optional(),
    say: z.string(),
    text: z.string().optional(),
    detail: z.string().optional(),
    side: z.enum(["left", "right"]).optional(),
    image: imageSchema.optional(),
    region: z.object({ x: pct, y: pct, w: pct, h: pct }).optional(),
    mark: z.enum(["ring", "spotlight", "zoom"]).optional(),
  }),
]);

const sceneSchema = z.object({
  id: z.string().optional(),
  template: z.enum(TEMPLATE_ORDER as [TemplateKind, ...TemplateKind[]]),
  heading: z.string().optional(),
  image: imageSchema.optional(),
  credit: z.string().optional(),
  beats: z.array(beatSchema).default([]),
});

const lessonSchema = z.object({
  format: z.literal(SCRIPT_FORMAT).optional(),
  version: z.number().optional(),
  id: z.string().nullish(),
  title: z.string().default(""),
  description: z.string().default(""),
  scenes: z.array(sceneSchema).min(1),
});

export interface ImportResult {
  lesson: ScriptLesson | null;
  warnings: string[];
  error?: string;
}

function toImage(v: z.infer<typeof imageSchema> | undefined): SceneImage | undefined {
  if (!v) return undefined;
  return typeof v === "string" ? { url: v } : (v as SceneImage);
}

function uniqueId(raw: string | undefined, seen: Set<string>, prefix: "scene" | "beat"): string {
  const id = raw && !seen.has(raw) ? raw : newId(prefix);
  seen.add(id);
  return id;
}

/** Check a draft for things that will look wrong, without rejecting it. */
export function lintScriptLesson(lesson: ScriptLesson): string[] {
  const warnings: string[] = [];
  lesson.scenes.forEach((scene, i) => {
    const n = `Scene ${i + 1}`;
    if (scene.template === "image" && !scene.image?.url) {
      warnings.push(`${n} uses the image template but has no picture yet.`);
    }
    if (scene.template !== "title" && !scene.heading?.trim()) {
      warnings.push(`${n} has no heading.`);
    }
    const shown = scene.beats.filter((b) => b.text?.trim()).length;
    if (scene.template === "ladder" && shown > 6) {
      warnings.push(`${n} has ${shown} steps; more than 6 gets crowded.`);
    }
    if (scene.template === "takehome" && shown > 5) {
      warnings.push(`${n} has ${shown} points; more than 5 gets crowded.`);
    }
    if (scene.template === "image") {
      const items = scene.beats.filter((b) => b.text?.trim() || b.region).length;
      if (items > 7) warnings.push(`${n} has ${items} callouts; more than 7 gets crowded.`);
    }
    scene.beats.forEach((b, k) => {
      if (!b.say.trim()) warnings.push(`${n}, sentence ${k + 1} has no narration.`);
      if (b.mark === "zoom" && !b.region) {
        warnings.push(`${n}, sentence ${k + 1} zooms but has no region to zoom into.`);
      }
    });
  });
  return warnings;
}

/** Build a script lesson from parsed JSON. */
export function scriptLessonFromJson(input: unknown): ImportResult {
  const parsed = lessonSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue.path.length ? ` at ${issue.path.join(".")}` : "";
    return { lesson: null, warnings: [], error: `${issue.message}${where}` };
  }
  const seenScenes = new Set<string>();
  const seenBeats = new Set<string>();
  const scenes: Scene[] = parsed.data.scenes.map((s) => {
    const beats: Beat[] = s.beats.map((b) => {
      if (typeof b === "string") return { id: uniqueId(undefined, seenBeats, "beat"), say: b };
      const beat: Beat = { id: uniqueId(b.id, seenBeats, "beat"), say: b.say };
      if (b.text) beat.text = b.text;
      if (b.detail) beat.detail = b.detail;
      if (b.side) beat.side = b.side;
      if (b.image) beat.image = toImage(b.image);
      if (b.region) beat.region = b.region as ImageRegion;
      if (b.mark) beat.mark = b.mark;
      return beat;
    });
    const scene: Scene = {
      id: uniqueId(s.id, seenScenes, "scene"),
      template: s.template,
      heading: s.heading ?? "",
      beats: beats.length ? beats : [{ id: newId("beat"), say: "" }],
    };
    if (s.image) scene.image = toImage(s.image);
    if (s.credit) scene.credit = s.credit;
    return scene;
  });
  const lesson: ScriptLesson = {
    format: SCRIPT_FORMAT,
    version: SCRIPT_VERSION,
    id: null,
    title: parsed.data.title,
    description: parsed.data.description,
    aspectRatio: "16:9",
    audio: null,
    scenes,
  };
  return { lesson, warnings: lintScriptLesson(lesson) };
}

const SCENE_LINE = /^#\s*(?:(title|image|compare|ladder|takehome|take-home)\s*:)?\s*(.*)$/i;

/** Build a script lesson from a plain-text script. */
export function scriptLessonFromText(text: string, title = ""): ImportResult {
  const scenes: Scene[] = [];
  let current: Scene | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const head = SCENE_LINE.exec(line);
    if (head) {
      const kind = (head[1]?.toLowerCase().replace("-", "") ?? "takehome") as TemplateKind;
      current = { id: newId("scene"), template: kind, heading: head[2].trim(), beats: [] };
      scenes.push(current);
      continue;
    }
    if (!current) {
      current = { id: newId("scene"), template: "takehome", heading: "", beats: [] };
      scenes.push(current);
    }
    const [say, shown, detail] = line.split("|").map((p) => p.trim());
    const sentences = shown || detail ? [say] : splitSentences(say);
    sentences.forEach((s, i) => {
      const beat: Beat = { id: newId("beat"), say: s };
      if (i === 0 && shown) beat.text = shown;
      if (i === 0 && detail) beat.detail = detail;
      current!.beats.push(beat);
    });
  }
  if (!scenes.length) return { lesson: null, warnings: [], error: "The script is empty." };
  for (const s of scenes) if (!s.beats.length) s.beats.push({ id: newId("beat"), say: "" });
  const lesson: ScriptLesson = {
    format: SCRIPT_FORMAT,
    version: SCRIPT_VERSION,
    id: null,
    title,
    description: "",
    aspectRatio: "16:9",
    audio: null,
    scenes,
  };
  return { lesson, warnings: lintScriptLesson(lesson) };
}

/** Import whatever was pasted or uploaded: JSON first, plain text otherwise. */
export function importScript(source: string): ImportResult {
  const trimmed = source.trim();
  if (trimmed.startsWith("{")) {
    try {
      return scriptLessonFromJson(JSON.parse(trimmed));
    } catch (e) {
      return {
        lesson: null,
        warnings: [],
        error: `That isn't valid JSON (${e instanceof Error ? e.message : "parse error"}).`,
      };
    }
  }
  return scriptLessonFromText(trimmed);
}

/** The lesson as clean JSON for drafting elsewhere (no ids, timings or audio). */
export function exportScriptJson(lesson: ScriptLesson): string {
  return JSON.stringify(
    {
      format: SCRIPT_FORMAT,
      version: SCRIPT_VERSION,
      title: lesson.title,
      description: lesson.description,
      scenes: lesson.scenes.map(({ id: _id, duration: _d, ...s }) => ({
        ...s,
        beats: s.beats.map(({ id: _b, start: _s, end: _e, ...b }) => b),
      })),
    },
    null,
    2
  );
}
