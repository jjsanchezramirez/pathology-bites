// Canvas snapping helpers. Snap targets are the 16:9 canvas borders and
// center lines (left=0, centerX=50, right=100 on X; top=0, centerY=50,
// bottom=100 on Y), with a small pull threshold so snapping only engages
// when the user drags close to a target.

import type { Point, Rect } from "../model/types";

/** Half-width of the snap pull zone, in canvas percent. */
const SNAP_THRESHOLD = 2;

const SNAP_X = [0, 50, 100] as const;
const SNAP_Y = [0, 50, 100] as const;

/**
 * Find the delta that would move `edge` onto its nearest snap target,
 * provided the gap is within `SNAP_THRESHOLD`. Returns 0 otherwise.
 */
function nearestSnapDelta(edge: number, targets: readonly number[]): number {
  let best = 0;
  let bestAbs = SNAP_THRESHOLD + 1;
  for (const target of targets) {
    const d = target - edge;
    const ad = Math.abs(d);
    if (ad < bestAbs) {
      bestAbs = ad;
      best = d;
    }
  }
  return bestAbs <= SNAP_THRESHOLD ? best : 0;
}

/**
 * Given a rect and a raw drag delta, return a delta adjusted so that, after
 * translation, one of the rect's left/centerX/right edges lines up with a
 * canvas X snap target (if within pull), and likewise for top/centerY/bottom.
 * Snapping is skipped for rotated rects — axis-aligned edge snapping would be
 * misleading since the visual bounds no longer match `x/y/w/h`.
 */
/** True when rotation is a multiple of 90° (axis-aligned bounds are exact). */
function isAxisAligned(rotation: number): boolean {
  return Math.abs(rotation % 90) < 0.5;
}

export function snapMoveDelta(originRect: Rect, delta: Point): Point {
  if (!isAxisAligned(originRect.rotation)) return delta;

  const x = originRect.x + delta.x;
  const y = originRect.y + delta.y;

  // For each candidate edge, find the snap delta that would align it. Pick
  // the smallest non-zero one across the three X edges (and same for Y).
  const xEdges = [x, x + originRect.w / 2, x + originRect.w];
  const yEdges = [y, y + originRect.h / 2, y + originRect.h];

  let dx = 0;
  let dxAbs = Infinity;
  for (const edge of xEdges) {
    const d = nearestSnapDelta(edge, SNAP_X);
    if (d !== 0 && Math.abs(d) < dxAbs) {
      dx = d;
      dxAbs = Math.abs(d);
    }
  }

  let dy = 0;
  let dyAbs = Infinity;
  for (const edge of yEdges) {
    const d = nearestSnapDelta(edge, SNAP_Y);
    if (d !== 0 && Math.abs(d) < dyAbs) {
      dy = d;
      dyAbs = Math.abs(d);
    }
  }

  return { x: delta.x + dx, y: delta.y + dy };
}

/**
 * Snap the edges of a resized rect to the canvas grid. Only the edges being
 * dragged (determined by the handle id) are snapped so the opposite side stays
 * anchored. Skipped for rotated rects.
 */
/**
 * Measure a text element's content size in canvas-percent by querying the DOM.
 * Returns null if the element isn't found.
 */
export function measureTextContent(
  elementId: string,
  canvasEl: HTMLElement | null
): { w: number; h: number } | null {
  if (!canvasEl) return null;
  const el = canvasEl.querySelector<HTMLElement>(`[data-element-id="${elementId}"]`);
  if (!el) return null;
  const canvasRect = canvasEl.getBoundingClientRect();
  if (canvasRect.width === 0 || canvasRect.height === 0) return null;
  return {
    w: (el.scrollWidth / canvasRect.width) * 100,
    h: (el.scrollHeight / canvasRect.height) * 100,
  };
}

export function snapResize(
  rect: Rect,
  handle: string,
  contentSize?: { w: number; h: number } | null
): Rect {
  if (!isAxisAligned(rect.rotation)) return rect;
  let { x, y, w, h } = rect;
  const isCorner = handle.length === 2;

  // Build snap targets: canvas grid + content-size edges (for text boxes).
  const xTargets: number[] = [...SNAP_X];
  const yTargets: number[] = [...SNAP_Y];
  if (contentSize) {
    // Add targets so the box snaps to the text's natural width/height.
    if (handle.includes("e")) xTargets.push(x + contentSize.w);
    if (handle.includes("w")) xTargets.push(x + w - contentSize.w);
    if (handle.includes("s")) yTargets.push(y + contentSize.h);
    if (handle.includes("n")) yTargets.push(y + h - contentSize.h);
  }

  // Compute snap deltas for the moving edges.
  let dx = 0;
  let dy = 0;
  if (handle.includes("w")) dx = nearestSnapDelta(x, xTargets);
  else if (handle.includes("e")) dx = nearestSnapDelta(x + w, xTargets);
  if (handle.includes("n")) dy = nearestSnapDelta(y, yTargets);
  else if (handle.includes("s")) dy = nearestSnapDelta(y + h, yTargets);

  if (isCorner) {
    // For corners with aspect-ratio lock: snap whichever edge is closer to
    // its target, then recompute the other dimension to preserve the ratio.
    const ratio = w / Math.max(h, 1e-6);
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (adx === 0 && ady === 0) return rect;

    // Pick the axis with the smaller (nonzero) snap delta.
    const snapX = adx > 0 && (ady === 0 || adx <= ady);
    if (snapX) {
      // Snap the X edge, derive new height from aspect ratio.
      if (handle.includes("w")) {
        x += dx;
        w -= dx;
      } else {
        w += dx;
      }
      const newH = w / ratio;
      if (handle.includes("n")) {
        y -= newH - h;
      }
      h = newH;
    } else {
      // Snap the Y edge, derive new width from aspect ratio.
      if (handle.includes("n")) {
        y += dy;
        h -= dy;
      } else {
        h += dy;
      }
      const newW = h * ratio;
      if (handle.includes("w")) {
        x -= newW - w;
      }
      w = newW;
    }
  } else {
    // Edge handles: snap single axis.
    if (handle === "w") {
      x += dx;
      w -= dx;
    } else if (handle === "e") {
      w += dx;
    } else if (handle === "n") {
      y += dy;
      h -= dy;
    } else if (handle === "s") {
      h += dy;
    }
  }

  return { x, y, w, h, rotation: rect.rotation };
}

/**
 * Snap an arrow endpoint (from or to) to the 3x3 grid of canvas borders and
 * center lines. Used during arrow endpoint drags so the tail or head clicks
 * into center/edge when released nearby.
 */
export function snapPoint(pt: Point): Point {
  const dx = nearestSnapDelta(pt.x, SNAP_X);
  const dy = nearestSnapDelta(pt.y, SNAP_Y);
  return { x: pt.x + dx, y: pt.y + dy };
}
