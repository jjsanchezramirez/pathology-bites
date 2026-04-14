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
export function snapMoveDelta(originRect: Rect, delta: Point): Point {
  if (originRect.rotation !== 0) return delta;

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
 * Snap an arrow endpoint (from or to) to the 3x3 grid of canvas borders and
 * center lines. Used during arrow endpoint drags so the tail or head clicks
 * into center/edge when released nearby.
 */
export function snapPoint(pt: Point): Point {
  const dx = nearestSnapDelta(pt.x, SNAP_X);
  const dy = nearestSnapDelta(pt.y, SNAP_Y);
  return { x: pt.x + dx, y: pt.y + dy };
}
