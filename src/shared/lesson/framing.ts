// Auto-framing helpers: derive a camera Framing that centers and fills a region,
// and clamp any framing so the zoomed image always covers the viewport (no black
// edges). Pure; used by the inspector "Auto-frame" action and the AI assembler.

import type { Framing, Rect } from "./types";
import { clamp } from "./easing";

/**
 * Clamp a framing so the scaled image fully covers the viewport. The framed
 * point (x,y, 0–100) must stay within [50/scale, 100 − 50/scale]; at scale ≤ 1
 * it collapses to the center (50).
 */
export function clampFraming(f: Framing): Framing {
  const s = Math.max(0.0001, f.scale);
  const half = 50 / s;
  const lo = Math.min(half, 50);
  const hi = Math.max(100 - half, 50);
  return { x: clamp(f.x, lo, hi), y: clamp(f.y, lo, hi), scale: f.scale };
}

/**
 * Derive a Framing that centers `rect` (0–100 UI coords) and scales it to fill
 * `coverage` of the viewport's smaller dimension, clamped to [1, maxScale] and
 * guarded against black edges.
 */
export function frameTransformForRegion(
  rect: Rect,
  opts: { coverage?: number; maxScale?: number } = {}
): Framing {
  const coverage = opts.coverage ?? 0.6;
  const maxScale = opts.maxScale ?? 4;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const w = Math.max(1, rect.w);
  const h = Math.max(1, rect.h);
  const scale = clamp(Math.min((coverage * 100) / w, (coverage * 100) / h), 1, maxScale);
  return clampFraming({ x: cx, y: cy, scale });
}
