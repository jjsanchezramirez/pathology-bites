// Pure geometry helpers for canvas interaction.
// All coordinates are in 0–100 percent (canvas-relative).
//
// Important: the canvas is 16:9, so 1% of width and 1% of height represent
// different pixel distances. Rotation and aspect-sensitive resize math must
// work in an isotropic pixel-space internally — we convert y by the canvas
// aspect ratio before rotating, then undo it after.

import type { Rect } from "../model/types";

export type Point = { x: number; y: number };

const DEG = Math.PI / 180;
/** Canvas pixel aspect ratio (width/height). Canvas is always 16:9. */
const CANVAS_ASPECT = 16 / 9;

/** Center of a rect. */
export function rectCenter(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/**
 * Rotate `p` around `origin` by `deg` degrees (clockwise, screen-space).
 * Operates in isotropic pixel-space by scaling y by `1/CANVAS_ASPECT` before
 * rotating and undoing after, so rotation preserves on-screen distances
 * despite the anisotropic percent coordinate system.
 */
export function rotate(p: Point, origin: Point, deg: number): Point {
  const r = deg * DEG;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const dx = p.x - origin.x;
  const dyIso = (p.y - origin.y) / CANVAS_ASPECT;
  const rxIso = dx * c - dyIso * s;
  const ryIso = dx * s + dyIso * c;
  return { x: origin.x + rxIso, y: origin.y + ryIso * CANVAS_ASPECT };
}

/** Transform `p` from world space into the rotated-rect's local space (center at origin). */
export function toLocal(p: Point, r: Rect): Point {
  const center = rectCenter(r);
  return rotate(p, center, -r.rotation);
}

/** Transform local-space point back to world space. */
export function fromLocal(localP: Point, r: Rect): Point {
  const center = rectCenter(r);
  return rotate({ x: center.x + localP.x, y: center.y + localP.y }, center, r.rotation);
}

/** Is world-space point `p` inside the (possibly rotated) rect? */
export function pointInRect(p: Point, r: Rect): boolean {
  const local = toLocal(p, r);
  const center = rectCenter(r);
  const lx = local.x - center.x;
  const ly = local.y - center.y;
  return lx >= -r.w / 2 && lx <= r.w / 2 && ly >= -r.h / 2 && ly <= r.h / 2;
}

/**
 * Return the four corners of a (possibly rotated) rect in world space,
 * in order: top-left, top-right, bottom-right, bottom-left.
 */
export function rectCorners(r: Rect): [Point, Point, Point, Point] {
  const center = rectCenter(r);
  const hw = r.w / 2;
  const hh = r.h / 2;
  const corners: Point[] = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ].map((c) => {
    const world = rotate({ x: center.x + c.x, y: center.y + c.y }, center, r.rotation);
    return world;
  });
  return corners as [Point, Point, Point, Point];
}

/** Distance from world point `p` to the line segment `a`–`b`. */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return Math.hypot(p.x - px, p.y - py);
}

/** Is world point `p` within `tolerance` of the segment? */
export function pointOnSegment(p: Point, a: Point, b: Point, tolerance: number): boolean {
  return distanceToSegment(p, a, b) <= tolerance;
}

// ---- Handle positions ------------------------------------------------------

/**
 * The 8 resize handles for a rect, plus 1 rotation handle.
 * Returned in world coordinates.
 *
 * Resize handles are named by the rect edge(s) they move: nw, n, ne, e, se, s, sw, w.
 * The rotation handle is above top-center, at `rotHandleOffset` units.
 */
export type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "rotate";

export interface Handle {
  id: HandleId;
  pos: Point;
}

export function computeHandles(r: Rect, rotHandleOffset = 5): Handle[] {
  const center = rectCenter(r);
  const hw = r.w / 2;
  const hh = r.h / 2;
  const localPositions: Array<[HandleId, Point]> = [
    ["nw", { x: -hw, y: -hh }],
    ["n", { x: 0, y: -hh }],
    ["ne", { x: hw, y: -hh }],
    ["e", { x: hw, y: 0 }],
    ["se", { x: hw, y: hh }],
    ["s", { x: 0, y: hh }],
    ["sw", { x: -hw, y: hh }],
    ["w", { x: -hw, y: 0 }],
    ["rotate", { x: 0, y: -hh - rotHandleOffset }],
  ];
  return localPositions.map(([id, local]) => ({
    id,
    pos: rotate({ x: center.x + local.x, y: center.y + local.y }, center, r.rotation),
  }));
}

/** Find the handle whose position is closest to `p` within `tolerance`. */
export function hitHandle(handles: Handle[], p: Point, tolerance: number): Handle | null {
  let best: Handle | null = null;
  let bestDist = tolerance;
  for (const h of handles) {
    const d = Math.hypot(p.x - h.pos.x, p.y - h.pos.y);
    if (d <= bestDist) {
      bestDist = d;
      best = h;
    }
  }
  return best;
}

// ---- Resize math -----------------------------------------------------------

/**
 * Given a rect, a handle id, and a cursor delta in world space,
 * compute the new rect. Opposite side(s) stay anchored; rotation is preserved.
 *
 * `preserveAspect` keeps w/h ratio when dragging corners.
 */
export function resizeRect(
  original: Rect,
  handle: HandleId,
  worldDelta: Point,
  preserveAspect = false
): Rect {
  if (handle === "rotate") return original;

  // Convert world delta to local delta (inverse-rotate) in isotropic pixel-space.
  // worldDelta is in percent; scale y by aspect so rotation math is correct,
  // then undo after rotation.
  const r = original.rotation * DEG;
  const c = Math.cos(-r);
  const s = Math.sin(-r);
  const wx = worldDelta.x;
  const wy = worldDelta.y / CANVAS_ASPECT;
  const dxIso = wx * c - wy * s;
  const dyIso = wx * s + wy * c;
  const dx = dxIso;
  const dy = dyIso * CANVAS_ASPECT;

  // Compute new half-extents based on which edges move.
  let left = -original.w / 2;
  let right = original.w / 2;
  let top = -original.h / 2;
  let bottom = original.h / 2;

  if (handle.includes("w")) left += dx;
  if (handle.includes("e")) right += dx;
  if (handle.includes("n")) top += dy;
  if (handle.includes("s")) bottom += dy;

  // Normalize: if swapped, flip (user dragged past the opposite side).
  let newW = right - left;
  let newH = bottom - top;
  if (newW < 0) {
    const t = left;
    left = right;
    right = t;
    newW = -newW;
  }
  if (newH < 0) {
    const t = top;
    top = bottom;
    bottom = t;
    newH = -newH;
  }

  if (
    preserveAspect &&
    (handle === "nw" || handle === "ne" || handle === "se" || handle === "sw")
  ) {
    const origRatio = original.w / original.h;
    const newRatio = newW / Math.max(newH, 1e-6);
    if (newRatio > origRatio) {
      newW = newH * origRatio;
      if (handle.includes("w")) left = right - newW;
      else right = left + newW;
    } else {
      newH = newW / origRatio;
      if (handle.includes("n")) top = bottom - newH;
      else bottom = top + newH;
    }
  }

  // New center in local space (relative to old center).
  const newLocalCenter = { x: (left + right) / 2, y: (top + bottom) / 2 };

  // Convert that back to world space using iso-space rotation (aspect-corrected).
  const oldCenter = rectCenter(original);
  const rot = original.rotation * DEG;
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  const lcxIso = newLocalCenter.x;
  const lcyIso = newLocalCenter.y / CANVAS_ASPECT;
  const rxIso = lcxIso * cr - lcyIso * sr;
  const ryIso = lcxIso * sr + lcyIso * cr;
  const worldCenter = {
    x: oldCenter.x + rxIso,
    y: oldCenter.y + ryIso * CANVAS_ASPECT,
  };

  return {
    x: worldCenter.x - newW / 2,
    y: worldCenter.y - newH / 2,
    w: newW,
    h: newH,
    rotation: original.rotation,
  };
}

/** Compute rotation angle (degrees) from rect center to cursor.
 *  Accounts for the 16:9 canvas aspect so the angle reflects the user's
 *  perceived on-screen direction, not the anisotropic percent delta. */
export function angleFromCenter(r: Rect, p: Point): number {
  const c = rectCenter(r);
  // Scale y by aspect so x and y share equivalent pixel units.
  const dxPx = p.x - c.x;
  const dyPx = (p.y - c.y) / CANVAS_ASPECT;
  // 0° points up (toward rotation handle). Add 90° since atan2(0, 1) is 0° east.
  const a = Math.atan2(dyPx, dxPx) / DEG + 90;
  return a;
}

/**
 * Update rect rotation given a pointer position and the initial pointer angle.
 * Returns new rotation clamped to 0–360.
 */
export function applyRotation(original: Rect, pointerStart: Point, pointerCurrent: Point): Rect {
  const startAngle = angleFromCenter(original, pointerStart);
  const nowAngle = angleFromCenter(original, pointerCurrent);
  const delta = nowAngle - startAngle;
  let next = original.rotation + delta;
  next = ((next % 360) + 360) % 360;
  return { ...original, rotation: next };
}
