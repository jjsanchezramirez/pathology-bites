// The "clean" look for canvas slides (the template look).
//
// Classic slides sort their elements into layers (pictures above shapes, text
// above everything) and pop them in with a small scale bounce. That works for
// annotations on a full-bleed slide image, but not for designed slides where a
// ring has to sit on a picture and a label on a panel. A slide with
// `look: "clean"` instead draws its elements strictly in list order, all in the
// camera's space, with text anchored to its box, no shadows, and one entrance:
// a fade with a small rise on a single easing curve.
//
// This module is pure: it turns a slide at a time into an ordered list of
// drawing items. The DOM renderer (clean-layer.tsx) lives with the player's
// viewport.

import { Easing } from "./easing";
import type { Point, Rect, ShapeKind, Slide, SlideElement, Timing } from "./types";

/** The one easing curve for clean slides. */
export const cleanEase = Easing.easeInOutCubic;

export const CLEAN = {
  /** Rise distance of an entrance, in percent of canvas width. */
  rise: 0.8,
  /** Text size: cqw per rem (same scale as classic text). */
  cqwPerRem: 1.67,
  lineHeight: 1.25,
  /** Stroke widths are in tenths of a percent of canvas width. */
  strokeUnit: 0.1,
  /** Default spotlight dim colour (RGB) when an element doesn't set one. */
  dimRgb: "12, 20, 28",
} as const;

interface Base {
  id: string;
  opacity: number;
  /** Downward offset in percent of canvas width (the entrance rise). */
  rise: number;
}

export type CleanItem =
  | (Base & {
      kind: "shape";
      shape: ShapeKind;
      rect: Rect;
      stroke: { color: string; width: number; style: "solid" | "dashed" | "dotted" };
      fill?: string;
      radius?: number;
    })
  | (Base & { kind: "spotlight"; shape: ShapeKind; rect: Rect; dim: number; within?: Rect })
  | (Base & {
      kind: "text";
      text: string;
      rect: Rect;
      fontSize: number;
      fontWeight: "normal" | "semibold" | "bold";
      color: string;
      background?: string;
      align: "left" | "center" | "right";
      /** Characters shown, for letter-by-letter text. */
      chars?: number;
    })
  | (Base & { kind: "image"; url: string; rect: Rect; color?: string; svg?: boolean })
  | (Base & {
      kind: "arrow";
      from: Point;
      to: Point;
      color: string;
      strokeWidth: number;
      headSize: number;
    });

export interface CleanFrame {
  background: string;
  items: CleanItem[];
}

export const isClean = (slide: Slide | null | undefined): boolean => slide?.look === "clean";

/** 0..1 linear visibility of a timing window. */
function linear(t: Timing, time: number): number {
  const inEnd = t.start + t.fadeIn;
  const holdEnd = inEnd + t.hold;
  const end = holdEnd + t.fadeOut;
  if (time < t.start || time > end) return 0;
  if (time < inEnd) return t.fadeIn > 0 ? (time - t.start) / t.fadeIn : 1;
  if (time <= holdEnd) return 1;
  return t.fadeOut > 0 ? (end - time) / t.fadeOut : 1;
}

/** Eased opacity and entrance rise for an element's timing at `time`. */
export function cleanFade(t: Timing, time: number, motion = 1): { opacity: number; rise: number } {
  const p = linear(t, time);
  if (p <= 0) return { opacity: 0, rise: 0 };
  const entering = time < t.start + t.fadeIn;
  const eased = cleanEase(p);
  return { opacity: eased, rise: entering ? (1 - eased) * CLEAN.rise * motion : 0 };
}

type RectFn = (el: SlideElement, time: number) => Rect | null;
type ArrowFn = (
  el: Extract<SlideElement, { kind: "arrow" }>,
  time: number
) => { from: Point; to: Point };

/**
 * Ordered drawing items for a clean slide at slide-local `time`. Geometry
 * helpers are passed in so waypoint motion matches the classic evaluator.
 */
export function cleanItemsAt(
  slide: Slide,
  time: number,
  motion: number,
  rectAt: RectFn,
  arrowAt: ArrowFn
): CleanItem[] {
  const items: CleanItem[] = [];
  for (const el of slide.elements) {
    if (el.kind === "camera") continue;
    const f = cleanFade(el.timing, time, motion);
    const opacity = Math.max(0, Math.min(1, (el.opacity ?? 1) * f.opacity));
    if (opacity <= 0.005) continue;
    const base = { id: el.id, opacity, rise: f.rise };
    switch (el.kind) {
      case "shape":
        items.push({
          ...base,
          kind: "shape",
          shape: el.shape,
          rect: rectAt(el, time) ?? el.rect,
          stroke: el.stroke,
          fill: el.fill,
          radius: el.radius,
        });
        break;
      case "spotlight":
        items.push({
          ...base,
          rise: 0,
          kind: "spotlight",
          shape: el.shape,
          rect: rectAt(el, time) ?? el.rect,
          dim: el.dimOpacity,
          within: el.within,
        });
        break;
      case "text": {
        const letters = el.animation === "letter-by-letter";
        items.push({
          ...base,
          ...(letters
            ? { opacity: el.opacity ?? 1, rise: 0, chars: Math.ceil(el.text.length * f.opacity) }
            : {}),
          kind: "text",
          text: el.text,
          rect: rectAt(el, time) ?? el.rect,
          fontSize: el.fontSize,
          fontWeight: el.fontWeight,
          color: el.color,
          background: el.background,
          align: el.align,
        });
        break;
      }
      case "image":
        items.push({ ...base, kind: "image", url: el.imageUrl, rect: rectAt(el, time) ?? el.rect });
        break;
      case "svg":
        items.push({
          ...base,
          kind: "image",
          svg: true,
          url: el.svgUrl,
          color: el.color,
          rect: rectAt(el, time) ?? el.rect,
        });
        break;
      case "arrow": {
        const pts = arrowAt(el, time);
        items.push({
          ...base,
          kind: "arrow",
          from: pts.from,
          to: pts.to,
          color: el.color,
          strokeWidth: el.strokeWidth,
          headSize: el.headSize,
        });
        break;
      }
    }
  }
  return items;
}

const ALWAYS: Timing = { start: 0, fadeIn: 0, hold: 1e6, fadeOut: 0 };

/**
 * A still of a clean slide with its lasting content showing: everything except
 * spotlights and beats (which come and go). For thumbnails.
 */
export function cleanStillItems(slide: Slide, rectAt: RectFn, arrowAt: ArrowFn): CleanItem[] {
  const still: Slide = {
    ...slide,
    elements: slide.elements
      .filter((e) => e.kind !== "spotlight" && e.cue !== "beat")
      .map((e) => ({ ...e, timing: ALWAYS }) as SlideElement),
  };
  return cleanItemsAt(still, 0, 0, rectAt, arrowAt);
}

/**
 * Items for the editor canvas at `time`: like the player, but selected
 * elements stay faintly visible outside their time window so they can be
 * found and edited.
 */
export function cleanEditorItems(
  slide: Slide,
  time: number,
  selectedIds: string[],
  rectAt: RectFn,
  arrowAt: ArrowFn
): CleanItem[] {
  const selected = new Set(selectedIds);
  const shown: Slide = {
    ...slide,
    elements: slide.elements.map((e) => {
      if (!selected.has(e.id) || cleanFade(e.timing, time).opacity >= 0.35) return e;
      return { ...e, timing: ALWAYS, opacity: 0.35 } as SlideElement;
    }),
  };
  return cleanItemsAt(shown, time, 1, rectAt, arrowAt);
}
