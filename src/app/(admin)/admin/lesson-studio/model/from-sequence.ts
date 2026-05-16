// ExplainerSequence → Lesson loader.
// Primary path: read the Lesson embedded in sequence.editorState.selectedImages[0]
// (lossless round-trip from to-sequence.ts).
//
// Fallback path: reverse-engineer a Lesson from raw keyframes. This is only needed
// for hand-crafted or imported JSON. We recover timing from the deterministic
// 4-point timing windows written by to-sequence.

import type {
  ExplainerSequence,
  HighlightRegion,
  ArrowPointer,
  TextOverlay,
  SvgOverlayElement,
} from "@/shared/types/explainer";
import type { Lesson, Slide, SlideElement, ShapeKind, Timing } from "./types";
import { DEFAULT_TRANSITION } from "./types";

function isLessonShape(v: unknown): v is Lesson {
  if (!v || typeof v !== "object") return false;
  const l = v as { slides?: unknown; aspectRatio?: unknown };
  return Array.isArray(l.slides) && typeof l.aspectRatio === "string";
}

const transformToUi = (v: number) => v + 50;

/**
 * Recover a 4-phase Timing from a sorted list of {time, opacity} observations.
 * Assumes the emitter (to-sequence) wrote the canonical breakpoints:
 *   start (0) → start+fadeIn (1) → start+fadeIn+hold (1) → end (0).
 */
function recoverTiming(entries: { time: number; opacity: number }[]): Timing {
  if (entries.length === 0) return { start: 0, fadeIn: 0.5, hold: 1, fadeOut: 0.5 };

  const sorted = entries.slice().sort((a, b) => a.time - b.time);
  const full = sorted.filter((e) => e.opacity >= 0.99).map((e) => e.time);
  const zero = sorted.filter((e) => e.opacity <= 0.01).map((e) => e.time);

  if (full.length === 0) {
    // No fully-visible keyframe — approximate.
    const first = sorted[0].time;
    const last = sorted[sorted.length - 1].time;
    const span = Math.max(0.1, last - first);
    return { start: first, fadeIn: span / 2, hold: 0, fadeOut: span / 2 };
  }

  const fadeInEnd = Math.min(...full);
  const holdEnd = Math.max(...full);
  const hold = Math.max(0, holdEnd - fadeInEnd);

  const preZero = zero.filter((t) => t < fadeInEnd);
  const postZero = zero.filter((t) => t > holdEnd);
  const start = preZero.length > 0 ? Math.max(...preZero) : Math.max(0, fadeInEnd - 0.5);
  const end = postZero.length > 0 ? Math.min(...postZero) : holdEnd + 0.5;

  return {
    start,
    fadeIn: Math.max(0, fadeInEnd - start),
    hold,
    fadeOut: Math.max(0, end - holdEnd),
  };
}

/** Scan a segment's keyframes for a shape/spotlight with `id` → recover Timing. */
function timingForOverlay(
  keyframes: ExplainerSequence["segments"][number]["keyframes"],
  id: string,
  pick: (kf: ExplainerSequence["segments"][number]["keyframes"][number]) => number | null
): Timing {
  const entries: { time: number; opacity: number }[] = [];
  for (const kf of keyframes) {
    const opacity = pick(kf);
    entries.push({ time: kf.time, opacity: opacity ?? 0 });
  }
  return recoverTiming(entries);
}

function rebuildSlideElements(segment: ExplainerSequence["segments"][number]): SlideElement[] {
  const kfs = segment.keyframes;
  const elements: SlideElement[] = [];

  // Collect unique overlay ids across all keyframes.
  const highlightIds = new Set<string>();
  const arrowIds = new Set<string>();
  const textIds = new Set<string>();
  const svgIds = new Set<string>();
  for (const kf of kfs) {
    kf.highlights.forEach((h) => highlightIds.add(h.id));
    kf.arrows.forEach((a) => arrowIds.add(a.id));
    kf.textOverlays.forEach((t) => textIds.add(t.id));
    kf.svgOverlays?.forEach((s) => svgIds.add(s.id));
  }

  // Shapes & spotlights
  for (const id of highlightIds) {
    const sample = kfs.flatMap((kf) => kf.highlights).find((h) => h.id === id) as
      | HighlightRegion
      | undefined;
    if (!sample) continue;
    const timing = timingForOverlay(kfs, id, (kf) => {
      const match = kf.highlights.find((h) => h.id === id);
      return match ? match.opacity : null;
    });
    const shape = sample.type as ShapeKind;
    const rect = {
      x: sample.position.x - sample.size.width / 2,
      y: sample.position.y - sample.size.height / 2,
      w: sample.size.width,
      h: sample.size.height,
      rotation: 0,
    };
    if (sample.spotlight) {
      elements.push({
        id,
        kind: "spotlight",
        shape,
        rect,
        dimOpacity: 0.7,
        timing,
      });
    } else {
      elements.push({
        id,
        kind: "shape",
        shape,
        rect,
        stroke: {
          color: sample.borderColor,
          width: sample.borderWidth,
          style: sample.borderStyle ?? "solid",
        },
        fill: sample.fillColor,
        timing,
      });
    }
  }

  // Arrows
  for (const id of arrowIds) {
    const sample = kfs.flatMap((kf) => kf.arrows).find((a) => a.id === id) as
      | ArrowPointer
      | undefined;
    if (!sample) continue;
    const timing = timingForOverlay(kfs, id, (kf) => {
      const match = kf.arrows.find((a) => a.id === id);
      return match ? match.opacity : null;
    });
    elements.push({
      id,
      kind: "arrow",
      from: sample.startPosition,
      to: sample.endPosition,
      color: sample.color,
      strokeWidth: sample.strokeWidth,
      headSize: sample.headSize ?? 12,
      timing,
    });
  }

  // Text
  for (const id of textIds) {
    const sample = kfs.flatMap((kf) => kf.textOverlays).find((t) => t.id === id) as
      | TextOverlay
      | undefined;
    if (!sample) continue;
    const timing = timingForOverlay(kfs, id, (kf) => {
      const match = kf.textOverlays.find((t) => t.id === id);
      return match ? (match.computedOpacity ?? 1) : null;
    });
    const width = sample.maxWidth ?? 60;
    const height = sample.fontSize * 2; // rough
    elements.push({
      id,
      kind: "text",
      text: sample.text,
      rect: {
        x: sample.position.x - width / 2,
        y: sample.position.y - height / 2,
        w: width,
        h: height,
        rotation: 0,
      },
      fontSize: sample.fontSize,
      fontWeight: sample.fontWeight,
      color: sample.color,
      background: sample.backgroundColor,
      align: sample.textAlign ?? "center",
      timing,
    });
  }

  // SVGs (and stamped images)
  for (const id of svgIds) {
    const sample = kfs.flatMap((kf) => kf.svgOverlays ?? []).find((s) => s.id === id) as
      | SvgOverlayElement
      | undefined;
    if (!sample) continue;
    const timing = timingForOverlay(kfs, id, (kf) => {
      const match = kf.svgOverlays?.find((s) => s.id === id);
      return match ? (match.computedOpacity ?? match.opacity) : null;
    });
    const rect = {
      x: sample.position.x - sample.size.width / 2,
      y: sample.position.y - sample.size.height / 2,
      w: sample.size.width,
      h: sample.size.height,
      rotation: sample.rotation,
    };
    if (sample.overlayKind === "image") {
      elements.push({
        id,
        kind: "image",
        imageUrl: sample.svgUrl,
        rect,
        opacity: sample.opacity,
        timing,
      });
    } else {
      elements.push({
        id,
        kind: "svg",
        svgUrl: sample.svgUrl,
        rect,
        opacity: sample.opacity,
        color: sample.color,
        timing,
      });
    }
  }

  // NOTE: camera operations (zoom/pan) are not reverse-engineered from raw keyframes
  // in this fallback path — the transform is baked into keyframes and disambiguating
  // zoom vs pan requires heuristics. For round-trip loading via editorState we get
  // them back exactly; imported JSON with camera motion will lose element-level
  // zoom/pan but keyframe transforms still play correctly.

  return elements;
}

/**
 * Load an ExplainerSequence back into a Lesson.
 * Prefers `sequence.editorState` (lossless). Falls back to keyframe reverse-engineering.
 */
/** Migrate legacy kind:"zoom"/kind:"pan" to unified kind:"camera". */
function migrateCameraElements(lesson: Lesson): Lesson {
  let changed = false;
  const slides = lesson.slides.map((slide) => {
    const elements = slide.elements.map((el) => {
      const raw = el as unknown as Record<string, unknown>;
      if (raw.kind === "zoom") {
        changed = true;
        return { ...el, kind: "camera" as const, persistent: false } as SlideElement;
      }
      if (raw.kind === "pan") {
        changed = true;
        return { ...el, kind: "camera" as const, persistent: true } as SlideElement;
      }
      return el;
    });
    return changed ? { ...slide, elements } : slide;
  });
  return changed ? { ...lesson, slides } : lesson;
}

export function sequenceToLesson(sequence: ExplainerSequence): Lesson {
  // Fast path: round-trip via editorState (prefer new `lesson` key, fall back to legacy).
  const saved = sequence.editorState?.lesson ?? sequence.editorState?.selectedImages?.[0];
  if (isLessonShape(saved)) {
    return migrateCameraElements(saved);
  }

  // Fallback: rebuild from keyframes (lossy — no element-level camera ops).
  const slides: Slide[] = sequence.segments.map((seg, index) => {
    const duration = seg.endTime - seg.startTime;
    const firstKf = seg.keyframes[0];
    const initialFraming = firstKf
      ? {
          x: transformToUi(firstKf.transform.x),
          y: transformToUi(firstKf.transform.y),
          scale: firstKf.transform.scale,
        }
      : { x: 50, y: 50, scale: 1 };
    const elements = rebuildSlideElements(seg);
    // Insert a full-canvas ImageElement for the background if the segment has an image.
    if (seg.imageUrl) {
      elements.unshift({
        id: `image-bg-${seg.id}`,
        kind: "image",
        imageUrl: seg.imageUrl,
        rect: { x: 0, y: 0, w: 100, h: 100, rotation: 0 },
        opacity: 1,
        timing: { start: 0, fadeIn: 0, hold: duration, fadeOut: 0 },
      });
    }
    // A segment's transition describes what happens when it EXITS. In the
    // slide model, `transitionIn` describes how this slide enters — which
    // is the previous segment's exit transition.
    const prevSeg = index > 0 ? sequence.segments[index - 1] : null;
    return {
      id: seg.id,
      backgroundColor: seg.backgroundColor,
      duration,
      transitionIn: prevSeg
        ? { kind: prevSeg.transition, duration: prevSeg.transitionDuration }
        : { ...DEFAULT_TRANSITION },
      initialFraming,
      elements,
    };
  });

  return {
    id: null,
    title: "",
    description: "",
    aspectRatio: "16:9",
    audio: sequence.audioUrl ? { url: sequence.audioUrl } : null,
    slides,
  };
}
