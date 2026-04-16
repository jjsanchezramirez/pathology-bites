// Hit testing for SlideElements on the canvas.
// Iterates top-most-first so the last-painted element wins.
// Tests against the *runtime-interpolated* position at the current viewTime so
// animated elements (those with waypoints) are hit where the user sees them.

import type { SlideElement } from "../model/types";
import type { Point } from "./geometry";
import { pointInRect, pointOnSegment, rectCenter } from "./geometry";
import { rectAt, arrowPointsAt } from "../model/runtime";

/** Returns the topmost element hit at `p`, or null. `p` is in 0–100% canvas coords. */
export function hitElement(
  elements: SlideElement[],
  p: Point,
  viewTime: number,
  arrowTolerance = 2
): SlideElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (elementHit(el, p, viewTime, arrowTolerance)) return el;
  }
  return null;
}

function elementHit(el: SlideElement, p: Point, viewTime: number, arrowTolerance: number): boolean {
  switch (el.kind) {
    case "arrow": {
      const pts = arrowPointsAt(el, viewTime);
      return pointOnSegment(p, pts.from, pts.to, arrowTolerance);
    }
    case "camera":
      // Camera ops are not interactable on canvas.
      return false;
    default: {
      const r = rectAt(el, viewTime) ?? el.rect;
      return pointInRect(p, r);
    }
  }
}

/**
 * Compute the axis-aligned bounding rect that tightly contains the selection,
 * used to draw the selection-handles frame. Arrows get a zero-height line bbox.
 * Returns null if selection is empty or only contains camera elements.
 */
export function selectionBounds(
  elements: SlideElement[]
): { x: number; y: number; w: number; h: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;

  for (const el of elements) {
    if (el.kind === "camera") continue;
    any = true;
    if (el.kind === "arrow") {
      minX = Math.min(minX, el.from.x, el.to.x);
      minY = Math.min(minY, el.from.y, el.to.y);
      maxX = Math.max(maxX, el.from.x, el.to.x);
      maxY = Math.max(maxY, el.from.y, el.to.y);
      continue;
    }
    // For a rotated rect, use its 4 world-space corners.
    const r = el.rect;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const DEG = Math.PI / 180;
    const rot = r.rotation * DEG;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const hw = r.w / 2;
    const hh = r.h / 2;
    const corners = [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ].map((p) => ({ x: cx + p.x * c - p.y * s, y: cy + p.x * s + p.y * c }));
    for (const p of corners) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }

  if (!any) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Translate a SlideElement by a world-space delta in percent.
 * If the element has waypoints (animated), every waypoint is translated by the
 * same delta so the whole motion path moves rigidly with the base rect.
 */
export function moveElement(el: SlideElement, delta: Point): SlideElement {
  if (el.kind === "arrow") {
    const wps = el.waypoints?.map((wp) => ({
      ...wp,
      from: { x: wp.from.x + delta.x, y: wp.from.y + delta.y },
      to: { x: wp.to.x + delta.x, y: wp.to.y + delta.y },
    }));
    return {
      ...el,
      from: { x: el.from.x + delta.x, y: el.from.y + delta.y },
      to: { x: el.to.x + delta.x, y: el.to.y + delta.y },
      ...(wps ? { waypoints: wps } : {}),
    };
  }
  if (el.kind === "camera") return el;
  const wps = el.waypoints?.map((wp) => ({
    ...wp,
    rect: { ...wp.rect, x: wp.rect.x + delta.x, y: wp.rect.y + delta.y },
  }));
  return {
    ...el,
    rect: { ...el.rect, x: el.rect.x + delta.x, y: el.rect.y + delta.y },
    ...(wps ? { waypoints: wps } : {}),
  };
}

/** Produce a synthetic Rect for arrows (from the two endpoints) for handle rendering. */
export function arrowBbox(from: Point, to: Point) {
  const minX = Math.min(from.x, to.x);
  const minY = Math.min(from.y, to.y);
  const maxX = Math.max(from.x, to.x);
  const maxY = Math.max(from.y, to.y);
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
  };
}

// re-export for convenience
export { rectCenter };
