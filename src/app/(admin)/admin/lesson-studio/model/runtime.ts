// Pure runtime evaluation: given a Slide and a time, compute the current opacity
// of each element and the composed camera transform. Shared by to-sequence.ts
// (keyframe generation) and the editor canvas (preview-while-editing).

import type {
  Slide,
  Timing,
  SlideElement,
  CameraElement,
  Framing,
  Rect,
  Point,
  Waypoint,
  ArrowWaypoint,
  ArrowElement,
} from "./types";

export interface CameraTransform {
  x: number; // -50..50 player space
  y: number; // -50..50 player space
  scale: number;
}

export interface SlideRuntime {
  transform: CameraTransform;
  elementOpacity: Record<string, number>; // 0..1, per element id
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const uiToTransform = (v: number) => v - 50;

/** Opacity at `time` for a four-phase timing window. */
export function opacityAt(t: Timing, time: number): number {
  const fadeInEnd = t.start + t.fadeIn;
  const holdEnd = fadeInEnd + t.hold;
  const end = holdEnd + t.fadeOut;
  if (time < t.start || time > end) return 0;
  if (time < fadeInEnd) return t.fadeIn > 0 ? (time - t.start) / t.fadeIn : 1;
  if (time <= holdEnd) return 1;
  return t.fadeOut > 0 ? (end - time) / t.fadeOut : 1;
}

// ---- Spatial waypoint interpolation ---------------------------------------

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

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

/**
 * Interpolated rect at `time` (absolute segment-local seconds) for an element
 * with waypoints. If fewer than 2 waypoints, returns `fallback` unchanged.
 */
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

/** Interpolated from/to points at `time` for an arrow element. */
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

/**
 * Runtime rect for an element: uses waypoint interpolation when present,
 * otherwise returns the element's static rect. Returns null for elements
 * without a rect (arrows / camera ops).
 */
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

/** True if `time` falls within the element's full visible span (including fades). */
export function isVisibleAt(t: Timing, time: number): boolean {
  const end = t.start + t.fadeIn + t.hold + t.fadeOut;
  return time >= t.start && time <= end;
}

/**
 * Base camera transform at `time`: initialFraming composed with every persistent
 * camera element whose fadeIn has completed by `time`. Returns player-space (-50..50) coords.
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
      base = {
        x: uiToTransform(p.to.x),
        y: uiToTransform(p.to.y),
        scale: p.to.scale,
      };
    }
  }
  return base;
}

/**
 * Apply active camera elements on top of the base transform.
 * Persistent cameras (pans) form a moving base; non-persistent (zooms) compose on top.
 */
export function applyActiveCamera(
  time: number,
  base: CameraTransform,
  cameras: CameraElement[],
  initialFraming: Framing
): CameraTransform {
  // 1. Compute the moving base from any in-progress persistent camera animation.
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
    const progress = t.fadeIn > 0 ? (time - t.start) / t.fadeIn : 1;
    const tx = uiToTransform(p.to.x);
    const ty = uiToTransform(p.to.y);
    movingBase.scale = panBase.scale + (p.to.scale - panBase.scale) * progress;
    movingBase.x = panBase.x + (tx - panBase.x) * progress;
    movingBase.y = panBase.y + (ty - panBase.y) * progress;
  }

  // 2. Apply non-persistent cameras (zooms) as deltas relative to the moving base.
  const out = { ...movingBase };

  const transient = cameras.filter((c) => !c.persistent);
  for (const z of transient) {
    const t = z.timing;
    const fadeInEnd = t.start + t.fadeIn;
    const holdEnd = fadeInEnd + t.hold;
    const end = holdEnd + t.fadeOut;
    if (time < t.start || time > end) continue;

    let progress: number;
    if (time < fadeInEnd) {
      progress = t.fadeIn > 0 ? (time - t.start) / t.fadeIn : 1;
    } else if (time <= holdEnd) {
      progress = 1;
    } else {
      progress = t.fadeOut > 0 ? 1 - (time - holdEnd) / t.fadeOut : 0;
    }
    const tx = uiToTransform(z.to.x);
    const ty = uiToTransform(z.to.y);
    out.scale = movingBase.scale + (z.to.scale - movingBase.scale) * progress;
    out.x = movingBase.x + (tx - movingBase.x) * progress;
    out.y = movingBase.y + (ty - movingBase.y) * progress;
  }

  return out;
}

/** Compute camera transform + per-element opacity for a slide at `time`. */
export function computeSlideAt(slide: Slide, time: number): SlideRuntime {
  const cameras = slide.elements.filter((e): e is CameraElement => e.kind === "camera");
  const base = baseTransformAt(slide.initialFraming, cameras, time);
  const transform = applyActiveCamera(time, base, cameras, slide.initialFraming);

  const elementOpacity: Record<string, number> = {};
  for (const el of slide.elements) {
    if (el.kind === "camera") continue;
    const base = el.opacity ?? 1;
    elementOpacity[el.id] = clamp01(base * opacityAt(el.timing, time));
  }
  return { transform, elementOpacity };
}

/** Player-space transform expressed as a CSS transform string. */
export function cameraToCss(t: CameraTransform): string {
  return `translate(${t.x}%, ${t.y}%) scale(${t.scale})`;
}
