// Hit testing for SlideElements on the canvas.
// Iterates top-most-first so the last-painted element wins.
// Tests against the *runtime-interpolated* position at the current viewTime so
// animated elements (those with waypoints) are hit where the user sees them.

import type { SlideElement } from "../model/types";
import type { Point } from "./geometry";
import { pointInRect, pointOnSegment } from "./geometry";
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
