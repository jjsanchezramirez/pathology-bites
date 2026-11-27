// The lesson writer: topic + notes + library images (with what vision found in
// each) → a script in the import format (scenes of the five templates, one
// sentence per beat). The model refers to pictures by number; we bind those to
// the real library images, fill in any missing pointer from vision, and run the
// result through the same importer File → Import script uses, so the canvas
// editor gets exactly what a hand-written script would give it.

import { runAITask } from "@/shared/services/ai-fallback";
import { scriptLessonFromJson } from "@/shared/lesson/script/import";
import type { BeatMark, ImageRegion, ScriptLesson } from "@/shared/lesson/script/types";
import type { ImageInput, VisionResult } from "./vision";

export interface WriterInput {
  topic: string;
  notes?: string;
  /** Roughly how long the lesson should run, in minutes. */
  minutes: number;
  images: ImageInput[];
  vision: VisionResult[];
}

export interface WriterResult {
  script: ScriptLesson;
  warnings: string[];
}

// Box size around a detected feature, percent of the picture.
const FEATURE_BOX: Record<string, number> = { large: 40, medium: 28, small: 18 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Where vision says to point on one picture, as a region and a mark, or null. */
export function suggestedPointer(v: VisionResult | undefined): {
  region: ImageRegion;
  mark: BeatMark;
  label: string;
} | null {
  if (!v?.canSeeImage || !v.featurePosition || v.annotationTool === "none") return null;
  const size = FEATURE_BOX[v.objectSize ?? ""] ?? 25;
  const x = clamp(v.featurePosition.x - size / 2, 0, 100 - size);
  const y = clamp(v.featurePosition.y - size / 2, 0, 100 - size);
  return {
    region: { x: round1(x), y: round1(y), w: size, h: size },
    mark: v.annotationTool === "spotlight" ? "spotlight" : "ring",
    label: v.suggestedLabel,
  };
}

export function buildWriterPrompt(input: WriterInput): string {
  const sentences = Math.round((input.minutes * 60) / 5.5);
  const pictures = input.images.length
    ? input.images
        .map((img, i) => {
          const p = suggestedPointer(input.vision[i]);
          const found = p
            ? `vision found "${p.label}" at region ${JSON.stringify(p.region)} (mark "${p.mark}")`
            : "no single feature found";
          return `[${i}] ${img.category || "image"}${img.magnification ? `, ${img.magnification} power` : ""}: ${img.title || "untitled"}${img.description && img.description !== img.title ? ` — ${img.description}` : ""}. ${found}`;
        })
        .join("\n")
    : "(none — use title, compare, ladder and takehome scenes only)";

  return `Write a short narrated pathology lesson for residents, as JSON.

Topic: ${input.topic}
${input.notes?.trim() ? `Author's notes (follow them; they override your defaults):\n${input.notes.trim()}\n` : ""}
Length: about ${input.minutes} minute${input.minutes === 1 ? "" : "s"}, so about ${sentences} sentences of narration in total.

Pictures you may use (refer to them by number):
${pictures}

A lesson is a list of scenes. Each scene uses one template, and each sentence of narration is one "beat". When the narrator says a beat's sentence, its on-screen item appears.

Templates and what a beat with "text" does:
- "title": heading is the big title; a beat with text adds a subtitle. Use exactly once, first.
- "image": needs "image": <picture number>. A beat with "region" points at part of the picture: "mark" is "ring" (default), "spotlight" (dims the rest) or "zoom". Its "text" is a short numbered label beside the picture. Regions are percent of the picture: x,y = top-left corner, w,h = size. Prefer the region vision found; only invent one when you are sure where the feature is.
- "compare": two panels. Beats with "side": "left" fill the left panel, "side": "right" the right; the first beat on a side is that panel's title. A beat with text and no side is a closing line under both. Use for look-alikes and differentials.
- "ladder": each beat with text adds the next step, "detail" a smaller line. Use for grading, staging, workups, sequences.
- "takehome": each beat with text adds a point. Use exactly once, last, with 3–5 points.

Rules:
- Narration is spoken: plain, precise sentences, one idea each, no lists, no abbreviations without expansion on first use.
- On-screen "text" is 1–5 words; "detail" at most 8 words. A beat without "text" is narration only.
- Every scene except title has a short heading.
- Use each picture at most once, in an "image" scene, unless the author's notes say otherwise. 1–4 beats with regions per picture.
- Be accurate. Prefer WHO classification terminology. Do not invent statistics.

Respond with ONLY this JSON (no markdown fences):
{
  "title": "...",
  "description": "one sentence",
  "scenes": [
    { "template": "title", "heading": "...", "beats": [{ "say": "...", "text": "..." }] },
    { "template": "image", "heading": "...", "image": 0, "beats": [
        { "say": "...", "text": "...", "region": { "x": 30, "y": 20, "w": 25, "h": 25 }, "mark": "ring" },
        { "say": "..." } ] },
    { "template": "compare", "heading": "...", "beats": [
        { "say": "...", "side": "left", "text": "...", "detail": "..." },
        { "say": "...", "side": "right", "text": "...", "detail": "..." },
        { "say": "...", "text": "..." } ] },
    { "template": "ladder", "heading": "...", "beats": [{ "say": "...", "text": "...", "detail": "..." }] },
    { "template": "takehome", "heading": "Take-home", "beats": [{ "say": "...", "text": "..." }] }
  ]
}`;
}

function extractJson(raw: string): unknown {
  const cleaned = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("The writer did not return JSON");
    return JSON.parse(m[0]);
  }
}

type Loose = Record<string, unknown>;
const isObj = (v: unknown): v is Loose => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Turn the model's answer into a script lesson: bind picture numbers to the
 * library images, drop pictures it made up, clamp regions, give image scenes a
 * pointer from vision when the model left them without one, then validate with
 * the importer. Throws when the answer can't be used (so the fallback chain
 * moves on to the next model).
 */
export function parseWriterResponse(
  raw: string,
  images: ImageInput[],
  vision: VisionResult[]
): WriterResult {
  const data = extractJson(raw);
  if (!isObj(data) || !Array.isArray(data.scenes)) throw new Error("No scenes in the answer");
  const notes: string[] = [];

  const bind = (v: unknown) => {
    const i = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? +v : NaN;
    const img = images[i];
    if (!img) return undefined;
    return {
      url: img.url,
      alt: img.title || undefined,
      width: img.width || undefined,
      height: img.height || undefined,
    };
  };
  const fixRegion = (r: unknown): ImageRegion | undefined => {
    if (!isObj(r)) return undefined;
    const n = (k: string) => Number(r[k]);
    if (![n("x"), n("y"), n("w"), n("h")].every(Number.isFinite)) return undefined;
    const w = clamp(n("w"), 4, 100);
    const h = clamp(n("h"), 4, 100);
    return {
      x: round1(clamp(n("x"), 0, 100 - w)),
      y: round1(clamp(n("y"), 0, 100 - h)),
      w: round1(w),
      h: round1(h),
    };
  };

  const scenes = data.scenes.filter(isObj).map((s, k) => {
    const scene: Loose = { ...s };
    const beats = (Array.isArray(s.beats) ? s.beats : []).map((b) =>
      isObj(b) ? { ...b } : { say: String(b ?? "") }
    ) as Loose[];
    for (const b of beats) {
      if ("image" in b) {
        const img = bind(b.image);
        if (img) b.image = img;
        else delete b.image;
      }
      if ("region" in b) {
        const r = fixRegion(b.region);
        if (r) b.region = r;
        else delete b.region;
      }
      if (b.mark !== undefined && !["ring", "spotlight", "zoom"].includes(String(b.mark)))
        delete b.mark;
      if (b.side !== undefined && b.side !== "left" && b.side !== "right") delete b.side;
    }
    if (s.template === "image") {
      const idx = typeof s.image === "number" ? s.image : Number(s.image);
      const img = bind(s.image);
      if (img) {
        scene.image = img;
        if (!beats.some((b) => b.region)) {
          const p = suggestedPointer(vision[idx]);
          const first = beats.find((b) => typeof b.text === "string" && b.text.trim()) ?? beats[0];
          if (p && first) {
            first.region = p.region;
            first.mark = p.mark;
            notes.push(
              `Scene ${k + 1}: pointer placed from vision; check it lands on the feature.`
            );
          }
        }
      } else {
        // A picture the model invented: keep the words, lose the image scene.
        delete scene.image;
        scene.template = "takehome";
        for (const b of beats) {
          delete b.region;
          delete b.mark;
        }
        notes.push(`Scene ${k + 1} referred to a picture that wasn't provided; it became a list.`);
      }
    } else {
      delete scene.image;
    }
    scene.beats = beats;
    return scene;
  });

  const result = scriptLessonFromJson({
    title: typeof data.title === "string" ? data.title : "",
    description: typeof data.description === "string" ? data.description : "",
    scenes,
  });
  if (!result.lesson) throw new Error(`The script didn't validate: ${result.error}`);
  if (!result.lesson.scenes.some((s) => s.beats.some((b) => b.say.trim()))) {
    throw new Error("The script has no narration");
  }
  return { script: result.lesson, warnings: [...notes, ...result.warnings] };
}

export async function writeScript(
  input: WriterInput,
  modelOverride?: string
): Promise<WriterResult & { model: string }> {
  const { parsed, model } = await runAITask("lesson-writer", buildWriterPrompt(input), {
    system:
      "You are an expert pathologist and medical educator writing narrated teaching lessons. Respond with only the JSON requested.",
    modelOverride,
    parse: (content) => parseWriterResponse(content, input.images, input.vision),
  });
  return { ...parsed, model };
}
