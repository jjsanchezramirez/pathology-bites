// The single, pure lesson evaluator. Given a Lesson and a time `t`, it computes
// everything needed to render a frame — the camera transform and the active
// overlays — for the editor preview, the player, and the canvas exporter alike.
//
// This replaces both the old editor runtime (model/runtime.ts, linear) and the
// player engine (engine-core.ts, smoothstep + baked keyframes). Motion is eased
// here, once, so preview == playback == export. No keyframe baking.

import type {
  Transform,
  HighlightRegion,
  ArrowPointer,
  TextOverlay,
  SvgOverlayElement,
} from "@/shared/types/explainer";
import type {
  Lesson,
  Slide,
  Timing,
  SlideElement,
  CameraElement,
  ImageElement,
  Framing,
  Rect,
  Point,
  Waypoint,
  ArrowWaypoint,
  ArrowElement,
} from "./types";
import { Easing, applyEase } from "./easing";

export const DEFAULT_TRANSFORM: Transform = { x: 0, y: 0, scale: 1 };

// Entrance/exit scale-pop bounds (overlay "pops" in with overshoot, shrinks out).
const ENTER_FROM = 0.85;
const EXIT_TO = 0.92;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const uiToTransform = (v: number) => v - 50;
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

// ---- Camera composition types ----------------------------------------------

export interface CameraTransform {
  x: number; // −50..50 player space
  y: number;
  scale: number;
}

export interface SlideRuntime {
  transform: CameraTransform;
  elementOpacity: Record<string, number>; // 0..1, per element id
  elementScale: Record<string, number>; // entrance/exit scale-pop, per element id
}

// ---- Timing -----------------------------------------------------------------

/** Opacity at `time` for a four-phase timing window (linear fades). */
export function opacityAt(t: Timing, time: number): number {
  const fadeInEnd = t.start + t.fadeIn;
  const holdEnd = fadeInEnd + t.hold;
  const end = holdEnd + t.fadeOut;
  if (time < t.start || time > end) return 0;
  if (time < fadeInEnd) return t.fadeIn > 0 ? (time - t.start) / t.fadeIn : 1;
  if (time <= holdEnd) return 1;
  return t.fadeOut > 0 ? (end - time) / t.fadeOut : 1;
}

/**
 * Entrance/exit scale-pop at `time`. easeOutBack overshoot on the way in, a
 * gentle scale-down on the way out, 1 while held. `motion` (0..1) damps toward 1
 * for reduced-motion.
 */
export function scaleAt(t: Timing, time: number, motion = 1): number {
  const fadeInEnd = t.start + t.fadeIn;
  const holdEnd = fadeInEnd + t.hold;
  const end = holdEnd + t.fadeOut;
  let s = 1;
  if (time >= t.start && time < fadeInEnd && t.fadeIn > 0) {
    s = lerp(ENTER_FROM, 1, Easing.easeOutBack((time - t.start) / t.fadeIn));
  } else if (time > holdEnd && time <= end && t.fadeOut > 0) {
    s = lerp(1, EXIT_TO, (time - holdEnd) / t.fadeOut);
  }
  return 1 + (s - 1) * motion;
}

/** True if `time` falls within the element's full visible span (including fades). */
export function isVisibleAt(t: Timing, time: number): boolean {
  const end = t.start + t.fadeIn + t.hold + t.fadeOut;
  return time >= t.start && time <= end;
}

// ---- Spatial waypoint interpolation -----------------------------------------

/** Shortest-path rotation lerp in degrees. */
function lerpAngle(a: number, b: number, p: number): number {
  const diff = ((((b - a) % 360) + 540) % 360) - 180;
  return a + diff * p;
}

/** Find the bracketing waypoint indices (i, i+1) for a given local time. Expects sorted input. */
function bracket<T extends { time: number }>(wps: T[], localTime: number): [T, T, number] {
  if (localTime <= wps[0].time) return [wps[0], wps[0], 0];
  const last = wps[wps.length - 1];
  if (localTime >= last.time) return [last, last, 0];
  for (let i = 0; i < wps.length - 1; i++) {
    const a = wps[i];
    const b = wps[i + 1];
    if (localTime >= a.time && localTime <= b.time) {
      const span = b.time - a.time;
      const p = span > 0 ? (localTime - a.time) / span : 0;
      return [a, b, p];
    }
  }
  return [last, last, 0];
}

function interpolateRect(
  waypoints: Waypoint[] | undefined,
  timingStart: number,
  time: number,
  fallback: Rect
): Rect {
  if (!waypoints || waypoints.length < 2) return fallback;
  const sorted = waypoints.slice().sort((a, b) => a.time - b.time);
  const localT = time - timingStart;
  const [a, b, p] = bracket(sorted, localT);
  return {
    x: lerp(a.rect.x, b.rect.x, p),
    y: lerp(a.rect.y, b.rect.y, p),
    w: lerp(a.rect.w, b.rect.w, p),
    h: lerp(a.rect.h, b.rect.h, p),
    rotation: lerpAngle(a.rect.rotation, b.rect.rotation, p),
  };
}

function interpolateArrow(
  waypoints: ArrowWaypoint[] | undefined,
  timingStart: number,
  time: number,
  fallback: { from: Point; to: Point }
): { from: Point; to: Point } {
  if (!waypoints || waypoints.length < 2) return fallback;
  const sorted = waypoints.slice().sort((a, b) => a.time - b.time);
  const localT = time - timingStart;
  const [a, b, p] = bracket(sorted, localT);
  return {
    from: { x: lerp(a.from.x, b.from.x, p), y: lerp(a.from.y, b.from.y, p) },
    to: { x: lerp(a.to.x, b.to.x, p), y: lerp(a.to.y, b.to.y, p) },
  };
}

/** Runtime rect for an element (waypoint-interpolated when present). */
export function rectAt(element: SlideElement, time: number): Rect | null {
  if (!("rect" in element)) return null;
  const wps = (element as { waypoints?: Waypoint[] }).waypoints;
  return interpolateRect(wps, element.timing.start, time, element.rect);
}

/** Runtime from/to points for an arrow at `time`. */
export function arrowPointsAt(arrow: ArrowElement, time: number): { from: Point; to: Point } {
  return interpolateArrow(arrow.waypoints, arrow.timing.start, time, {
    from: arrow.from,
    to: arrow.to,
  });
}

// ---- Camera -----------------------------------------------------------------

/**
 * Base camera transform at `time`: initialFraming composed with every persistent
 * camera whose fadeIn has completed by `time`. Returns player-space (−50..50).
 */
export function baseTransformAt(
  initialFraming: Framing,
  cameras: CameraElement[],
  time: number
): CameraTransform {
  let base = {
    x: uiToTransform(initialFraming.x),
    y: uiToTransform(initialFraming.y),
    scale: initialFraming.scale,
  };
  const persistent = cameras.filter((c) => c.persistent);
  const sorted = persistent.slice().sort((a, b) => a.timing.start - b.timing.start);
  for (const p of sorted) {
    const panEnd = p.timing.start + p.timing.fadeIn;
    if (time >= panEnd) {
      base = { x: uiToTransform(p.to.x), y: uiToTransform(p.to.y), scale: p.to.scale };
    }
  }
  return base;
}

/**
 * Apply active camera elements on top of the base transform. Persistent cameras
 * (pans) form a moving base; non-persistent (zooms) compose on top. Each move's
 * progress is eased by the camera's `easing` (default easeInOutCubic), so a whole
 * Ken-Burns move follows one authored curve.
 */
export function applyActiveCamera(
  time: number,
  base: CameraTransform,
  cameras: CameraElement[],
  initialFraming: Framing
): CameraTransform {
  const movingBase = { ...base };

  const persistent = cameras.filter((c) => c.persistent);
  const sortedPersistent = persistent.slice().sort((a, b) => a.timing.start - b.timing.start);
  for (const p of sortedPersistent) {
    const t = p.timing;
    const fadeInEnd = t.start + t.fadeIn;
    if (time < t.start || time >= fadeInEnd) continue;

    let panBase = {
      x: uiToTransform(initialFraming.x),
      y: uiToTransform(initialFraming.y),
      scale: initialFraming.scale,
    };
    for (const prior of sortedPersistent) {
      if (prior === p) break;
      if (prior.timing.start + prior.timing.fadeIn <= t.start) {
        panBase = {
          x: uiToTransform(prior.to.x),
          y: uiToTransform(prior.to.y),
          scale: prior.to.scale,
        };
      }
    }
    const raw = t.fadeIn > 0 ? (time - t.start) / t.fadeIn : 1;
    const progress = applyEase(p.easing, raw);
    const tx = uiToTransform(p.to.x);
    const ty = uiToTransform(p.to.y);
    movingBase.scale = panBase.scale + (p.to.scale - panBase.scale) * progress;
    movingBase.x = panBase.x + (tx - panBase.x) * progress;
    movingBase.y = panBase.y + (ty - panBase.y) * progress;
  }

  const out = { ...movingBase };

  const transient = cameras.filter((c) => !c.persistent);
  for (const z of transient) {
    const t = z.timing;
    const fadeInEnd = t.start + t.fadeIn;
    const holdEnd = fadeInEnd + t.hold;
    const end = holdEnd + t.fadeOut;
    if (time < t.start || time > end) continue;

    let raw: number;
    if (time < fadeInEnd) {
      raw = t.fadeIn > 0 ? (time - t.start) / t.fadeIn : 1;
    } else if (time <= holdEnd) {
      raw = 1;
    } else {
      raw = t.fadeOut > 0 ? 1 - (time - holdEnd) / t.fadeOut : 0;
    }
    const progress = applyEase(z.easing, raw);
    const tx = uiToTransform(z.to.x);
    const ty = uiToTransform(z.to.y);
    out.scale = movingBase.scale + (z.to.scale - movingBase.scale) * progress;
    out.x = movingBase.x + (tx - movingBase.x) * progress;
    out.y = movingBase.y + (ty - movingBase.y) * progress;
  }

  return out;
}

/** Camera transform for a slide at slide-local `time`. */
function slideTransform(slide: Slide, time: number): CameraTransform {
  const cameras = slide.elements.filter((e): e is CameraElement => e.kind === "camera");
  const base = baseTransformAt(slide.initialFraming, cameras, time);
  return applyActiveCamera(time, base, cameras, slide.initialFraming);
}

/** Compute camera transform + per-element opacity/scale for a slide at `time`. */
export function computeSlideAt(slide: Slide, time: number, motion = 1): SlideRuntime {
  const transform = slideTransform(slide, time);
  const elementOpacity: Record<string, number> = {};
  const elementScale: Record<string, number> = {};
  for (const el of slide.elements) {
    if (el.kind === "camera") continue;
    const base = el.opacity ?? 1;
    elementOpacity[el.id] = clamp01(base * opacityAt(el.timing, time));
    elementScale[el.id] = scaleAt(el.timing, time, motion);
  }
  return { transform, elementOpacity, elementScale };
}

/** Player-space transform expressed as a CSS transform string. */
export function cameraToCss(t: CameraTransform): string {
  return `translate(${t.x}%, ${t.y}%) scale(${t.scale})`;
}

// ---- Element → render-primitive mapping -------------------------------------

interface RenderState {
  highlights: HighlightRegion[];
  arrows: ArrowPointer[];
  textOverlays: TextOverlay[];
  svgOverlays: SvgOverlayElement[];
}

/** Resolve a slide's background image element (becomes the segment imageUrl). */
function resolveBackground(slide: Slide): { bgEl: ImageElement | undefined; imageUrl: string } {
  const bgEl =
    slide.elements.find(
      (e): e is ImageElement => e.kind === "image" && e.id.startsWith("image-bg-")
    ) ??
    slide.elements.find(
      (e): e is ImageElement => e.kind === "image" && e.rect.w >= 99 && e.rect.h >= 99
    );
  return { bgEl, imageUrl: bgEl?.imageUrl ?? "" };
}

/** Build the active overlay render lists for a slide at slide-local `time`. */
function buildRenderState(
  slide: Slide,
  time: number,
  motion: number,
  skipElementId?: string
): RenderState {
  const highlights: HighlightRegion[] = [];
  const arrows: ArrowPointer[] = [];
  const textOverlays: TextOverlay[] = [];
  const svgOverlays: SvgOverlayElement[] = [];

  for (const el of slide.elements) {
    if (el.kind === "camera") continue;
    if (el.id === skipElementId) continue;

    const opacity = clamp01((el.opacity ?? 1) * opacityAt(el.timing, time));
    if (opacity <= 0) continue;
    const computedScale = scaleAt(el.timing, time, motion);

    switch (el.kind) {
      case "shape": {
        const r = rectAt(el, time) ?? el.rect;
        highlights.push({
          id: el.id,
          type: el.shape,
          position: { x: r.x + r.w / 2, y: r.y + r.h / 2 },
          size: { width: r.w, height: r.h },
          borderColor: el.stroke.color,
          borderWidth: el.stroke.width,
          borderStyle: el.stroke.style,
          fillColor: el.fill,
          opacity,
          computedScale,
          spotlight: false,
          shadow: el.shadow ?? false,
        });
        break;
      }
      case "spotlight": {
        const r = rectAt(el, time) ?? el.rect;
        highlights.push({
          id: el.id,
          type: el.shape,
          position: { x: r.x + r.w / 2, y: r.y + r.h / 2 },
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
          computedScale,
          shadow: el.shadow !== false,
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
          animation: el.animation ?? "fade",
          shadow: el.shadow !== false,
          computedOpacity: opacity,
          computedScale,
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
          opacity,
          computedOpacity: opacity,
          computedScale,
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
          opacity,
          computedOpacity: opacity,
          computedScale,
        });
        break;
      }
    }
  }

  return { highlights, arrows, textOverlays, svgOverlays };
}

// ---- Top-level frame state --------------------------------------------------

export interface FrameState {
  currentSlide: Slide | null;
  incomingSlide: Slide | null;
  transform: Transform;
  highlights: HighlightRegion[];
  arrows: ArrowPointer[];
  textOverlays: TextOverlay[];
  svgOverlays: SvgOverlayElement[];
  transitionOpacity: number;
  incomingOpacity: number;
  // Resolved background for the renderers (image wins; else backgroundColor).
  imageUrl: string;
  backgroundColor?: string;
  incomingImageUrl: string;
  incomingBackgroundColor?: string;
  incomingTransform: Transform;
}

const EMPTY_FRAME: FrameState = {
  currentSlide: null,
  incomingSlide: null,
  transform: DEFAULT_TRANSFORM,
  highlights: [],
  arrows: [],
  textOverlays: [],
  svgOverlays: [],
  transitionOpacity: 1,
  incomingOpacity: 0,
  imageUrl: "",
  backgroundColor: undefined,
  incomingImageUrl: "",
  incomingBackgroundColor: undefined,
  incomingTransform: DEFAULT_TRANSFORM,
};

/** Cumulative absolute start time (seconds) of each slide, plus total duration. */
export function slideStarts(lesson: Lesson): { starts: number[]; duration: number } {
  const starts: number[] = [];
  let cursor = 0;
  for (const slide of lesson.slides) {
    starts.push(cursor);
    cursor += slide.duration;
  }
  return { starts, duration: cursor };
}

export interface EvaluateOptions {
  /** 0..1 reduced-motion multiplier (0 pins the camera, 1 = full motion). */
  motion?: number;
}

/**
 * Evaluate a lesson at absolute time `t`. Pure — no React, no DOM. Drives the
 * editor preview, the player viewport, and the canvas exporter.
 */
export function evaluate(lesson: Lesson, t: number, opts: EvaluateOptions = {}): FrameState {
  const motion = opts.motion ?? 1;
  const { slides } = lesson;
  if (slides.length === 0) return EMPTY_FRAME;

  const { starts } = slideStarts(lesson);

  // Find the current slide (< end so the next slide takes over at the boundary,
  // except the last slide which is inclusive).
  let index = -1;
  for (let i = 0; i < slides.length; i++) {
    const start = starts[i];
    const end = start + slides[i].duration;
    const isLast = i === slides.length - 1;
    if (t >= start && (isLast ? t <= end : t < end)) {
      index = i;
      break;
    }
  }
  if (index === -1) index = t >= starts[slides.length - 1] ? slides.length - 1 : 0;

  const current = slides[index];
  const slideStart = starts[index];
  const slideLocal = t - slideStart;

  // ---- Transition into the next slide (segment N's exit uses slide N+1's
  // transitionIn — PPT "how a slide enters" convention, matching the old bake).
  let incoming: Slide | null = null;
  let transitionOpacity = 1;
  let incomingOpacity = 0;

  if (index < slides.length - 1) {
    const next = slides[index + 1];
    const transitionDuration = next.transitionIn.duration;
    const slideEnd = slideStart + current.duration;
    const transitionStart = slideEnd - transitionDuration;
    if (transitionDuration > 0 && t >= transitionStart && t < slideEnd) {
      const progress = clamp01((t - transitionStart) / transitionDuration);
      switch (next.transitionIn.kind) {
        case "crossfade":
          incoming = next;
          transitionOpacity = 1;
          incomingOpacity = progress;
          break;
        case "fade-to-black":
          if (progress <= 0.5) {
            transitionOpacity = 1 - progress * 2;
          } else {
            transitionOpacity = 0;
            incoming = next;
            incomingOpacity = (progress - 0.5) * 2;
          }
          break;
        // "cut": nothing — switches at the exact boundary.
      }
    }
  }

  const { bgEl, imageUrl } = resolveBackground(current);
  const render = buildRenderState(current, slideLocal, motion, bgEl?.id);

  // Camera transform, eased, then damped toward the slide-start transform for
  // reduced motion.
  let transform = slideTransform(current, slideLocal) as Transform;
  if (motion < 1) {
    const startT = slideTransform(current, 0);
    transform = {
      x: lerp(startT.x, transform.x, motion),
      y: lerp(startT.y, transform.y, motion),
      scale: lerp(startT.scale, transform.scale, motion),
    };
  }

  let incomingImageUrl = "";
  let incomingBackgroundColor: string | undefined;
  let incomingTransform: Transform = DEFAULT_TRANSFORM;
  if (incoming) {
    const ib = resolveBackground(incoming);
    incomingImageUrl = ib.imageUrl;
    incomingBackgroundColor = ib.imageUrl ? undefined : incoming.backgroundColor;
    incomingTransform = slideTransform(incoming, 0) as Transform;
  }

  return {
    currentSlide: current,
    incomingSlide: incoming,
    transform,
    highlights: render.highlights,
    arrows: render.arrows.filter((a) => a.opacity > 0.01),
    textOverlays: render.textOverlays.filter((o) => (o.computedOpacity ?? 1) > 0.01),
    svgOverlays: render.svgOverlays.filter((s) => (s.computedOpacity ?? s.opacity) > 0.01),
    transitionOpacity,
    incomingOpacity,
    imageUrl,
    backgroundColor: imageUrl ? undefined : current.backgroundColor,
    incomingImageUrl,
    incomingBackgroundColor,
    incomingTransform,
  };
}
