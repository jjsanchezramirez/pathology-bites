// The fixed motion set for script lessons: one easing curve, one fade, one zoom.
// Every template uses these and nothing else, which keeps lessons calm and
// consistent. Pure functions of time, so preview, playback and seeking agree.

import { Easing, clamp } from "../easing";
import type { ImageRegion } from "./types";

/** The one easing curve. */
export const ease = Easing.easeInOutCubic;

export const MOTION = {
  /** Seconds for an element to fade in (with a small rise). */
  fade: 0.6,
  /** Distance the fade rises from, in cqw (percent of stage width). */
  rise: 0.8,
  /** Seconds for the camera to zoom in or out. */
  zoom: 1.1,
  /** Seconds of crossfade between scenes. */
  sceneFade: 0.5,
  /** Deepest zoom allowed. */
  maxZoom: 3,
} as const;

/** 0→1 progress of a fade that starts at `start`. Before start: 0. */
export function fadeIn(time: number, start: number, length: number = MOTION.fade): number {
  if (time <= start) return 0;
  if (length <= 0) return 1;
  return ease(clamp((time - start) / length, 0, 1));
}

/** Fade that is visible from `start` and leaves at `end` (fade out over the same length). */
export function fadeWindow(time: number, start: number, end: number | null): number {
  const inP = fadeIn(time, start);
  if (end == null || time <= end) return inP;
  return inP * (1 - fadeIn(time, end));
}

/** CSS for an element at a fade progress `p`: opacity plus the small rise. */
export function fadeStyle(p: number): { opacity: number; transform?: string } {
  if (p >= 1) return { opacity: 1 };
  return { opacity: p, transform: `translateY(${((1 - p) * MOTION.rise).toFixed(3)}cqw)` };
}

export interface ZoomTarget {
  /** Scale factor, ≥ 1. */
  scale: number;
  /** Translation in percent of the image box, applied before scaling around its center. */
  tx: number;
  ty: number;
}

export const NO_ZOOM: ZoomTarget = { scale: 1, tx: 0, ty: 0 };

/**
 * Camera target that frames `region` inside its image box. The region's
 * center moves to the box center, scaled so the region fills ~85% of the box,
 * and clamped so the image always covers the box (no empty edges).
 */
export function zoomTarget(region: ImageRegion): ZoomTarget {
  const w = Math.max(1, region.w);
  const h = Math.max(1, region.h);
  const scale = clamp(Math.min(100 / w, 100 / h) * 0.85, 1, MOTION.maxZoom);
  const cx = region.x + region.w / 2;
  const cy = region.y + region.h / 2;
  const lim = 50 - 50 / scale;
  return {
    scale,
    tx: clamp(50 - cx, -lim, lim),
    ty: clamp(50 - cy, -lim, lim),
  };
}

/** Linear blend between two zoom targets; `p` is already eased by the caller. */
export function lerpZoom(a: ZoomTarget, b: ZoomTarget, p: number): ZoomTarget {
  const k = clamp(p, 0, 1);
  return {
    scale: a.scale + (b.scale - a.scale) * k,
    tx: a.tx + (b.tx - a.tx) * k,
    ty: a.ty + (b.ty - a.ty) * k,
  };
}

export function zoomCss(z: ZoomTarget): string {
  if (z.scale === 1 && z.tx === 0 && z.ty === 0) return "none";
  return `scale(${z.scale.toFixed(4)}) translate(${z.tx.toFixed(3)}%, ${z.ty.toFixed(3)}%)`;
}
