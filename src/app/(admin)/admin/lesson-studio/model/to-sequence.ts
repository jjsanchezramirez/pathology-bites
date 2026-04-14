// Lesson → ExplainerSequence converter.
// Produces keyframes at every element timing breakpoint so the player's interpolation
// has deterministic control points. All editor coords are 0–100 percent; we only
// convert to the player's -50..50 transform space here.

import type {
  ExplainerSequence,
  Segment,
  Keyframe,
  HighlightRegion,
  ArrowPointer,
  TextOverlay,
  SvgOverlayElement,
} from "@/shared/types/explainer";
import { buildCaptionChunks } from "../utils/caption-builder";
import type { Lesson, Slide, SlideElement, PanElement, ZoomElement, ImageElement } from "./types";
import { timingEnd } from "./types";
import { opacityAt, baseTransformAt, applyActiveCamera, rectAt, arrowPointsAt } from "./runtime";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** All distinct time breakpoints for a slide's elements, plus slide endpoints. */
function collectBreakpoints(slide: Slide): number[] {
  const s = new Set<number>([0, slide.duration]);
  for (const el of slide.elements) {
    const t = el.timing;
    s.add(t.start);
    s.add(t.start + t.fadeIn);
    s.add(t.start + t.fadeIn + t.hold);
    s.add(timingEnd(t));
    // Include every spatial waypoint so exported keyframes capture motion.
    const wps = (el as { waypoints?: { time: number }[] }).waypoints;
    if (wps && wps.length >= 2) {
      for (const wp of wps) s.add(t.start + wp.time);
    }
  }
  // Clip to slide duration & drop negatives.
  return Array.from(s)
    .filter((x) => x >= 0 && x <= slide.duration)
    .sort((a, b) => a - b);
}

/** Build a single keyframe at `time` from slide elements. */
function buildKeyframe(slide: Slide, time: number, skipElementId?: string): Keyframe {
  const zooms = slide.elements.filter((e): e is ZoomElement => e.kind === "zoom");
  const pans = slide.elements.filter((e): e is PanElement => e.kind === "pan");
  const base = baseTransformAt(slide.initialFraming, pans, time);
  const transform = applyActiveCamera(time, base, zooms, pans, slide.initialFraming);

  const highlights: HighlightRegion[] = [];
  const arrows: ArrowPointer[] = [];
  const textOverlays: TextOverlay[] = [];
  const svgOverlays: SvgOverlayElement[] = [];

  for (const el of slide.elements) {
    if (el.kind === "zoom" || el.kind === "pan") continue;
    if (el.id === skipElementId) continue;

    const opacity = clamp01((el.opacity ?? 1) * opacityAt(el.timing, time));
    if (opacity <= 0) continue;

    switch (el.kind) {
      case "shape": {
        const r = rectAt(el, time) ?? el.rect;
        const centerPos = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
        highlights.push({
          id: el.id,
          type: el.shape,
          position: centerPos,
          size: { width: r.w, height: r.h },
          borderColor: el.stroke.color,
          borderWidth: el.stroke.width,
          borderStyle: el.stroke.style,
          fillColor: el.fill,
          opacity,
          spotlight: false,
        });
        break;
      }
      case "spotlight": {
        const r = rectAt(el, time) ?? el.rect;
        const centerPos = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
        highlights.push({
          id: el.id,
          type: el.shape,
          position: centerPos,
          size: { width: r.w, height: r.h },
          borderColor: "#000000",
          borderWidth: 0,
          fillColor: undefined,
          opacity,
          spotlight: true,
        });
        break;
      }
      case "arrow": {
        const pts = arrowPointsAt(el, time);
        arrows.push({
          id: el.id,
          startPosition: pts.from,
          endPosition: pts.to,
          color: el.color,
          strokeWidth: el.strokeWidth,
          headSize: el.headSize,
          opacity,
        });
        break;
      }
      case "text": {
        const r = rectAt(el, time) ?? el.rect;
        textOverlays.push({
          id: el.id,
          text: el.text,
          position: { x: r.x + r.w / 2, y: r.y + r.h / 2 },
          fontSize: el.fontSize,
          fontWeight: el.fontWeight,
          color: el.color,
          backgroundColor: el.background,
          maxWidth: r.w,
          textAlign: el.align,
          animation: "fade",
          computedOpacity: opacity,
        });
        break;
      }
      case "svg": {
        const r = rectAt(el, time) ?? el.rect;
        svgOverlays.push({
          id: el.id,
          svgUrl: el.svgUrl,
          position: { x: r.x + r.w / 2, y: r.y + r.h / 2 },
          size: { width: r.w, height: r.h },
          rotation: r.rotation,
          opacity: opacity,
          computedOpacity: opacity,
          color: el.color,
        });
        break;
      }
      case "image": {
        const r = rectAt(el, time) ?? el.rect;
        svgOverlays.push({
          id: el.id,
          overlayKind: "image",
          svgUrl: el.imageUrl,
          position: { x: r.x + r.w / 2, y: r.y + r.h / 2 },
          size: { width: r.w, height: r.h },
          rotation: r.rotation,
          opacity: opacity,
          computedOpacity: opacity,
        });
        break;
      }
    }
  }

  return {
    time,
    transform,
    highlights,
    arrows,
    textOverlays,
    svgOverlays: svgOverlays.length > 0 ? svgOverlays : undefined,
  };
}

/**
 * Convert a Lesson to an ExplainerSequence ready for the player.
 * Returns null if the lesson has no slides.
 *
 * The original Lesson is embedded in `sequence.editorState` for lossless round-trip
 * re-opening via `from-sequence.ts`.
 */
export function lessonToSequence(lesson: Lesson): ExplainerSequence | null {
  if (lesson.slides.length === 0) return null;

  let cursor = 0;
  const segments: Segment[] = lesson.slides.map((slide, index) => {
    const startTime = cursor;
    const endTime = cursor + slide.duration;
    cursor = endTime;

    // Detect the background ImageElement for the player's segment imageUrl.
    // Prefer the well-known "image-bg-" prefix set by slideFromImage / migration,
    // then fall back to any approximately-full-canvas image at index 0.
    const bgEl = slide.elements.find(
      (e): e is ImageElement => e.kind === "image" && e.id.startsWith("image-bg-")
    ) ?? slide.elements.find(
      (e): e is ImageElement =>
        e.kind === "image" && e.rect.w >= 99 && e.rect.h >= 99
    );
    const bgImageUrl = bgEl?.imageUrl ?? "";

    const breakpoints = collectBreakpoints(slide);
    // Skip the bg element in keyframes — it's already the segment's imageUrl
    // and rendering it as an overlay blocks crossfade transitions (z-index issue).
    const keyframes = breakpoints.map((time) => buildKeyframe(slide, time, bgEl?.id));

    const isLast = index === lesson.slides.length - 1;
    // A segment's transition controls what happens when it EXITS (at the
    // boundary with the next segment). The slide model uses `transitionIn`
    // (PPT convention — how a slide enters), so the exit transition for
    // segment N is the next slide's entrance transition.
    const nextSlide = isLast ? null : lesson.slides[index + 1];
    return {
      id: slide.id,
      imageUrl: bgImageUrl,
      imageAlt: "",
      ...(!bgImageUrl && slide.backgroundColor
        ? { backgroundColor: slide.backgroundColor }
        : {}),
      startTime,
      endTime,
      transition: nextSlide ? nextSlide.transitionIn.kind : "cut",
      transitionDuration: nextSlide ? nextSlide.transitionIn.duration : 0,
      keyframes,
    };
  });

  const totalDuration = segments[segments.length - 1]?.endTime ?? 0;

  const sequence: ExplainerSequence = {
    version: 1,
    duration: totalDuration,
    aspectRatio: "16:9",
    segments,
    ...(lesson.audio?.url ? { audioUrl: lesson.audio.url } : {}),
    editorState: { lesson: lesson as unknown, selectedImages: [lesson as unknown] },
  };

  if (lesson.audio?.transcript && lesson.audio.duration && lesson.audio.duration > 0) {
    const captions = buildCaptionChunks(lesson.audio.transcript, lesson.audio.duration);
    if (captions.length > 0) sequence.captions = captions;
  }

  return sequence;
}

// Exposed for unit tests.
export const _internal = {
  opacityAt,
  collectBreakpoints,
  baseTransformAt,
  applyActiveCamera,
  buildKeyframe,
};
export type { SlideElement };
